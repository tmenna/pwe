/**
 * Cloud Storage Service — Cloudflare R2 (S3-compatible)
 *
 * Falls back gracefully to local disk when R2 env vars are not set,
 * so development works without any cloud credentials.
 *
 * Upload flow (both modes):
 *   1. Client: POST /api/uploads/request-url  → { uploadURL, objectPath }
 *   2. Client: PUT <uploadURL>   (raw binary — hits this server, not R2 directly)
 *   3. Server: on PUT, streams the body to R2 (or writes to disk in dev)
 *   4. Client: POST /api/children/:id/photo|documents with { objectPath }
 *
 * Serving:
 *   GET /objects/*  →  generate a short-lived signed download URL, redirect
 *                      (or serve from disk in dev)
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const R2_ENDPOINT = process.env.R2_ENDPOINT || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET = process.env.R2_BUCKET || "";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ""; // optional public CDN URL

const LOCAL_UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), "uploads");

const SIGNED_URL_EXPIRY_SECONDS = 3600; // 1 hour

/** Maximum upload size — default 20 MB */
export const MAX_FILE_SIZE_BYTES =
  parseInt(process.env.MAX_UPLOAD_SIZE_MB || "20", 10) * 1024 * 1024;

/** Allowed MIME types for all uploads */
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

// ---------------------------------------------------------------------------
// R2 Client (lazy — only created when R2 is configured)
// ---------------------------------------------------------------------------

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return _s3Client;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** True when all R2 environment variables are present */
export function isR2Configured(): boolean {
  return !!(R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);
}

/**
 * Generate a unique R2 object key for a given upload category.
 * Examples:
 *   children/5/photos/uuid.jpg
 *   children/5/documents/uuid-report.pdf
 *   sponsors/5/photos/uuid.jpg
 */
export function buildObjectKey(
  category: "child-photo" | "sponsor-photo" | "document",
  reference: string | number,
  originalFilename: string
): string {
  const uuid = randomUUID();
  const ext = path.extname(originalFilename).toLowerCase() || "";
  const safeName = path
    .basename(originalFilename, ext)
    .replace(/[^a-z0-9._-]/gi, "_")
    .slice(0, 60);

  switch (category) {
    case "child-photo":
      return `children/${reference}/photos/${uuid}${ext}`;
    case "sponsor-photo":
      return `sponsors/${reference}/photos/${uuid}${ext}`;
    case "document":
      return `children/${reference}/documents/${uuid}-${safeName}${ext}`;
    default:
      return `uploads/${uuid}-${safeName}${ext}`;
  }
}

/**
 * Allocate an upload slot.
 * Returns a server-side PUT URL (the client always uploads to this server,
 * never directly to R2 — avoids CORS setup on the bucket).
 */
export function allocateUploadSlot(originalFilename: string): {
  token: string;
  r2Key: string;
  uploadURL: string;
  objectPath: string;
} {
  const token = randomUUID();
  const r2Key = `uploads/${token}-${path
    .basename(originalFilename)
    .replace(/[^a-z0-9._-]/gi, "_")
    .slice(0, 80)}`;

  return {
    token,
    r2Key,
    uploadURL: `__server__/api/uploads/put/${token}`,
    objectPath: `/objects/${r2Key}`,
  };
}

/**
 * Upload a buffer/stream to R2 (or local disk in dev).
 */
export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  if (isR2Configured()) {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
      })
    );
  } else {
    // Local disk fallback — store by the UUID portion of the key
    ensureLocalDir();
    const filename = extractLocalToken(key);
    fs.writeFileSync(path.join(LOCAL_UPLOADS_DIR, filename), body);
  }
}

/**
 * Generate a signed download URL for a key.
 * In dev (no R2), returns null — caller should serve from disk.
 */
export async function generateDownloadUrl(key: string): Promise<string | null> {
  if (!isR2Configured()) return null;

  // If a public CDN URL is configured, use it directly (no expiry)
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  }

  const client = getS3Client();
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
  return getSignedUrl(client, command, { expiresIn: SIGNED_URL_EXPIRY_SECONDS });
}

/**
 * Delete a file from R2 (or local disk in dev).
 * Silently succeeds if the object does not exist.
 */
export async function deleteFile(key: string): Promise<void> {
  if (isR2Configured()) {
    try {
      const client = getS3Client();
      await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    } catch {
      // Ignore "no such key" errors
    }
  } else {
    const filename = extractLocalToken(key);
    const filePath = path.join(LOCAL_UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

/**
 * Serve a file from local disk (dev-only).
 * Returns the absolute file path if found, null otherwise.
 */
export function getLocalFilePath(key: string): string | null {
  ensureLocalDir();
  const filename = extractLocalToken(key);
  const filePath = path.join(LOCAL_UPLOADS_DIR, filename);
  return fs.existsSync(filePath) ? filePath : null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureLocalDir(): void {
  if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
    fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
  }
}

/**
 * Extract a filesystem-safe token from an R2 key.
 * We store files on disk by the UUID prefix of the key.
 * e.g. "uploads/abc-def-123-filename.pdf" → "abc-def-123-filename.pdf" (trimmed)
 * For legacy UUIDs stored as bare tokens, returns the token directly.
 */
function extractLocalToken(key: string): string {
  // Remove any leading path components that are just category words
  // e.g. "uploads/abc123-file.pdf" → use the whole basename
  return path.basename(key);
}

/** Validate a file before uploading */
export function validateFile(
  contentType: string,
  size: number
): { valid: boolean; error?: string } {
  if (size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`,
    };
  }
  if (contentType && !ALLOWED_MIME_TYPES.has(contentType)) {
    return {
      valid: false,
      error: `File type not allowed: ${contentType}`,
    };
  }
  return { valid: true };
}
