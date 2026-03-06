/**
 * Alternative mock dataset of classes with valid data.
 * Creates varied classes for all 3 gyms (RGA, 10P, B-Team):
 * - Different categories (GI, NO_GI, OPEN_MAT) and levels (FUNDAMENTALS, INTERMEDIATE, ADVANCED)
 * - Assigned instructors (gym admins)
 * - Classes spanning the next 4 weeks
 * - One class per age category per weekday
 *
 * Usage: npx tsx scripts/seed-classes-v2.ts
 */

import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const AGE_CATEGORIES = [
  "ALL_AGES",
  "ADULT_17_PLUS",
  "AGE_4_6",
  "AGE_7_10",
  "AGE_11_15",
] as const;

const AGE_LABELS: Record<(typeof AGE_CATEGORIES)[number], string> = {
  ALL_AGES: "All Ages Open Mat",
  ADULT_17_PLUS: "Adults BJJ",
  AGE_4_6: "Little Grapplers 4-6",
  AGE_7_10: "Kids BJJ 7-10",
  AGE_11_15: "Juniors BJJ 11-15",
};

// Variety: mainCategory, subCategory, start time offset (minutes from 9:00)
const CLASS_VARIANTS: {
  mainCategory: "GI" | "NO_GI" | "OPEN_MAT";
  subCategory: "FUNDAMENTALS" | "INTERMEDIATE" | "ADVANCED";
  startOffsetMinutes: number;
}[] = [
  { mainCategory: "GI", subCategory: "FUNDAMENTALS", startOffsetMinutes: 0 },
  { mainCategory: "GI", subCategory: "INTERMEDIATE", startOffsetMinutes: 90 },
  { mainCategory: "NO_GI", subCategory: "FUNDAMENTALS", startOffsetMinutes: 180 },
  { mainCategory: "NO_GI", subCategory: "ADVANCED", startOffsetMinutes: 270 },
  { mainCategory: "OPEN_MAT", subCategory: "FUNDAMENTALS", startOffsetMinutes: 360 },
];

const DURATION_MINUTES = 60;

async function main() {
  const gyms = await prisma.gym.findMany({
    where: { slug: { in: ["rga", "10p", "b-team"] } },
    include: {
      locations: { take: 1 },
      instructors: { take: 5 },
    },
  });

  if (gyms.length === 0) {
    console.error("No gyms found. Run npm run seed first.");
    process.exit(1);
  }

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 28); // 4 weeks

  let totalCount = 0;

  for (const gym of gyms) {
    const classesToCreate: Prisma.ClassCreateManyInput[] = [];
    const locationId = gym.locations[0]?.id ?? null;
    const instructors = gym.instructors;
    const instructorIds = instructors.map((i) => i.id);

    const cursor = new Date(startDate);
    while (cursor < endDate) {
      const dayOfWeek = cursor.getDay();
      const year = cursor.getFullYear();
      const month = cursor.getMonth();
      const day = cursor.getDate();

      for (let i = 0; i < AGE_CATEGORIES.length; i++) {
        const age = AGE_CATEGORIES[i];
        const variant = CLASS_VARIANTS[i % CLASS_VARIANTS.length];
        const startMinutes = 9 * 60 + variant.startOffsetMinutes;
        const startHour = Math.floor(startMinutes / 60) % 24;
        const startMin = startMinutes % 60;

        const startAt = new Date(year, month, day, startHour, startMin, 0, 0);
        const endAt = new Date(startAt.getTime() + DURATION_MINUTES * 60 * 1000);

        const startTime = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
        const endTime = `${String(endAt.getHours()).padStart(2, "0")}:${String(endAt.getMinutes()).padStart(2, "0")}`;

        const instructorId =
          instructorIds.length > 0
            ? instructorIds[i % instructorIds.length]
            : null;

        classesToCreate.push({
          gymId: gym.id,
          locationId,
          name: AGE_LABELS[age],
          dayOfWeek,
          startTime,
          endTime,
          capacity: age === "ALL_AGES" ? 30 : 20,
          age,
          instructorId,
          mainCategory: variant.mainCategory,
          subCategory: variant.subCategory,
          startAt,
          endAt,
        });
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    const { count } = await prisma.class.createMany({
      data: classesToCreate,
      skipDuplicates: true,
    });
    totalCount += count;
  }

  console.log(`Created ${totalCount} classes across ${gyms.length} gyms.`);
  console.log(
    `  - 4 weeks of classes (Sun–Sat), 5 per day per gym (one per age category)`,
  );
  console.log(
    `  - Categories: GI, NO_GI, OPEN_MAT × FUNDAMENTALS, INTERMEDIATE, ADVANCED`,
  );
  console.log(`  - Instructors assigned where available`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
