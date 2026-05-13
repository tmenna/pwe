import { db } from "./db";
import { organizations } from "@shared/schema";
import { users } from "@shared/models/auth";
import { sql, eq, and, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";

const SUPERADMIN_EMAIL = "teki.menna@gmail.com";

export async function seedDatabase() {
  const existingOrgs = await db.select({ count: sql<number>`count(*)` }).from(organizations);
  if (Number(existingOrgs[0].count) === 0) {
    console.log("Seeding organizations...");
    await db.insert(organizations).values([
      { name: "BRIDGING OPPORTUNITY FOR ALL", description: "Connecting children with sponsors to create pathways to education and brighter futures." },
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

  // Ensure the designated superadmin account always has the superadmin role.
  // This is idempotent — a no-op if the role is already correct.
  const [superadminUser] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.username, SUPERADMIN_EMAIL));
  if (superadminUser && superadminUser.role !== "superadmin") {
    await db
      .update(users)
      .set({ role: "superadmin" })
      .where(eq(users.id, superadminUser.id));
    console.log(`[setup] Promoted ${SUPERADMIN_EMAIL} to superadmin`);
  }
}
