/**
 * Seed classes for a gym.
 * Creates 1 class per age category (ALL_AGES, ADULT_17_PLUS, AGE_4_6, AGE_7_10, AGE_11_15)
 * on Monday, Wednesday, Friday.
 *
 * Usage: npx tsx scripts/seed-classes.ts [gymSlug]
 * Default gymSlug: rga
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
  ALL_AGES: "All Ages",
  ADULT_17_PLUS: "Adults 17+",
  AGE_4_6: "Kids 4-6",
  AGE_7_10: "Kids 7-10",
  AGE_11_15: "Juniors 11-15",
};

// Monday=1, Wednesday=3, Friday=5
const TARGET_WEEKDAYS = [1, 3, 5];

const MAIN_CATEGORIES = ["OPEN_MAT", "GI", "NO_GI", "EVENT", "SEMINAR", "GRADUATION"] as const;
const SUB_CATEGORIES = ["STAND_UP", "FUNDAMENTALS", "INTERMEDIATE", "ADVANCED", "COMPETITION"] as const;

function randomMainCategory() {
  return MAIN_CATEGORIES[Math.floor(Math.random() * MAIN_CATEGORIES.length)];
}
function randomSubCategory() {
  return SUB_CATEGORIES[Math.floor(Math.random() * SUB_CATEGORIES.length)];
}

// One class per age, staggered by hour: 9:00, 10:00, 11:00, 12:00, 13:00
const START_TIMES = ["09:00", "10:00", "11:00", "12:00", "13:00"];
const DURATION_MINUTES = 60;

async function main() {
  const gymSlug = process.argv[2] ?? "rga";
  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } });

  if (!gym) {
    console.error(`Gym with slug "${gymSlug}" not found. Run npm run seed first.`);
    process.exit(1);
  }

  const location = await prisma.location.findFirst({
    where: { gymId: gym.id },
  });
  const instructor = await prisma.instructor.findFirst({
    where: { gymId: gym.id },
  });

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from Sunday
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 28); // 4 weeks

  const classesToCreate: Prisma.ClassCreateManyInput[] = [];
  const cursor = new Date(startDate);

  while (cursor < endDate) {
    const dayOfWeek = cursor.getDay();
    if (!TARGET_WEEKDAYS.includes(dayOfWeek)) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const day = cursor.getDate();

    for (let i = 0; i < AGE_CATEGORIES.length; i++) {
      const age = AGE_CATEGORIES[i];
      const [startHour, startMin] = START_TIMES[i].split(":").map(Number);
      const startAt = new Date(year, month, day, startHour, startMin, 0, 0);
      const endAt = new Date(startAt.getTime() + DURATION_MINUTES * 60 * 1000);
      const startTime = START_TIMES[i];
      const endTime = `${String(endAt.getHours()).padStart(2, "0")}:${String(endAt.getMinutes()).padStart(2, "0")}`;

      classesToCreate.push({
        gymId: gym.id,
        locationId: location?.id ?? null,
        name: AGE_LABELS[age],
        dayOfWeek,
        startTime,
        endTime,
        capacity: 20,
        age,
        instructorId: instructor?.id ?? null,
        mainCategory: randomMainCategory(),
        subCategory: randomSubCategory(),
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

  console.log(`Created ${count} classes for gym "${gym.name}" (${gym.slug}).`);
  console.log(`  - Mon/Wed/Fri, 5 classes per day (one per age), 4 weeks`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
