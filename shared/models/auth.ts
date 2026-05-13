import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 100 }).unique().notNull(),
  hashedPassword: varchar("hashed_password", { length: 255 }).notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  email: varchar("email"),
  role: varchar("role", { length: 20 }).default("case_worker").notNull(),
  organizationId: integer("organization_id"),
  photoUrl: varchar("photo_url"),
  streetAddress1: varchar("street_address_1", { length: 255 }),
  streetAddress2: varchar("street_address_2", { length: 255 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 100 }),
  zipCode: varchar("zip_code", { length: 20 }),
  country: varchar("country", { length: 100 }),
  sponsoredPrograms: text("sponsored_programs"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  hashedPassword: true,
  createdAt: true,
  updatedAt: true,
});

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const createUserSchema = z.object({
  username: z.string().email("Username must be a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  role: z.enum(["admin", "superadmin", "case_worker", "sponsor"]),
  organizationId: z.coerce.number().optional().nullable(),
  streetAddress1: z.string().optional().nullable(),
  streetAddress2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  sponsoredPrograms: z.string().optional().nullable(),
});

export const updateUserSchema = z.object({
  username: z.string().email("Username must be a valid email address").optional(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  role: z.enum(["admin", "superadmin", "case_worker", "sponsor"]).optional(),
  password: z.string().min(6).optional(),
  organizationId: z.coerce.number().optional().nullable(),
  streetAddress1: z.string().optional().nullable(),
  streetAddress2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zipCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  sponsoredPrograms: z.string().optional().nullable(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
