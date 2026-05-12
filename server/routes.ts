import express, { type Express, type RequestHandler } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, registerUserRoutes } from "./auth";
import { insertChildSchema } from "@shared/schema";
import { z } from "zod";
import { registerUploadRoutes } from "./uploads";
import { sendNewMessageNotification, isEmailConfigured } from "./services/email";
import { jobQueue } from "./services/jobs";
import { deleteFile } from "./services/storage";
import { authStorage } from "./auth/storage";

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
    if (user.role === "sponsor") {
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
  registerUserRoutes(app);
  registerUploadRoutes(app, isAuthenticated);

  // --- Slide deck (public, no auth required) ---
  app.get("/slides", (_req, res) => {
    res.sendFile(path.resolve("attached_assets/pwe-portal-overview.html"));
  });
  app.use("/slides-assets", express.static(path.resolve("attached_assets/screenshots")));

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
  app.get("/api/children/archived", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const orgId = req.query.organizationId ? parseInt(req.query.organizationId as string) : undefined;
      const result = await storage.getArchivedChildren(orgId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/children/:id/archive", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const child = await storage.getChild(id);
      if (!child) return res.status(404).json({ message: "Child not found" });
      if (child.archivedAt) return res.status(400).json({ message: "Child is already archived" });
      const updated = await storage.archiveChild(id);
      await storage.createTimelineEntry({
        childId: id,
        title: "Profile archived",
        description: `Archived by ${getUserName(req)}`,
        entryType: "status_change",
        createdBy: getUserName(req),
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/children/:id/unarchive", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const child = await storage.getChild(id);
      if (!child) return res.status(404).json({ message: "Child not found" });
      if (!child.archivedAt) return res.status(400).json({ message: "Child is not archived" });
      const updated = await storage.unarchiveChild(id);
      await storage.createTimelineEntry({
        childId: id,
        title: "Profile restored from archive",
        description: `Restored by ${getUserName(req)}`,
        entryType: "status_change",
        createdBy: getUserName(req),
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

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

  // --- Children: Excel import template ---
  app.get("/api/children/template", isAuthenticated, async (_req, res) => {
    try {
      const XLSX = await import("xlsx");

      const headers = [
        "Full Name",
        "Child ID",
        "Date of Birth (YYYY-MM-DD)",
        "Gender (male/female)",
        "Status (active/paused/exited)",
        "Location (Dale/Shanto/Boricha/Addis Ababa/Hawassa/Gillo Bisare)",
        "Is Sponsored (Yes/No)",
        "Assigned Case Worker",
        "Program Enrollment",
        "Description",
      ];

      const notes = [
        "REQUIRED — child's full name",
        "Optional — leave blank to auto-generate (e.g. C4F2A1)",
        "REQUIRED — e.g. 2015-03-22 (age is auto-calculated)",
        "REQUIRED — male or female",
        "REQUIRED — active, paused, or exited",
        "REQUIRED — must be one of the listed locations exactly",
        "Optional — Yes or No (default: No)",
        "Optional — case worker's full name",
        "Optional — organization / program name",
        "Optional — free-text background or notes",
      ];

      const sample = [
        "Abebe Girma",
        "CHD-001",
        "2014-06-15",
        "male",
        "active",
        "Boricha",
        "Yes",
        "Dawit Bekele",
        "Primary School Program",
        "Abebe is an enthusiastic learner who excels in mathematics.",
      ];

      const wsData = [headers, notes, sample];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Style the header row (bold) and notes row (italic/gray) via column widths
      ws["!cols"] = headers.map(() => ({ wch: 28 }));

      // Mark row 2 as a note row so importers can skip it
      if (!ws["!rows"]) ws["!rows"] = [];
      ws["!rows"][1] = { hidden: false };

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Children Import");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=children-import-template.xlsx");
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // --- Children: Bulk import ---
  app.post("/api/children/import", isAuthenticated, isNotReadOnly, async (req: any, res) => {
    try {
      const rows: any[] = req.body.rows;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "No rows provided" });
      }

      const results: { success: number; failed: number; errors: string[] } = {
        success: 0, failed: 0, errors: [],
      };

      const createdBy = req.currentUser
        ? `${req.currentUser.firstName || ""} ${req.currentUser.lastName || ""}`.trim() || req.currentUser.username
        : "Import";

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const childId = (row.childId && String(row.childId).trim())
            ? String(row.childId).trim()
            : `C${Date.now().toString(36).toUpperCase().slice(-6)}${i}`;
          // Convert Excel date serial numbers (e.g. 36892) to YYYY-MM-DD strings
          function excelSerialToDate(serial: number): Date {
            // Excel's epoch is Dec 30, 1899; also skip its phantom leap day (serial 60)
            const utc = (serial - (serial > 59 ? 2 : 1)) * 86400000;
            return new Date(Date.UTC(1900, 0, 1) + utc);
          }
          function normalizeDob(raw: string): string {
            const n = Number(raw);
            if (!isNaN(n) && n > 1 && n < 2958466) {
              // Looks like an Excel serial number — convert it
              const d = excelSerialToDate(n);
              const y = d.getUTCFullYear();
              const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
              const dy = String(d.getUTCDate()).padStart(2, "0");
              return `${y}-${mo}-${dy}`;
            }
            return raw;
          }
          const rawDob = row.dateOfBirth ? String(row.dateOfBirth).trim() : null;
          const dobStr = rawDob ? normalizeDob(rawDob) : null;
          function calcAgeFromDob(dob: string): number {
            const birth = new Date(dob);
            if (isNaN(birth.getTime())) return 0;
            const today = new Date();
            let age = today.getFullYear() - birth.getFullYear();
            const m = today.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
            return Math.max(0, age);
          }
          const ageFromCol = parseInt(String(row.age));
          const computedAge = !isNaN(ageFromCol) && ageFromCol > 0
            ? ageFromCol
            : dobStr ? calcAgeFromDob(dobStr) : 0;

          const parsed = {
            childId,
            fullName: String(row.fullName || "").trim(),
            dateOfBirth: dobStr,
            age: computedAge,
            gender: String(row.gender || "").toLowerCase().trim(),
            location: String(row.location || "").trim(),
            programEnrollment: row.programEnrollment ? String(row.programEnrollment).trim() : "",
            assignedSponsors: row.assignedSponsors ? String(row.assignedSponsors).trim() : null,
            assignedCaseWorker: row.assignedCaseWorker ? String(row.assignedCaseWorker).trim() : "",
            status: (["active", "paused", "exited"].includes(String(row.status).toLowerCase())
              ? String(row.status).toLowerCase()
              : "active") as "active" | "paused" | "exited",
            isSponsored: String(row.isSponsored || "").toLowerCase() === "yes",
            description: row.description ? String(row.description).trim() : "",
          };

          if (!parsed.fullName) throw new Error("Full Name is required");
          if (!parsed.location) throw new Error("Location is required");

          const child = await storage.createChild(parsed as any);
          await storage.createTimelineEntry({
            childId: child.id,
            title: "Child profile created",
            description: `${child.fullName} was enrolled via bulk import`,
            entryType: "milestone",
            createdBy,
          });
          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`Row ${i + 2}: ${err.message}`);
        }
      }

      res.json(results);
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
      if (!parsed.childId) {
        parsed.childId = `C${Date.now().toString(36).toUpperCase().slice(-6)}`;
      }
      const userOrgId = getUserOrgId(req);
      if (userOrgId !== null) {
        parsed.organizationId = userOrgId;
      }
      const child = await storage.createChild(parsed as any);
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

  // Bulk delete children by program/org — admin only
  app.delete("/api/children/bulk", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { organizationId, programName } = req.body as { organizationId?: number; programName?: string };
      const orgId = organizationId ? Number(organizationId) : undefined;
      const deleted = await storage.bulkDeleteChildren(orgId, programName);
      res.json({ deleted });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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

      const { objectPath, fileName, documentType, description, contentType, fileSize } = req.body;
      if (!objectPath || !fileName) return res.status(400).json({ message: "objectPath and fileName are required" });

      const docType = documentType;
      if (!documentTypes.includes(docType)) {
        return res.status(400).json({ message: `Invalid document type. Must be one of: ${documentTypes.join(", ")}` });
      }

      // Extract the R2 key from the objectPath (/objects/<key>)
      const fileKey = objectPath.startsWith("/objects/")
        ? objectPath.slice("/objects/".length)
        : null;

      const uploaderName = getUserName(req);
      const doc = await storage.createDocument({
        childId,
        documentType: docType,
        description: description || null,
        fileName,
        fileUrl: objectPath,
        fileKey: fileKey || null,
        mimeType: contentType || null,
        fileSize: fileSize ? parseInt(fileSize) : null,
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
      const docId = parseInt(req.params.id);
      // Fetch document first so we can clean up R2 storage
      const doc = await storage.getDocumentById(docId);
      if (doc?.fileKey) {
        jobQueue.add("delete-file", () => deleteFile(doc.fileKey!));
      }
      await storage.deleteDocument(docId);
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
      const childId = parseInt(req.params.id);
      const child = await storage.getChild(childId);
      if (!child) return res.status(404).json({ message: "Child not found" });
      if (!canAccessChild(req, child)) return res.status(403).json({ message: "Access denied" });

      // Sponsors can only comment when admin has explicitly enabled it
      if (user.role === "sponsor" && !child.sponsorCanComment) {
        return res.status(403).json({ message: "Commenting is not currently enabled for this child." });
      }

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

      // Email notification: alert admins and case workers about the new message
      if (isEmailConfigured()) {
        jobQueue.add("email-new-message", async () => {
          try {
            const admins = await authStorage.getUsersByRoles(["admin", "case_worker"]);
            for (const admin of admins) {
              if (admin.email) {
                await sendNewMessageNotification({
                  recipientEmail: admin.email,
                  recipientName:
                    admin.firstName && admin.lastName
                      ? `${admin.firstName} ${admin.lastName}`
                      : admin.username,
                  childName: child.fullName,
                  childId: child.childId,
                  senderName,
                  messagePreview: content,
                  dbChildId: childId,
                });
              }
            }
          } catch (err) {
            console.error("[email] Failed to notify about new message:", err);
          }
        });
      }

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

  app.post("/api/messages/:id/react", isAuthenticated, async (req: any, res) => {
    try {
      const { type, action } = req.body;
      if (!["like", "love"].includes(type)) {
        return res.status(400).json({ message: "Reaction type must be like or love" });
      }
      const resolvedAction: "react" | "unreact" = action === "unreact" ? "unreact" : "react";
      const updated = await storage.reactToMessage(parseInt(req.params.id), type as "like" | "love", resolvedAction);
      if (!updated) return res.status(404).json({ message: "Comment not found" });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/messages/:id/reply", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.currentUser;
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      const parentId = parseInt(req.params.id);
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Reply content is required" });

      const senderName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.username;
      const senderRole = user.role === "sponsor" ? "sponsor" : "admin";

      const reply = await storage.createMessage({
        childId: req.body.childId,
        senderName,
        senderRole,
        content: content.trim(),
        status: "pending",
        parentId,
        reactions: { like: 0, love: 0 },
      });
      res.json(reply);
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

  // --- Bulk sponsor-child assignment (admin only) ---
  // Accepts { childIds: number[] } — the complete desired set of children for this sponsor.
  // Removes sponsorUserId from any children no longer in the list, adds it to new ones.
  app.post("/api/users/:id/assign-child", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const newIds: number[] = Array.isArray(req.body.childIds) ? req.body.childIds.map(Number) : [];

      const allChildren = await storage.getChildren();
      const prevChildren = allChildren.filter((c) => c.sponsorUserId === userId);
      const prevIds = prevChildren.map((c) => c.id);

      // Remove children no longer in the new set
      for (const prevId of prevIds) {
        if (!newIds.includes(prevId)) {
          await storage.updateChild(prevId, { sponsorUserId: null });
        }
      }

      // Add newly assigned children
      for (const newId of newIds) {
        if (!prevIds.includes(newId)) {
          const child = await storage.getChild(newId);
          if (child) await storage.updateChild(newId, { sponsorUserId: userId });
        }
      }

      res.json({ message: "Child assignments updated" });
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
        childId: { label: "Child ID", getter: (c) => c.childId || "" },
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

  // --- Export: Sponsors ---
  app.post("/api/export/sponsors", isAuthenticated, async (req: any, res) => {
    try {
      if (req.currentUser?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { format = "xlsx", userIds } = req.body;
      const { db } = await import("./db");
      const { users: usersTable } = await import("@shared/models/auth");

      const allSponsors = await db.select().from(usersTable).then((all) =>
        all.filter((u) => u.role === "sponsor")
      );
      const sponsors = Array.isArray(userIds) && userIds.length > 0
        ? allSponsors.filter((s) => userIds.includes(s.id))
        : allSponsors;
      const allChildren = await storage.getChildren();

      const rows: string[][] = [];
      const headers = [
        "First Name", "Last Name", "Email", "City", "State", "Zip Code",
        "Assigned Children", "Child Ages", "Child Locations", "Child Programs", "Child Statuses",
      ];

      for (const sponsor of sponsors) {
        const assigned = allChildren.filter((c) => c.sponsorUserId === sponsor.id);
        rows.push([
          sponsor.firstName || "",
          sponsor.lastName || "",
          sponsor.email || sponsor.username,
          sponsor.city || "",
          sponsor.state || "",
          sponsor.zipCode || "",
          assigned.map((c) => c.fullName).join("; "),
          assigned.map((c) => String(c.age)).join("; "),
          assigned.map((c) => c.location).join("; "),
          assigned.map((c) => c.programEnrollment || "").join("; "),
          assigned.map((c) => c.status).join("; "),
        ]);
      }

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
        res.setHeader("Content-Disposition", "attachment; filename=sponsors-export.csv");
        res.send(csvContent);
      } else {
        const XLSX = await import("xlsx");
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sponsors");
        const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", "attachment; filename=sponsors-export.xlsx");
        res.send(buffer);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // --- Sponsors: import template ---
  app.get("/api/sponsors/template", isAuthenticated, async (req: any, res) => {
    try {
      if (req.currentUser?.role !== "admin") return res.status(403).json({ message: "Admin access required" });
      const XLSX = await import("xlsx");
      const headers = ["Email Address", "Password", "First Name", "Last Name", "Street Address 1", "Street Address 2", "City", "State", "Zip Code", "Country"];
      const notes = ["REQUIRED — used as login username", "REQUIRED — min 6 chars", "Optional", "Optional", "Optional", "Optional", "Optional", "Optional", "Optional", "Optional"];
      const sample = ["rachel.johnson@example.com", "Welcome1!", "Rachel", "Johnson", "123 Maple St", "", "Nashville", "TN", "37201", "USA"];
      const ws = XLSX.utils.aoa_to_sheet([headers, notes, sample]);
      ws["!cols"] = headers.map(() => ({ wch: 26 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sponsor Import");
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=sponsors-import-template.xlsx");
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // --- Sponsors: bulk import ---
  app.post("/api/import/sponsors", isAuthenticated, async (req: any, res) => {
    try {
      if (req.currentUser?.role !== "admin") return res.status(403).json({ message: "Admin access required" });
      const rows: any[] = req.body.rows;
      if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ message: "No rows provided" });
      const bcrypt = await import("bcryptjs");
      const results = { success: 0, failed: 0, errors: [] as string[] };
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        try {
          const username = String(row.username || "").trim();
          const password = String(row.password || "").trim();
          if (!username) throw new Error("Email Address is required");
          if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");
          const existing = await authStorage.getUserByUsername(username);
          if (existing) throw new Error(`${username} already exists`);
          const hashedPassword = await bcrypt.hash(password, 10);
          await authStorage.createUser({
            username,
            hashedPassword,
            firstName: row.firstName ? String(row.firstName).trim() : null,
            lastName: row.lastName ? String(row.lastName).trim() : null,
            email: username,
            role: "sponsor",
            streetAddress1: row.streetAddress1 ? String(row.streetAddress1).trim() : null,
            streetAddress2: row.streetAddress2 ? String(row.streetAddress2).trim() : null,
            city: row.city ? String(row.city).trim() : null,
            state: row.state ? String(row.state).trim() : null,
            zipCode: row.zipCode ? String(row.zipCode).trim() : null,
            country: row.country ? String(row.country).trim() : null,
          });
          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`Row ${i + 2}: ${err.message}`);
        }
      }
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // --- Admin: test email endpoint ---
  app.post("/api/admin/test-email", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.currentUser;
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { sendTestEmail } = await import("./services/email");
      const toEmail = req.body?.email || user.email;
      if (!toEmail) {
        return res.status(400).json({ message: "No email address provided and current user has no email set" });
      }
      const result = await sendTestEmail(toEmail);
      res.json({ success: result.success, id: result.id, error: result.error });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // --- Newsletters ---
  app.get("/api/newsletters", isAuthenticated, async (_req, res) => {
    try {
      const items = await storage.getNewsletters();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/newsletters", isAuthenticated, isAdmin, express.json(), async (req: any, res) => {
    try {
      const { objectPath, fileName, title, contentType, fileSize, targetProgram } = req.body;
      if (!objectPath || !fileName || !title) {
        return res.status(400).json({ message: "objectPath, fileName and title are required" });
      }
      const fileKey = objectPath.startsWith("/objects/") ? objectPath.slice("/objects/".length) : null;
      const nl = await storage.createNewsletter({
        title,
        fileName,
        fileUrl: objectPath,
        fileKey: fileKey || null,
        mimeType: contentType || null,
        fileSize: fileSize ? parseInt(fileSize) : null,
        targetProgram: targetProgram || null,
        uploadedBy: getUserName(req),
      });
      res.status(201).json(nl);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/newsletters/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const items = await storage.getNewsletters();
      const nl = items.find((n) => n.id === id);
      if (nl?.fileKey) {
        jobQueue.add("delete-file", () => deleteFile(nl.fileKey!));
      }
      await storage.deleteNewsletter(id);
      res.json({ message: "Deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // --- Billing (admin only) ---
  // GET /api/billing/status — returns subscription info for the admin's org
  app.get("/api/billing/status", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const user = req.currentUser;
      // Allow overriding the lookup email via query param (admin only)
      const email = (req.query.email as string) || user.email || user.username;

      // Find customer by email
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (!customers.data.length) {
        return res.json({ subscribed: false, customer: null, subscription: null, lookupEmail: email });
      }

      const customer = customers.data[0];
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 1,
        expand: ["data.default_payment_method", "data.items.data.price.product"],
      });

      const sub = subscriptions.data[0] || null;
      res.json({
        subscribed: sub ? ["active", "trialing"].includes(sub.status) : false,
        customer: { id: customer.id, email: customer.email, name: customer.name },
        subscription: sub
          ? {
              id: sub.id,
              status: sub.status,
              currentPeriodEnd: (sub as any).current_period_end,
              cancelAtPeriodEnd: sub.cancel_at_period_end,
              planName: (sub.items.data[0]?.price?.product as any)?.name || "Subscription",
              amount: sub.items.data[0]?.price?.unit_amount,
              currency: sub.items.data[0]?.price?.currency,
              interval: sub.items.data[0]?.price?.recurring?.interval,
              paymentMethod: (sub as any).default_payment_method
                ? {
                    brand: (sub as any).default_payment_method?.card?.brand,
                    last4: (sub as any).default_payment_method?.card?.last4,
                    expMonth: (sub as any).default_payment_method?.card?.exp_month,
                    expYear: (sub as any).default_payment_method?.card?.exp_year,
                  }
                : null,
            }
          : null,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // POST /api/billing/portal — create a Stripe Customer Portal session
  app.post("/api/billing/portal", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const { getUncachableStripeClient } = await import("./stripeClient");
      const stripe = await getUncachableStripeClient();
      const user = req.currentUser;
      const email = user.email || user.username;

      // Find or create customer
      let customerId: string;
      const customers = await stripe.customers.list({ email, limit: 1 });
      if (customers.data.length) {
        customerId = customers.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email,
          name: [user.firstName, user.lastName].filter(Boolean).join(" ") || email,
        });
        customerId = customer.id;
      }

      // Prefer explicit APP_URL env var (set this on Render/production to your real domain)
      // Fall back to Replit domain, then request origin, then localhost
      const appUrl =
        process.env.APP_URL?.replace(/\/$/, "") ||
        (process.env.REPLIT_DOMAINS
          ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
          : null) ||
        `${req.protocol}://${req.get("host")}`;

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/billing`,
      });

      res.json({ url: session.url });
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
      // Look up org name so stats can match by programEnrollment text as well as FK
      let programName: string | undefined;
      if (orgId) {
        const org = await storage.getOrganization(orgId);
        if (org) programName = org.name;
      }
      const stats = await storage.getStats(orgId, programName);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
