/**
 * Local disk file storage — platform-agnostic replacement for cloud object storage.
 *
 * Upload flow:
 *   1. Client: POST /api/uploads/request-url  → { uploadURL, objectPath }
 *   2. Client: PUT <uploadURL>   (raw binary body)
 *   3. Client: POST /api/children/:id/photo   with { objectPath }
 *
 * Files are stored under UPLOADS_DIR (default: ./uploads).
 * Objects are served at GET /objects/:token.
 *
 * To use S3/MinIO in the future, replace the PUT handler and GET handler
 * with signed URL generation and redirect/proxy logic respectively.
 */

import express, { type Express, type RequestHandler } from "express";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";

const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), "uploads");

const MAX_FILE_SIZE_BYTES = parseInt(process.env.MAX_UPLOAD_SIZE_MB || "20", 10) * 1024 * 1024;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export function registerUploadRoutes(app: Express, authMiddleware?: RequestHandler): void {
  ensureUploadsDir();

  const auth: RequestHandler[] = authMiddleware ? [authMiddleware] : [];

  /**
   * Step 1 — request an upload slot.
   * Returns a PUT URL pointing back at this server and an objectPath to store in the DB.
   */
  app.post("/api/uploads/request-url", ...auth, (req: any, res: any) => {
    const { name } = req.body ?? {};
    if (!name) {
      return res.status(400).json({ error: "Missing required field: name" });
    }

    const token = randomUUID();
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const uploadURL = `${proto}://${host}/api/uploads/put/${token}`;
    const objectPath = `/objects/${token}`;

    res.json({ uploadURL, objectPath, metadata: { name } });
  });

  /**
   * Step 2 — receive the file.
   * The client PUTs the raw binary (matching the GCS presigned-URL contract).
   * We save it to UPLOADS_DIR under the token name.
   */
  app.put(
    "/api/uploads/put/:token",
    express.raw({ type: "*/*", limit: `${MAX_FILE_SIZE_BYTES}b` }),
    (req: any, res: any) => {
      const { token } = req.params;
      if (!UUID_RE.test(token)) {
        return res.status(400).json({ error: "Invalid upload token" });
      }

      ensureUploadsDir();
      const filePath = path.join(UPLOADS_DIR, token);
      try {
        fs.writeFileSync(filePath, req.body as Buffer);
        res.status(200).end();
      } catch (err) {
        console.error("File write error:", err);
        res.status(500).json({ error: "Upload failed" });
      }
    }
  );

  /**
   * Serve uploaded files — requires auth so only logged-in users can access.
   * Strip the leading /objects/ prefix to get the token, then serve from disk.
   */
  app.get("/objects/:token", ...auth, (req: any, res: any) => {
    const { token } = req.params;
    if (!UUID_RE.test(token)) {
      return res.status(400).json({ error: "Invalid token" });
    }

    const filePath = path.join(UPLOADS_DIR, token);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    res.sendFile(filePath);
  });
}
