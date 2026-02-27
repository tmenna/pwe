import express, { type Express, type RequestHandler } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerAuthRoutes } from "./replit_integrations/auth";
import { insertChildSchema } from "@shared/schema";
import { z } from "zod";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";

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
    if (user.role === "read_only" || user.role === "sponsor") {
      return res.status(403).json({ message: "You do not have permission to modify records" });
    }
    next();
  } catch {
    next();
  }
};

const isAdmin: RequestHandler = async (req: any, res, next) => {
  try {
    const user = req.currentUser;
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    if (user.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
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

function getUserOrgId(req: any): number | null {
  const user = req.currentUser;
  if (!user || user.role === "admin" || user.role === "sponsor") return null;
  return user.organizationId || null;
}

function canAccessChild(req: any, child: { organizationId: number | null; sponsorUserId?: string | null }): boolean {
  const user = req.currentUser;
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role === "sponsor") {
    return child.sponsorUserId === user.id;
  }
  const userOrgId = getUserOrgId(req);
  if (userOrgId === null) return true;
  return child.organizationId === userOrgId;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);
  registerObjectStorageRoutes(app, isAuthenticated);

  // --- Organizations ---
  app.get("/api/organizations", isAuthenticated, async (_req, res) => {
    try {
      const result = await storage.getOrganizations();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/organizations/:id", isAuthenticated, async (req, res) => {
    try {
      const org = await storage.getOrganization(parseInt(req.params.id));
      if (!org) return res.status(404).json({ message: "Organization not found" });
      res.json(org);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/organizations", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const { name, description } = req.body;
      if (!name) return res.status(400).json({ message: "Name is required" });
      const org = await storage.createOrganization({ name, description: description || null });
      res.status(201).json(org);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/organizations/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, description } = req.body;
      const updated = await storage.updateOrganization(id, { name, description });
      if (!updated) return res.status(404).json({ message: "Organization not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/organizations/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      await storage.deleteOrganization(parseInt(req.params.id));
      res.json({ message: "Deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // --- Children ---
  app.get("/api/children", isAuthenticated, async (req: any, res) => {
    try {
      if (req.currentUser?.role === "sponsor") {
        const all = await storage.getChildren();
        const filtered = all.filter((c) => c.sponsorUserId === req.currentUser.id);
        return res.json(filtered);
      }
      let orgId = req.query.organizationId ? parseInt(req.query.organizationId as string) : undefined;
      if (req.currentUser?.role !== "admin" && req.currentUser?.organizationId) {
        orgId = req.currentUser.organizationId;
      }
      const result = await storage.getChildren(orgId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/children/:id", isAuthenticated, async (req: any, res) => {
    try {
      const child = await storage.getChild(parseInt(req.params.id));
      if (!child) return res.status(404).json({ message: "Child not found" });
      if (!canAccessChild(req, child)) return res.status(403).json({ message: "Access denied" });
      res.json(child);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/children", isAuthenticated, isNotReadOnly, async (req: any, res) => {
    try {
      const parsed = insertChildSchema.parse(req.body);
      const userOrgId = getUserOrgId(req);
      if (userOrgId !== null) {
        parsed.organizationId = userOrgId;
      }
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

  app.patch("/api/children/:id", isAuthenticated, isNotReadOnly, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getChild(id);
      if (!existing) return res.status(404).json({ message: "Child not found" });
      if (!canAccessChild(req, existing)) return res.status(403).json({ message: "Access denied" });

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

  app.post("/api/children/:id/photo", isAuthenticated, isNotReadOnly, express.json(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const child = await storage.getChild(id);
      if (!child) return res.status(404).json({ message: "Child not found" });
      if (!canAccessChild(req, child)) return res.status(403).json({ message: "Access denied" });

      const { objectPath } = req.body;
      if (!objectPath) return res.status(400).json({ message: "No objectPath provided" });

      const updated = await storage.updateChild(id, { photoUrl: objectPath });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/children/:id/sponsor-photo", isAuthenticated, isNotReadOnly, express.json(), async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const child = await storage.getChild(id);
      if (!child) return res.status(404).json({ message: "Child not found" });
      if (!canAccessChild(req, child)) return res.status(403).json({ message: "Access denied" });

      const { objectPath } = req.body;
      if (!objectPath) return res.status(400).json({ message: "No objectPath provided" });

      const updated = await storage.updateChild(id, { sponsorPhotoUrl: objectPath });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/children/:id", isAuthenticated, isNotReadOnly, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const child = await storage.getChild(id);
      if (!child) return res.status(404).json({ message: "Child not found" });
      if (!canAccessChild(req, child)) return res.status(403).json({ message: "Access denied" });
      await storage.deleteChild(id);
      res.json({ message: "Deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // --- Documents ---
  app.get("/api/children/:id/documents", isAuthenticated, async (req: any, res) => {
    try {
      const childId = parseInt(req.params.id);
      const child = await storage.getChild(childId);
      if (!child) return res.status(404).json({ message: "Child not found" });
      if (!canAccessChild(req, child)) return res.status(403).json({ message: "Access denied" });
      const docs = await storage.getDocumentsByChild(childId);
      res.json(docs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/children/:id/documents", isAuthenticated, isNotReadOnly, express.json(), async (req: any, res) => {
    try {
      const childId = parseInt(req.params.id);
      const child = await storage.getChild(childId);
      if (!child) return res.status(404).json({ message: "Child not found" });
      if (!canAccessChild(req, child)) return res.status(403).json({ message: "Access denied" });

      const { objectPath, fileName, documentType, description } = req.body;
      if (!objectPath || !fileName) return res.status(400).json({ message: "objectPath and fileName are required" });

      const docType = documentType;
      if (!documentTypes.includes(docType)) {
        return res.status(400).json({ message: `Invalid document type. Must be one of: ${documentTypes.join(", ")}` });
      }

      const uploaderName = getUserName(req);
      const doc = await storage.createDocument({
        childId,
        documentType: docType,
        description: description || null,
        fileName,
        fileUrl: objectPath,
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
        description: description || `${fileName} was uploaded`,
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

  // --- Timeline ---
  app.get("/api/children/:id/timeline", isAuthenticated, async (req: any, res) => {
    try {
      const childId = parseInt(req.params.id);
      const child = await storage.getChild(childId);
      if (!child) return res.status(404).json({ message: "Child not found" });
      if (!canAccessChild(req, child)) return res.status(403).json({ message: "Access denied" });
      const entries = await storage.getTimelineByChild(childId);
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
      if (!canAccessChild(req, child)) return res.status(403).json({ message: "Access denied" });

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

  // --- Messages ---
  app.get("/api/children/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const childId = parseInt(req.params.id);
      const child = await storage.getChild(childId);
      if (!child) return res.status(404).json({ message: "Child not found" });
      if (!canAccessChild(req, child)) return res.status(403).json({ message: "Access denied" });
      const msgs = await storage.getMessagesByChild(childId);
      res.json(msgs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/children/:id/messages", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.currentUser;
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      if (user.role === "read_only") return res.status(403).json({ message: "Read-only users cannot send messages" });

      const childId = parseInt(req.params.id);
      const child = await storage.getChild(childId);
      if (!child) return res.status(404).json({ message: "Child not found" });
      if (!canAccessChild(req, child)) return res.status(403).json({ message: "Access denied" });

      let { senderName, senderRole, content } = req.body;
      if (user.role === "sponsor") {
        senderName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.username;
        senderRole = "sponsor";
      }
      if (!senderName || !content) return res.status(400).json({ message: "senderName and content are required" });
      if (!["sponsor", "admin"].includes(senderRole)) return res.status(400).json({ message: "senderRole must be 'sponsor' or 'admin'" });

      const msg = await storage.createMessage({
        childId,
        senderName,
        senderRole,
        content,
        status: "pending",
      });
      res.status(201).json(msg);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/messages/:id", isAuthenticated, isNotReadOnly, async (req, res) => {
    try {
      const { status } = req.body;
      if (!["pending", "delivered", "read"].includes(status)) {
        return res.status(400).json({ message: "Status must be pending, delivered, or read" });
      }
      const updated = await storage.updateMessageStatus(parseInt(req.params.id), status);
      if (!updated) return res.status(404).json({ message: "Message not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/messages/:id", isAuthenticated, isNotReadOnly, async (req, res) => {
    try {
      await storage.deleteMessage(parseInt(req.params.id));
      res.json({ message: "Deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/messages/pending", isAuthenticated, async (_req, res) => {
    try {
      const msgs = await storage.getPendingMessages();
      res.json(msgs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // --- Export ---
  app.post("/api/export/children", isAuthenticated, async (req: any, res) => {
    try {
      const { fields, organizationId, format } = req.body;
      if (!fields || !Array.isArray(fields) || fields.length === 0) {
        return res.status(400).json({ message: "At least one field must be selected" });
      }

      let orgId = organizationId ? parseInt(organizationId) : undefined;
      if (req.currentUser?.role !== "admin" && req.currentUser?.organizationId) {
        orgId = req.currentUser.organizationId;
      }
      const allChildren = await storage.getChildren(orgId);

      const fieldMap: Record<string, { label: string; getter: (c: any) => string }> = {
        childId: { label: "Child ID", getter: (c) => c.childId },
        fullName: { label: "Full Name", getter: (c) => c.fullName },
        age: { label: "Age", getter: (c) => String(c.age) },
        gender: { label: "Gender", getter: (c) => c.gender },
        location: { label: "Location", getter: (c) => c.location },
        programEnrollment: { label: "Program", getter: (c) => c.programEnrollment },
        assignedSponsors: { label: "Sponsor(s)", getter: (c) => c.assignedSponsors || "" },
        assignedCaseWorker: { label: "Case Worker", getter: (c) => c.assignedCaseWorker },
        status: { label: "Status", getter: (c) => c.status },
        isSponsored: { label: "Sponsored", getter: (c) => c.isSponsored ? "Yes" : "No" },
      };

      const validFields = fields.filter((f: string) => fieldMap[f]);
      const headers = validFields.map((f: string) => fieldMap[f].label);
      const rows = allChildren.map((child) =>
        validFields.map((f: string) => fieldMap[f].getter(child))
      );

      if (format === "csv") {
        const escapeCsv = (val: string) => {
          if (val.includes(",") || val.includes('"') || val.includes("\n")) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        };
        const csvContent = [
          headers.map(escapeCsv).join(","),
          ...rows.map((row) => row.map(escapeCsv).join(",")),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=children-export.csv");
        res.send(csvContent);
      } else {
        const XLSX = await import("xlsx");
        const wsData = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Children");
        const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=children-export.xlsx");
        res.send(buffer);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // --- Stats ---
  app.get("/api/stats", isAuthenticated, async (req: any, res) => {
    try {
      if (req.currentUser?.role === "sponsor") {
        const all = await storage.getChildren();
        const assigned = all.filter((c) => c.sponsorUserId === req.currentUser.id);
        return res.json({
          totalChildren: assigned.length,
          active: assigned.filter((c) => c.status === "active").length,
          paused: assigned.filter((c) => c.status === "paused").length,
          exited: assigned.filter((c) => c.status === "exited").length,
          totalDocuments: 0,
          sponsored: assigned.filter((c) => c.isSponsored).length,
          nonSponsored: assigned.filter((c) => !c.isSponsored).length,
        });
      }
      let orgId = req.query.organizationId ? parseInt(req.query.organizationId as string) : undefined;
      if (req.currentUser?.role !== "admin" && req.currentUser?.organizationId) {
        orgId = req.currentUser.organizationId;
      }
      const stats = await storage.getStats(orgId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
