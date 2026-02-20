import express, { type Express, type RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { authStorage } from "./replit_integrations/auth/storage";
import { insertChildSchema } from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + "-" + file.originalname);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const documentTypes = ["education", "report_cards", "attendance", "case_notes", "social_worker_notes", "follow_up_reports", "photos"] as const;

const timelineEntrySchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  entryType: z.enum(["milestone", "note", "status_change", "document", "manual"]),
});

const isNotReadOnly: RequestHandler = async (req: any, res, next) => {
  try {
    const user = req.currentUser;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role === "read_only") {
      return res.status(403).json({ message: "Read-only users cannot modify records" });
    }
    next();
  } catch {
    next();
  }
};

function getUserName(req: any): string {
  const user = req.currentUser;
  if (user?.firstName) return user.firstName;
  return user?.username || "System";
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.use("/uploads", express.static(uploadDir));

  app.get("/api/children", isAuthenticated, async (_req, res) => {
    try {
      const result = await storage.getChildren();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/children/:id", isAuthenticated, async (req, res) => {
    try {
      const child = await storage.getChild(parseInt(req.params.id));
      if (!child) return res.status(404).json({ message: "Child not found" });
      res.json(child);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/children", isAuthenticated, isNotReadOnly, async (req, res) => {
    try {
      const parsed = insertChildSchema.parse(req.body);
      const child = await storage.createChild(parsed);
      await storage.createTimelineEntry({
        childId: child.id,
        title: "Child profile created",
        description: `${child.fullName} was enrolled in the program`,
        entryType: "milestone",
        createdBy: getUserName(req),
      });
      res.status(201).json(child);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/children/:id", isAuthenticated, isNotReadOnly, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getChild(id);
      if (!existing) return res.status(404).json({ message: "Child not found" });

      const updateSchema = insertChildSchema.partial();
      const parsed = updateSchema.parse(req.body);
      const updated = await storage.updateChild(id, parsed);

      if (existing.status !== parsed.status && parsed.status) {
        await storage.createTimelineEntry({
          childId: id,
          title: `Status changed to ${parsed.status}`,
          description: `Status updated from ${existing.status} to ${parsed.status}`,
          entryType: "status_change",
          createdBy: getUserName(req),
        });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/children/:id/photo", isAuthenticated, isNotReadOnly, upload.single("photo"), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const child = await storage.getChild(id);
      if (!child) return res.status(404).json({ message: "Child not found" });
      if (!req.file) return res.status(400).json({ message: "No photo provided" });

      const photoUrl = `/uploads/${req.file.filename}`;
      const updated = await storage.updateChild(id, { photoUrl });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/children/:id", isAuthenticated, isNotReadOnly, async (req, res) => {
    try {
      await storage.deleteChild(parseInt(req.params.id));
      res.json({ message: "Deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/children/:id/documents", isAuthenticated, async (req, res) => {
    try {
      const docs = await storage.getDocumentsByChild(parseInt(req.params.id));
      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/children/:id/documents", isAuthenticated, isNotReadOnly, upload.single("file"), async (req: any, res) => {
    try {
      const childId = parseInt(req.params.id);
      const child = await storage.getChild(childId);
      if (!child) return res.status(404).json({ message: "Child not found" });
      if (!req.file) return res.status(400).json({ message: "No file provided" });

      const docType = req.body.documentType;
      if (!documentTypes.includes(docType)) {
        return res.status(400).json({ message: `Invalid document type. Must be one of: ${documentTypes.join(", ")}` });
      }

      const uploaderName = getUserName(req);
      const doc = await storage.createDocument({
        childId,
        documentType: docType,
        description: req.body.description || null,
        fileName: req.file.originalname,
        fileUrl: `/uploads/${req.file.filename}`,
        uploadedBy: uploaderName,
      });

      const typeLabels: Record<string, string> = {
        education: "Education document",
        report_cards: "Report card",
        attendance: "Attendance record",
        case_notes: "Case notes",
        social_worker_notes: "Social worker notes",
        follow_up_reports: "Follow-up report",
        photos: "Photo update",
      };
      await storage.createTimelineEntry({
        childId,
        title: `${typeLabels[docType] || "Document"} uploaded`,
        description: req.body.description || `${req.file.originalname} was uploaded`,
        entryType: "document",
        createdBy: uploaderName,
      });

      res.status(201).json(doc);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/documents/:id", isAuthenticated, isNotReadOnly, async (req, res) => {
    try {
      const { description } = req.body;
      if (typeof description !== "string") return res.status(400).json({ message: "Description is required" });
      const updated = await storage.updateDocument(parseInt(req.params.id), { description });
      if (!updated) return res.status(404).json({ message: "Document not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/documents/:id", isAuthenticated, isNotReadOnly, async (req, res) => {
    try {
      await storage.deleteDocument(parseInt(req.params.id));
      res.json({ message: "Deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/children/:id/timeline", isAuthenticated, async (req, res) => {
    try {
      const entries = await storage.getTimelineByChild(parseInt(req.params.id));
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/children/:id/timeline", isAuthenticated, isNotReadOnly, async (req: any, res) => {
    try {
      const childId = parseInt(req.params.id);
      const child = await storage.getChild(childId);
      if (!child) return res.status(404).json({ message: "Child not found" });

      const parsed = timelineEntrySchema.parse(req.body);
      const entry = await storage.createTimelineEntry({
        childId,
        title: parsed.title,
        description: parsed.description || null,
        entryType: parsed.entryType,
        createdBy: getUserName(req),
      });
      res.status(201).json(entry);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/timeline/:id", isAuthenticated, isNotReadOnly, async (req, res) => {
    try {
      const { description } = req.body;
      if (typeof description !== "string") return res.status(400).json({ message: "Description is required" });
      const updated = await storage.updateTimelineEntry(parseInt(req.params.id), { description });
      if (!updated) return res.status(404).json({ message: "Timeline entry not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/timeline/recent", isAuthenticated, async (_req, res) => {
    try {
      const entries = await storage.getRecentTimeline(10);
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/stats", isAuthenticated, async (_req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
