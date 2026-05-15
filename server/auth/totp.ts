import type { Express } from "express";
import crypto from "crypto";
import QRCode from "qrcode";
import { authStorage } from "./storage";

declare module "express-session" {
  interface SessionData {
    pendingUserId?: string;
    totpSetupRequired?: boolean;
  }
}

const ROLES_REQUIRING_2FA = ["case_worker", "admin", "superadmin"];
const APP_NAME = "PWE Portal";

// ── Pure TOTP implementation (RFC 6238) ─────────────────────────────────────

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = input.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function base32Encode(buf: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function computeTotp(secret: string, windowOffset = 0): string {
  const counter = Math.floor(Date.now() / 30000) + windowOffset;
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const digest = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = digest[digest.length - 1] & 0xf;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, "0");
}

function verifyTotp(token: string, secret: string): boolean {
  const t = token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(t)) return false;
  for (const w of [-1, 0, 1]) {
    if (computeTotp(secret, w) === t) return true;
  }
  return false;
}

function totpKeyUri(username: string, secret: string): string {
  const app = encodeURIComponent(APP_NAME);
  const user = encodeURIComponent(username);
  return `otpauth://totp/${app}:${user}?secret=${secret}&issuer=${app}&algorithm=SHA1&digits=6&period=30`;
}

// ── Exports ──────────────────────────────────────────────────────────────────

export function requires2FA(role: string): boolean {
  return ROLES_REQUIRING_2FA.includes(role);
}

export function registerTotpRoutes(app: Express) {
  // Generate TOTP secret + QR code for first-time setup
  app.post("/api/auth/2fa/generate", async (req, res) => {
    const pendingUserId = req.session.pendingUserId;
    if (!pendingUserId || !req.session.totpSetupRequired) {
      return res.status(401).json({ message: "No pending 2FA setup session" });
    }
    try {
      const user = await authStorage.getUser(pendingUserId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const secret = generateTotpSecret();
      await authStorage.updateUser(pendingUserId, { totpSecret: secret, totpEnabled: false });

      const otpauth = totpKeyUri(user.username, secret);
      const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

      res.json({ qrCodeDataUrl, secret, username: user.username });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Verify code during setup → enables 2FA + completes login
  app.post("/api/auth/2fa/verify-setup", async (req, res) => {
    const pendingUserId = req.session.pendingUserId;
    if (!pendingUserId || !req.session.totpSetupRequired) {
      return res.status(401).json({ message: "No pending 2FA setup session" });
    }
    const { code } = req.body;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ message: "Verification code is required" });
    }
    try {
      const user = await authStorage.getUser(pendingUserId);
      if (!user || !user.totpSecret) {
        return res.status(400).json({ message: "No TOTP secret found. Please go back and scan the QR code first." });
      }
      if (!verifyTotp(code, user.totpSecret)) {
        return res.status(400).json({ message: "Invalid code. Please try again — make sure your phone's clock is correct." });
      }
      await authStorage.updateUser(pendingUserId, { totpEnabled: true });
      delete req.session.totpSetupRequired;
      delete req.session.pendingUserId;
      req.session.userId = pendingUserId;

      const updatedUser = await authStorage.getUser(pendingUserId);
      const { hashedPassword, totpSecret, ...safeUser } = updatedUser!;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Verify code during login (2FA already enabled) → completes login
  app.post("/api/auth/2fa/verify", async (req, res) => {
    const pendingUserId = req.session.pendingUserId;
    if (!pendingUserId) {
      return res.status(401).json({ message: "No pending authentication session" });
    }
    const { code } = req.body;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ message: "Verification code is required" });
    }
    try {
      const user = await authStorage.getUser(pendingUserId);
      if (!user || !user.totpSecret) {
        return res.status(400).json({ message: "2FA not configured for this account" });
      }
      if (!verifyTotp(code, user.totpSecret)) {
        return res.status(400).json({ message: "Invalid code. Please check your authenticator app and try again." });
      }
      delete req.session.pendingUserId;
      req.session.userId = pendingUserId;

      const { hashedPassword, totpSecret, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
