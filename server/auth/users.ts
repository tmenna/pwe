import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./session";
import { createUserSchema, updateUserSchema } from "@shared/models/auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendUserWelcomeEmail, sendAdminPasswordResetEmail, sendTestEmail, sendPasswordResetEmail } from "../services/email";
import { jobQueue } from "../services/jobs";

// In-memory store for password reset tokens: token → { userId, expiry }
const resetTokens = new Map<string, { userId: string; expiry: number }>();
// Clean up expired tokens every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of resetTokens.entries()) {
    if (data.expiry < now) resetTokens.delete(token);
  }
}, 15 * 60 * 1000);

function generateRandomPassword(): string {
  const upper  = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower  = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick   = (s: string) => s[Math.floor(Math.random() * s.length)];
  const parts  = [
    pick(upper), pick(upper),
    pick(lower), pick(lower), pick(lower), pick(lower),
    pick(digits), pick(digits), pick(digits), pick(digits),
    "!",
  ];
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }
  return parts.join("");
}

const isAdmin = async (req: any, res: any, next: any) => {
  if (req.currentUser?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

export function registerUserRoutes(app: Express): void {
  // ── Public: forgot password — generates a temporary password and emails it ─
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { username } = req.body;
      if (!username) return res.status(400).json({ message: "Username is required" });

      const user = await authStorage.getUserByUsername(username.trim());
      if (user) {
        const recipientEmail = user.email || (user.username.includes("@") ? user.username : null);
        if (recipientEmail) {
          const tempPassword = generateRandomPassword();
          const hashedPassword = await bcrypt.hash(tempPassword, 10);
          await authStorage.updateUser(user.id, { hashedPassword });
          const name = user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.username;
          await sendAdminPasswordResetEmail({
            recipientEmail,
            recipientName: name,
            username: user.username,
            newPassword: tempPassword,
          });
          console.log(`[forgot-password] Temporary password sent to ${recipientEmail}`);
        }
      }
      // Always return success — never reveal whether account exists
      res.json({ message: "If that username has an email address on file, a temporary password has been sent." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ── Public: complete password reset with token ─────────────────────────
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ message: "Token and new password are required" });
      if (newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

      const data = resetTokens.get(token);
      if (!data || data.expiry < Date.now()) {
        return res.status(400).json({ message: "This reset link is invalid or has expired. Please request a new one." });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await authStorage.updateUser(data.userId, { hashedPassword });
      resetTokens.delete(token);
      console.log(`[reset-password] Password reset successfully for userId ${data.userId}`);
      res.json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Self-service: any logged-in user can update their own username and/or password
  app.patch("/api/auth/profile", isAuthenticated, async (req: any, res) => {
    try {
      const { username, currentPassword, newPassword } = req.body;
      const user = req.currentUser;

      // If changing password, verify the current password first
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ message: "Current password is required to set a new password" });
        }
        const valid = await bcrypt.compare(currentPassword, user.hashedPassword);
        if (!valid) {
          return res.status(401).json({ message: "Current password is incorrect" });
        }
        if (newPassword.length < 6) {
          return res.status(400).json({ message: "New password must be at least 6 characters" });
        }
      }

      const updateData: any = {};

      if (username && username !== user.username) {
        const existing = await authStorage.getUserByUsername(username);
        if (existing) {
          return res.status(409).json({ message: "That username is already taken" });
        }
        updateData.username = username;
      }

      if (newPassword) {
        updateData.hashedPassword = await bcrypt.hash(newPassword, 10);
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No changes provided" });
      }

      const updated = await authStorage.updateUser(user.id, updateData);
      if (!updated) return res.status(404).json({ message: "User not found" });

      const { hashedPassword, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Self-service: any logged-in user can update their own profile photo
  app.patch("/api/auth/profile/photo", isAuthenticated, async (req: any, res) => {
    try {
      const { objectPath } = req.body;
      if (!objectPath) return res.status(400).json({ message: "objectPath is required" });
      const photoUrl = objectPath.startsWith("/objects/") ? objectPath : `/objects/${objectPath}`;
      const updated = await authStorage.updateUser(req.currentUser.id, { photoUrl });
      if (!updated) return res.status(404).json({ message: "User not found" });
      const { hashedPassword, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const { hashedPassword, ...safeUser } = req.currentUser;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/users", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const allUsers = await authStorage.getAllUsers();
      const safeUsers = allUsers.map(({ hashedPassword, ...u }) => u);
      res.json(safeUsers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/users", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const parsed = createUserSchema.parse(req.body);
      const existing = await authStorage.getUserByUsername(parsed.username);
      if (existing) {
        return res.status(409).json({ message: "Username already exists" });
      }
      const hashedPassword = await bcrypt.hash(parsed.password, 10);
      const user = await authStorage.createUser({
        username: parsed.username,
        hashedPassword,
        firstName: parsed.firstName || null,
        lastName: parsed.lastName || null,
        email: parsed.email || null,
        role: parsed.role,
        organizationId: parsed.organizationId || null,
      });
      const { hashedPassword: _, ...safeUser } = user;

      // Send welcome email if the new user has an email address
      if (user.email) {
        jobQueue.add("email-welcome", () =>
          sendUserWelcomeEmail({
            recipientEmail: user.email!,
            recipientName:
              user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.username,
            username: user.username,
            temporaryPassword: parsed.password,
            role: user.role,
          })
        );
      }

      res.status(201).json(safeUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const parsed = updateUserSchema.parse(req.body);
      const updateData: any = {};
      if (parsed.username !== undefined) {
        const existing = await authStorage.getUserByUsername(parsed.username);
        if (existing && existing.id !== req.params.id) {
          return res.status(409).json({ message: "Username already exists" });
        }
        updateData.username = parsed.username;
      }
      if (parsed.firstName !== undefined) updateData.firstName = parsed.firstName;
      if (parsed.lastName !== undefined) updateData.lastName = parsed.lastName;
      if (parsed.email !== undefined) updateData.email = parsed.email;
      if (parsed.role !== undefined) updateData.role = parsed.role;
      if (parsed.organizationId !== undefined) updateData.organizationId = parsed.organizationId;
      if (parsed.password) {
        updateData.hashedPassword = await bcrypt.hash(parsed.password, 10);
      }
      const user = await authStorage.updateUser(req.params.id, updateData);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { hashedPassword, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/users/:id", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      if (req.params.id === req.currentUser.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      await authStorage.deleteUser(req.params.id);
      res.json({ message: "User deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin utility: send a test email to verify Resend is working
  app.post("/api/admin/test-email", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const to = "teki.menna@gmail.com";
      const result = await sendTestEmail(to);
      if (result.success) {
        res.json({ message: `Test email sent to ${to}`, email: to });
      } else {
        res.status(500).json({ message: `Failed to send: ${result.error}`, email: to });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/users/:id/reset-password", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const user = await authStorage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const newPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await authStorage.updateUser(req.params.id, { hashedPassword });

      let emailSent = false;
      let emailError: string | undefined;
      const recipientEmail = user.email || user.username;
      if (recipientEmail && recipientEmail.includes("@")) {
        console.log(`[reset-password] Sending to ${recipientEmail} for user ${user.username}`);
        const result = await sendAdminPasswordResetEmail({
          recipientEmail,
          recipientName: user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.username,
          username: user.username,
          newPassword,
        });
        emailSent = result.success;
        emailError = result.error;
        if (!emailSent) {
          console.error(`[reset-password] Email failed for ${recipientEmail}: ${emailError}`);
        } else {
          console.log(`[reset-password] Email sent successfully to ${recipientEmail} — id: ${result.id}`);
        }
      } else {
        console.warn(`[reset-password] No valid email for user ${user.username} — skipping email`);
      }

      res.json({ newPassword, emailSent, emailError, email: recipientEmail });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}
