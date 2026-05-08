import { db } from "./db";
import { organizations } from "@shared/schema";
import { users } from "@shared/models/auth";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function seedDatabase() {
  const existingOrgs = await db.select({ count: sql<number>`count(*)` }).from(organizations);
  if (Number(existingOrgs[0].count) === 0) {
    console.log("Seeding organizations...");
    await db.insert(organizations).values([
      { name: "Bridging opportunity for all", description: "Connecting children with sponsors to create pathways to education and brighter futures." },
      { name: "I Care", description: "A dedicated care program supporting children's wellbeing, health, and personal development." },
      { name: "Hope Sponsorship", description: "Providing hope and lasting support through dedicated one-on-one sponsorship partnerships." },
    ]);
    console.log("Organizations seeded");
  }

  const existingUsers = await db.select({ count: sql<number>`count(*)` }).from(users);
  if (Number(existingUsers[0].count) === 0) {
    console.log("Seeding default admin user...");
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await db.insert(users).values({
      username: "admin",
      hashedPassword,
      firstName: "System",
      lastName: "Admin",
      email: "admin@caretrack.org",
      role: "admin",
    });
    console.log("Default admin created (username: admin, password: admin123)");
  }
}
