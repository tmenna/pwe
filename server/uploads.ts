/**
 * File Upload Routes
 *
 * Supports two storage backends:
 *   1. Cloudflare R2  — when R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET are set
 *   2. Local disk     — fallback for development (files stored in UPLOADS_DIR)
 *
 * Upload flow (same for both backends — client never touches R2 directly):
 *   1. POST /api/uploads/request-url  → { uploadURL, objectPath, token }
 *   2. PUT  /api/uploads/put/:token   (raw binary body sent to THIS server)
 *      └─ server streams to R2 (or writes to disk in dev)
 *   3. POST /api/children/:id/photo|documents  with { objectPath }
 *
 * File serving:
 *   GET /objects/*  → generate R2 signed download URL + redirect  (or serve from disk in dev)
 *
 * The objectPath stored in the DB is always `/objects/<r2-key>` so the frontend
 * needs no changes — img src and anchor href continue to work transparently.
 */

import express, { type Express, type RequestHandler } from "express";
import { randomUUID } from "crypto";
import {
  isR2Configured,
  uploadFile,
  generateDownloadUrl,
  generatePresignedUploadUrl,
  getLocalFilePath,
  validateFile,
  MAX_FILE_SIZE_BYTES,
} from "./services/storage";

// ---------------------------------------------------------------------------
// In-memory token → r2Key map  (cleared after upload or after TTL)
// ---------------------------------------------------------------------------

interface PendingUpload {
  r2Key: string;
  contentType: string;
  size: number;
  expiresAt: number;
}

const pendingUploads = new Map<string, PendingUpload>();
const PENDING_TTL_MS = 30 * 60 * 1000; // 30 minutes

function cleanExpired(): void {
  const now = Date.now();
  for (const [token, slot] of pendingUploads) {
    if (now > slot.expiresAt) pendingUploads.delete(token);
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerUploadRoutes(app: Express, authMiddleware?: RequestHandler): void {
  const auth: RequestHandler[] = authMiddleware ? [authMiddleware] : [];

  /**
   * Step 1 — Request an upload slot.
   *
   * When R2 is configured:  returns a short-lived presigned PUT URL pointing
   *   directly at R2 — the browser uploads straight to the bucket, bypassing
   *   this server entirely.
   *
   * Local dev fallback: returns a server-proxy PUT URL (/api/uploads/put/:token)
   *   which buffers the file and writes to disk.
   */
  app.post("/api/uploads/request-url", ...auth, async (req: any, res: any) => {
    cleanExpired();

    const { name, size, contentType } = req.body ?? {};
    if (!name) {
      return res.status(400).json({ error: "Missing required field: name" });
    }

    // Validate file before even accepting it
    if (size && contentType) {
      const validation = validateFile(contentType as string, size as number);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
    }

    const token = randomUUID();
    const safeName = String(name)
      .replace(/[^a-z0-9._-]/gi, "_")
      .slice(0, 80);
    const r2Key = `uploads/${token}-${safeName}`;
    const objectPath = `/objects/${r2Key}`;
    const mimeType = (contentType as string) || "application/octet-stream";

    // ── Direct-to-R2 presigned upload (preferred when R2 is configured) ──
    if (isR2Configured()) {
      try {
        const presignedUrl = await generatePresignedUploadUrl(r2Key, mimeType);
        if (presignedUrl) {
          return res.json({
            uploadURL: presignedUrl,
            objectPath,
            token,
            direct: true,
            metadata: { name, r2Key },
          });
        }
      } catch (err: any) {
        console.error("[uploads] Failed to generate presigned URL:", err);
        return res.status(500).json({ error: "Could not generate upload URL" });
      }
    }

    // ── Server-proxy fallback (local dev without R2) ──
    pendingUploads.set(token, {
      r2Key,
      contentType: mimeType,
      size: size || 0,
      expiresAt: Date.now() + PENDING_TTL_MS,
    });

    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const uploadURL = `${proto}://${host}/api/uploads/put/${token}`;

    res.json({ uploadURL, objectPath, token, direct: false, metadata: { name, r2Key } });
  });

  /**
   * Step 2 — Receive the file binary.
   * Client PUTs the raw file body here. We forward to R2 (or write to disk).
   */
  app.put(
    "/api/uploads/put/:token",
    express.raw({ type: "*/*", limit: `${MAX_FILE_SIZE_BYTES}b` }),
    async (req: any, res: any) => {
      const { token } = req.params;
      const slot = pendingUploads.get(token);

      if (!slot) {
        return res.status(400).json({ error: "Unknown or expired upload token" });
      }

      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        return res.status(400).json({ error: "Empty body" });
      }

      // Validate size
      const validation = validateFile(slot.contentType, body.length);
      if (!validation.valid) {
        pendingUploads.delete(token);
        return res.status(413).json({ error: validation.error });
      }

      try {
        await uploadFile(slot.r2Key, body, slot.contentType);
        pendingUploads.delete(token);
        res.status(200).json({ ok: true });
      } catch (err: any) {
        console.error("[uploads] Upload failed:", err);
        res.status(500).json({ error: "Upload failed: " + err.message });
      }
    }
  );

  /**
   * Serve / redirect to uploaded files.
   *
   * R2 mode:  generate a short-lived signed URL and 302 redirect
   * Dev mode: serve the file from local disk
   *
   * Uses app.use (middleware) so the path can contain slashes.
   * The key is req.path without a leading slash.
   */
  const serveHandler: RequestHandler[] = [
    ...auth,
    async (req: any, res: any, next: any) => {
      // req.path is relative to the mount point e.g. "/uuid" or "/uploads/uuid-file.pdf"
      const key = req.path.replace(/^\//, "");
      if (!key) {
        return res.status(400).json({ error: "Missing object key" });
      }

      if (isR2Configured()) {
        try {
          const signedUrl = await generateDownloadUrl(key);
          if (signedUrl) {
            return res.redirect(302, signedUrl);
          }
        } catch (err: any) {
          console.error("[uploads] Failed to generate signed URL:", err);
          return res.status(500).json({ error: "Could not generate download URL" });
        }
      }

      // Local disk fallback (dev without R2)
      const filePath = getLocalFilePath(key);
      if (!filePath) {
        return res.status(404).json({ error: "File not found" });
      }
      res.sendFile(filePath);
    },
  ];

  app.use("/objects", ...serveHandler);
}
