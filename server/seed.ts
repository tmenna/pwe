import { db } from "./db";
import { children, documents, timelineEntries } from "@shared/schema";
import { users } from "@shared/models/auth";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function seedDatabase() {
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

  const existing = await db.select({ count: sql<number>`count(*)` }).from(children);

  const oldNames = ["Amara Okafor", "Samuel Mensah", "Fatima Hassan", "David Kamau", "Esther Nyambura", "Selam Kebede"];
  const existingChildren = await db.select({ fullName: children.fullName }).from(children);
  const hasOldNames = existingChildren.some(c => oldNames.includes(c.fullName));

  if (hasOldNames) {
    console.log("Replacing old sample data with Ethiopian names...");
    await db.delete(timelineEntries);
    await db.delete(documents);
    await db.delete(children);
  } else if (Number(existing[0].count) > 0) {
    return;
  }

  console.log("Seeding database with sample data...");

  const seedChildren = [
    {
      childId: "CHD-001",
      fullName: "Birtukan Tadesse",
      age: 9,
      gender: "female",
      location: "Boricha, Sidama Region, Ethiopia",
      programEnrollment: "Primary School - Grade 3",
      assignedSponsors: "Johnson Family",
      assignedCaseWorker: "Dawit Bekele",
      status: "active",
    },
    {
      childId: "CHD-002",
      fullName: "Nahom Girma",
      age: 12,
      gender: "male",
      location: "Shanto, Wolaita Zone, Ethiopia",
      programEnrollment: "Accelerated Learning Program",
      assignedSponsors: "Martin & Claire Dubois",
      assignedCaseWorker: "Tigist Hailu",
      status: "active",
    },
    {
      childId: "CHD-003",
      fullName: "Hana Mulugeta",
      age: 7,
      gender: "female",
      location: "Dale, Sidama Region, Ethiopia",
      programEnrollment: "Early Childhood Development",
      assignedSponsors: null,
      assignedCaseWorker: "Abebe Kebede",
      status: "active",
    },
    {
      childId: "CHD-004",
      fullName: "Yonas Tesfaye",
      age: 14,
      gender: "male",
      location: "Boricha, Sidama Region, Ethiopia",
      programEnrollment: "Secondary School - Form 2",
      assignedSponsors: "The Peterson Foundation",
      assignedCaseWorker: "Tigist Hailu",
      status: "paused",
    },
    {
      childId: "CHD-005",
      fullName: "Selam Worku",
      age: 11,
      gender: "female",
      location: "Shanto, Wolaita Zone, Ethiopia",
      programEnrollment: "Primary School - Grade 5",
      assignedSponsors: "Rachel Kim",
      assignedCaseWorker: "Dawit Bekele",
      status: "active",
    },
  ];

  const inserted = await db.insert(children).values(seedChildren).returning();

  const seedTimeline = [
    { childId: inserted[0].id, title: "Child profile created", description: "Birtukan Tadesse was enrolled in the program", entryType: "milestone", createdBy: "Dawit Bekele" },
    { childId: inserted[0].id, title: "Moved to Grade 3", description: "Successfully promoted to Grade 3 with excellent marks", entryType: "milestone", createdBy: "Dawit Bekele" },
    { childId: inserted[0].id, title: "Q1 school report uploaded", description: "First quarter report card showing strong progress in reading", entryType: "document", createdBy: "Dawit Bekele" },
    { childId: inserted[1].id, title: "Child profile created", description: "Nahom Girma joined the accelerated learning program", entryType: "milestone", createdBy: "Tigist Hailu" },
    { childId: inserted[1].id, title: "Completed literacy milestone", description: "Achieved reading level appropriate for age group", entryType: "milestone", createdBy: "Tigist Hailu" },
    { childId: inserted[2].id, title: "Child profile created", description: "Hana Mulugeta enrolled in early childhood development", entryType: "milestone", createdBy: "Abebe Kebede" },
    { childId: inserted[2].id, title: "Photo update added", description: "Quarterly photo showing growth and wellbeing", entryType: "document", createdBy: "Abebe Kebede" },
    { childId: inserted[3].id, title: "Child profile created", description: "Yonas Tesfaye enrolled in secondary school program", entryType: "milestone", createdBy: "Tigist Hailu" },
    { childId: inserted[3].id, title: "Status changed to paused", description: "Program participation temporarily paused due to family relocation", entryType: "status_change", createdBy: "Tigist Hailu" },
    { childId: inserted[4].id, title: "Child profile created", description: "Selam Worku joined the sponsorship program", entryType: "milestone", createdBy: "Dawit Bekele" },
    { childId: inserted[4].id, title: "Case worker follow-up completed", description: "Home visit confirmed stable living conditions and school attendance", entryType: "note", createdBy: "Dawit Bekele" },
  ];

  await db.insert(timelineEntries).values(seedTimeline);
  console.log("Database seeded successfully!");
}
