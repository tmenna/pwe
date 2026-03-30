import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { authStorage } from "./storage";
import { loginSchema } from "@shared/models/auth";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

async function verifyRecaptcha(token: string): Promise<boolean> {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) return true;

  try {
    const response = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`,
      { method: "POST" }
    );
    const data = await response.json() as { success: boolean; score?: number; action?: string };
    if (!data.success) return false;
    if (data.action && data.action !== "login") return false;
    if (data.score !== undefined && data.score < 0.5) return false;
    return true;
  } catch (error) {
    console.error("reCAPTCHA verification error:", error);
    return false;
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  app.get("/api/config/recaptcha", (_req, res) => {
    const siteKey = process.env.RECAPTCHA_SITE_KEY || "";
    res.json({ siteKey });
  });

  app.post("/api/login", async (req, res) => {
    try {
      const parsed = loginSchema.parse(req.body);

      const recaptchaToken = req.body.recaptchaToken;
      if (process.env.RECAPTCHA_SECRET_KEY) {
        if (!recaptchaToken) {
          return res.status(400).json({ message: "Bot verification failed. Please try again." });
        }
        const isHuman = await verifyRecaptcha(recaptchaToken);
        if (!isHuman) {
          return res.status(403).json({ message: "Bot verification failed. Please try again." });
        }
      }

      const user = await authStorage.getUserByUsername(parsed.username);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      const valid = await bcrypt.compare(parsed.password, user.hashedPassword);
      if (!valid) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      req.session.userId = user.id;
      const { hashedPassword, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const user = await authStorage.getUser(req.session.userId);
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  (req as any).currentUser = user;
  next();
};
