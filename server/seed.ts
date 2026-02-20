import { db } from "./db";
import { children, timelineEntries } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existing = await db.select({ count: sql<number>`count(*)` }).from(children);
  if (Number(existing[0].count) > 0) return;

  console.log("Seeding database with sample data...");

  const seedChildren = [
    {
      childId: "CHD-001",
      fullName: "Amara Okafor",
      age: 9,
      gender: "female",
      location: "Lagos, Nigeria",
      programEnrollment: "Primary School - Grade 3",
      assignedSponsors: "Johnson Family",
      assignedCaseWorker: "Grace Adeyemi",
      status: "active",
    },
    {
      childId: "CHD-002",
      fullName: "Samuel Mensah",
      age: 12,
      gender: "male",
      location: "Accra, Ghana",
      programEnrollment: "Accelerated Learning Program",
      assignedSponsors: "Martin & Claire Dubois",
      assignedCaseWorker: "Kwame Asante",
      status: "active",
    },
    {
      childId: "CHD-003",
      fullName: "Fatima Hassan",
      age: 7,
      gender: "female",
      location: "Nairobi, Kenya",
      programEnrollment: "Early Childhood Development",
      assignedSponsors: null,
      assignedCaseWorker: "Wanjiku Mwangi",
      status: "active",
    },
    {
      childId: "CHD-004",
      fullName: "David Kamau",
      age: 14,
      gender: "male",
      location: "Mombasa, Kenya",
      programEnrollment: "Secondary School - Form 2",
      assignedSponsors: "The Peterson Foundation",
      assignedCaseWorker: "Wanjiku Mwangi",
      status: "paused",
    },
    {
      childId: "CHD-005",
      fullName: "Esther Nyambura",
      age: 11,
      gender: "female",
      location: "Kampala, Uganda",
      programEnrollment: "Primary School - Grade 5",
      assignedSponsors: "Rachel Kim",
      assignedCaseWorker: "Moses Okello",
      status: "active",
    },
  ];

  const inserted = await db.insert(children).values(seedChildren).returning();

  const seedTimeline = [
    { childId: inserted[0].id, title: "Child profile created", description: "Amara Okafor was enrolled in the program", entryType: "milestone", createdBy: "Grace Adeyemi" },
    { childId: inserted[0].id, title: "Moved to Grade 3", description: "Successfully promoted to Grade 3 with excellent marks", entryType: "milestone", createdBy: "Grace Adeyemi" },
    { childId: inserted[0].id, title: "Q1 school report uploaded", description: "First quarter report card showing strong progress in reading", entryType: "document", createdBy: "Grace Adeyemi" },
    { childId: inserted[1].id, title: "Child profile created", description: "Samuel Mensah joined the accelerated learning program", entryType: "milestone", createdBy: "Kwame Asante" },
    { childId: inserted[1].id, title: "Completed literacy milestone", description: "Achieved reading level appropriate for age group", entryType: "milestone", createdBy: "Kwame Asante" },
    { childId: inserted[2].id, title: "Child profile created", description: "Fatima Hassan enrolled in early childhood development", entryType: "milestone", createdBy: "Wanjiku Mwangi" },
    { childId: inserted[2].id, title: "Photo update added", description: "Quarterly photo showing growth and wellbeing", entryType: "document", createdBy: "Wanjiku Mwangi" },
    { childId: inserted[3].id, title: "Child profile created", description: "David Kamau enrolled in secondary school program", entryType: "milestone", createdBy: "Wanjiku Mwangi" },
    { childId: inserted[3].id, title: "Status changed to paused", description: "Program participation temporarily paused due to family relocation", entryType: "status_change", createdBy: "Wanjiku Mwangi" },
    { childId: inserted[4].id, title: "Child profile created", description: "Esther Nyambura joined the sponsorship program", entryType: "milestone", createdBy: "Moses Okello" },
    { childId: inserted[4].id, title: "Case worker follow-up completed", description: "Home visit confirmed stable living conditions and school attendance", entryType: "note", createdBy: "Moses Okello" },
  ];

  await db.insert(timelineEntries).values(seedTimeline);
  console.log("Database seeded successfully!");
}
