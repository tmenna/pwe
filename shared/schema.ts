import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

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
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => children.id, { onDelete: "cascade" }),
  documentType: varchar("document_type", { length: 50 }).notNull(),
  description: text("description"),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
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

export const childrenRelations = relations(children, ({ many }) => ({
  documents: many(documents),
  timelineEntries: many(timelineEntries),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  child: one(children, { fields: [documents.childId], references: [children.id] }),
}));

export const timelineEntriesRelations = relations(timelineEntries, ({ one }) => ({
  child: one(children, { fields: [timelineEntries.childId], references: [children.id] }),
}));

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

export type InsertChild = z.infer<typeof insertChildSchema>;
export type Child = typeof children.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertTimelineEntry = z.infer<typeof insertTimelineEntrySchema>;
export type TimelineEntry = typeof timelineEntries.$inferSelect;
