import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, serial, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const children = pgTable("children", {
  id: serial("id").primaryKey(),
  childId: varchar("child_id", { length: 20 }).notNull().unique(),
  fullName: text("full_name").notNull(),
  age: integer("age").notNull(),
  gender: varchar("gender", { length: 20 }).notNull(),
  location: text("location").notNull(),
  programEnrollment: text("program_enrollment").notNull(),
  assignedSponsors: text("assigned_sponsors"),
  assignedCaseWorker: text("assigned_case_worker").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  photoUrl: text("photo_url"),
  description: text("description"),
  isSponsored: boolean("is_sponsored").notNull().default(false),
  sponsorPhotoUrl: text("sponsor_photo_url"),
  organizationId: integer("organization_id").references(() => organizations.id, { onDelete: "set null" }),
  sponsorUserId: varchar("sponsor_user_id"),
  sponsorCanComment: boolean("sponsor_can_comment").notNull().default(false),
  archivedAt: timestamp("archived_at"),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  documentType: varchar("document_type", { length: 50 }).notNull(),
  description: text("description"),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  /** R2 object key — used to generate signed download URLs and delete from storage */
  fileKey: text("file_key"),
  /** Original MIME type recorded at upload time */
  mimeType: varchar("mime_type", { length: 100 }),
  /** File size in bytes */
  fileSize: integer("file_size"),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const timelineEntries = pgTable("timeline_entries", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  entryType: varchar("entry_type", { length: 50 }).notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  senderName: text("sender_name").notNull(),
  senderRole: varchar("sender_role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  parentId: integer("parent_id"),
  reactions: jsonb("reactions").$type<{ like: number; love: number }>().default({ like: 0, love: 0 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizationsRelations = relations(organizations, ({ many }) => ({
  children: many(children),
}));

export const childrenRelations = relations(children, ({ many, one }) => ({
  documents: many(documents),
  timelineEntries: many(timelineEntries),
  messages: many(messages),
  organization: one(organizations, { fields: [children.organizationId], references: [organizations.id] }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  child: one(children, { fields: [documents.childId], references: [children.id] }),
}));

export const timelineEntriesRelations = relations(timelineEntries, ({ one }) => ({
  child: one(children, { fields: [timelineEntries.childId], references: [children.id] }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  child: one(children, { fields: [messages.childId], references: [children.id] }),
}));

export const insertOrganizationSchema = createInsertSchema(organizations).omit({
  id: true,
  createdAt: true,
});

export const insertChildSchema = createInsertSchema(children).omit({
  id: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

export const insertTimelineEntrySchema = createInsertSchema(timelineEntries).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizations.$inferSelect;
export type InsertChild = z.infer<typeof insertChildSchema>;
export type Child = typeof children.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertTimelineEntry = z.infer<typeof insertTimelineEntrySchema>;
export type TimelineEntry = typeof timelineEntries.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;
