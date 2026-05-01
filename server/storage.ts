import {
  children, documents, timelineEntries, organizations, messages,
  type Child, type InsertChild,
  type Document, type InsertDocument,
  type TimelineEntry, type InsertTimelineEntry,
  type Organization, type InsertOrganization,
  type Message, type InsertMessage,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, count, and } from "drizzle-orm";

export interface IStorage {
  getOrganizations(): Promise<Organization[]>;
  getOrganization(id: number): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: number, org: Partial<InsertOrganization>): Promise<Organization | undefined>;
  deleteOrganization(id: number): Promise<void>;

  getChildren(organizationId?: number): Promise<Child[]>;
  getChild(id: number): Promise<Child | undefined>;
  createChild(child: InsertChild): Promise<Child>;
  updateChild(id: number, child: Partial<InsertChild>): Promise<Child | undefined>;
  deleteChild(id: number): Promise<void>;

  getDocumentsByChild(childId: number): Promise<Document[]>;
  getDocumentById(id: number): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: number, data: { description: string }): Promise<Document | undefined>;
  deleteDocument(id: number): Promise<void>;

  getTimelineByChild(childId: number): Promise<TimelineEntry[]>;
  getRecentTimeline(limit?: number): Promise<TimelineEntry[]>;
  createTimelineEntry(entry: InsertTimelineEntry): Promise<TimelineEntry>;
  updateTimelineEntry(id: number, data: { description: string }): Promise<TimelineEntry | undefined>;

  getMessagesByChild(childId: number): Promise<Message[]>;
  getPendingMessages(): Promise<Message[]>;
  createMessage(msg: InsertMessage): Promise<Message>;
  updateMessageStatus(id: number, status: string): Promise<Message | undefined>;
  deleteMessage(id: number): Promise<void>;
  reactToMessage(id: number, type: "like" | "love"): Promise<Message | undefined>;

  getStats(organizationId?: number): Promise<{ totalChildren: number; active: number; paused: number; exited: number; totalDocuments: number; sponsored: number; nonSponsored: number }>;
}

export class DatabaseStorage implements IStorage {
  async getOrganizations(): Promise<Organization[]> {
    return db.select().from(organizations).orderBy(desc(organizations.id));
  }

  async getOrganization(id: number): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org || undefined;
  }

  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const [created] = await db.insert(organizations).values(org).returning();
    return created;
  }

  async updateOrganization(id: number, org: Partial<InsertOrganization>): Promise<Organization | undefined> {
    const [updated] = await db.update(organizations).set(org).where(eq(organizations.id, id)).returning();
    return updated || undefined;
  }

  async deleteOrganization(id: number): Promise<void> {
    await db.delete(organizations).where(eq(organizations.id, id));
  }

  async getChildren(organizationId?: number): Promise<Child[]> {
    if (organizationId) {
      return db.select().from(children).where(eq(children.organizationId, organizationId)).orderBy(desc(children.id));
    }
    return db.select().from(children).orderBy(desc(children.id));
  }

  async getChild(id: number): Promise<Child | undefined> {
    const [child] = await db.select().from(children).where(eq(children.id, id));
    return child || undefined;
  }

  async createChild(child: InsertChild): Promise<Child> {
    const [created] = await db.insert(children).values(child).returning();
    return created;
  }

  async updateChild(id: number, child: Partial<InsertChild>): Promise<Child | undefined> {
    const [updated] = await db.update(children).set(child).where(eq(children.id, id)).returning();
    return updated || undefined;
  }

  async deleteChild(id: number): Promise<void> {
    await db.delete(children).where(eq(children.id, id));
  }

  async getDocumentsByChild(childId: number): Promise<Document[]> {
    return db.select().from(documents).where(eq(documents.childId, childId)).orderBy(desc(documents.uploadedAt));
  }

  async getDocumentById(id: number): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc || undefined;
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [created] = await db.insert(documents).values(doc).returning();
    return created;
  }

  async updateDocument(id: number, data: { description: string }): Promise<Document | undefined> {
    const [updated] = await db.update(documents).set({ description: data.description }).where(eq(documents.id, id)).returning();
    return updated || undefined;
  }

  async deleteDocument(id: number): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getTimelineByChild(childId: number): Promise<TimelineEntry[]> {
    return db.select().from(timelineEntries).where(eq(timelineEntries.childId, childId)).orderBy(desc(timelineEntries.createdAt));
  }

  async getRecentTimeline(limit = 10): Promise<TimelineEntry[]> {
    return db.select().from(timelineEntries).orderBy(desc(timelineEntries.createdAt)).limit(limit);
  }

  async createTimelineEntry(entry: InsertTimelineEntry): Promise<TimelineEntry> {
    const [created] = await db.insert(timelineEntries).values(entry).returning();
    return created;
  }

  async updateTimelineEntry(id: number, data: { description: string }): Promise<TimelineEntry | undefined> {
    const [updated] = await db.update(timelineEntries).set({ description: data.description }).where(eq(timelineEntries.id, id)).returning();
    return updated || undefined;
  }

  async getMessagesByChild(childId: number): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.childId, childId)).orderBy(desc(messages.createdAt));
  }

  async getPendingMessages(): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.status, "pending")).orderBy(desc(messages.createdAt));
  }

  async createMessage(msg: InsertMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(msg).returning();
    return created;
  }

  async updateMessageStatus(id: number, status: string): Promise<Message | undefined> {
    const [updated] = await db.update(messages).set({ status }).where(eq(messages.id, id)).returning();
    return updated || undefined;
  }

  async deleteMessage(id: number): Promise<void> {
    await db.delete(messages).where(eq(messages.id, id));
  }

  async reactToMessage(id: number, type: "like" | "love"): Promise<Message | undefined> {
    const [msg] = await db.select().from(messages).where(eq(messages.id, id));
    if (!msg) return undefined;
    const current = (msg.reactions as { like: number; love: number }) ?? { like: 0, love: 0 };
    const updated = { ...current, [type]: (current[type] ?? 0) + 1 };
    const [result] = await db.update(messages).set({ reactions: updated }).where(eq(messages.id, id)).returning();
    return result || undefined;
  }

  async getStats(organizationId?: number) {
    let allChildren: Child[];
    if (organizationId) {
      allChildren = await db.select().from(children).where(eq(children.organizationId, organizationId));
    } else {
      allChildren = await db.select().from(children);
    }
    const [docCount] = await db.select({ count: count() }).from(documents);
    return {
      totalChildren: allChildren.length,
      active: allChildren.filter((c) => c.status === "active").length,
      paused: allChildren.filter((c) => c.status === "paused").length,
      exited: allChildren.filter((c) => c.status === "exited").length,
      totalDocuments: Number(docCount.count),
      sponsored: allChildren.filter((c) => c.isSponsored).length,
      nonSponsored: allChildren.filter((c) => !c.isSponsored).length,
    };
  }
}

export const storage = new DatabaseStorage();
