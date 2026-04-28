import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./session";
import { createUserSchema, updateUserSchema } from "@shared/models/auth";
import bcrypt from "bcryptjs";
import { sendUserWelcomeEmail } from "../services/email";
import { jobQueue } from "../services/jobs";

const isAdmin = async (req: any, res: any, next: any) => {
  if (req.currentUser?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

export function registerUserRoutes(app: Express): void {
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
}
