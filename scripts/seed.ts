/**
 * Seed: 1 gym, 1 location, 4 plans, 105 members (all with valid subscription),
 * 105 users (1 per role for staff + 100 MEMBER), classes (GI/NO_GI + 3 graduation),
 * 2 years attendance with above-average attendance and age rules.
 * Run: npm run seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { BeltRank, ClassAge, ClassMainCategory, ClassSubCategory } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_GYM_SLUG = "seed-gym";
const SEED_GYM_NAME = "Seed Gym";
const SEED_PASSWORD = "seedpassword";
const YEARS_HISTORY = 2;
const ATTENDANCE_MIN_PCT = 0.6;
const ATTENDANCE_MAX_PCT = 0.8;

const BELT_RANKS: BeltRank[] = ["WHITE", "BLUE", "PURPLE", "BROWN", "BLACK"];
const SUB_CATEGORIES: ClassSubCategory[] = ["FUNDAMENTALS", "INTERMEDIATE", "ADVANCED"];
const CLASS_AGES: ClassAge[] = ["ALL_AGES", "ADULT_17_PLUS", "AGE_4_6", "AGE_7_10", "AGE_11_15"];
const TIME_SLOTS = ["09:00", "12:00", "17:00", "19:00"];
const DURATION_MINUTES = 60;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getAgeAt(dateOfBirth: Date, at: Date): number {
  let age = at.getFullYear() - dateOfBirth.getFullYear();
  const m = at.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < dateOfBirth.getDate())) age--;
  return age;
}

function canAttendClass(
  birthDate: Date | null,
  classAge: ClassAge | null,
  classStartAt: Date,
): boolean {
  if (!classAge || classAge === "ALL_AGES") return true;
  if (!birthDate) return false;
  const memberAge = getAgeAt(birthDate, classStartAt);
  switch (classAge) {
    case "ADULT_17_PLUS":
      return memberAge >= 17;
    case "AGE_4_6":
      return memberAge >= 4 && memberAge <= 6;
    case "AGE_7_10":
      return memberAge >= 7 && memberAge <= 10;
    case "AGE_11_15":
      return memberAge >= 11 && memberAge <= 15;
    default:
      return false;
  }
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  const diff = x.getDate() - day + (day === 0 ? -6 : 1);
  x.setDate(diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function main() {
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);
  const now = new Date();

  let gym = await prisma.gym.findUnique({ where: { slug: SEED_GYM_SLUG } });
  if (!gym) {
    gym = await prisma.gym.create({
      data: { name: SEED_GYM_NAME, slug: SEED_GYM_SLUG, status: "ACTIVE" },
    });
    console.log("Created gym:", gym.slug);
  } else {
    const memberIds = await prisma.member
      .findMany({ where: { gymId: gym.id }, select: { id: true } })
      .then((r) => r.map((m) => m.id));
    await prisma.checkIn.deleteMany({ where: { memberId: { in: memberIds } } });
    await prisma.subscription.deleteMany({ where: { memberId: { in: memberIds } } });
    await prisma.memberRelation.deleteMany({
      where: { OR: [{ adultId: { in: memberIds } }, { childId: { in: memberIds } }] },
    });
    await prisma.class.deleteMany({ where: { gymId: gym.id } });
    await prisma.instructor.updateMany({ where: { gymId: gym.id }, data: { memberId: null } });
    await prisma.user.updateMany(
      { where: { email: { endsWith: "@seed.local" } }, data: { memberId: null } },
    );
    await prisma.member.deleteMany({ where: { gymId: gym.id } });
    await prisma.instructor.deleteMany({ where: { gymId: gym.id } });
    await prisma.membershipPlan.deleteMany({ where: { gymId: gym.id } });
    await prisma.location.deleteMany({ where: { gymId: gym.id } });
    await prisma.user.deleteMany({ where: { email: { endsWith: "@seed.local" } } });
    console.log("Cleared existing seed data for re-run");
  }

  let location = await prisma.location.findFirst({ where: { gymId: gym.id } });
  if (!location) {
    location = await prisma.location.create({
      data: { gymId: gym.id, name: "Main", address: "1 Seed St", timezone: "UTC" },
    });
    console.log("Created location");
  }

  const plans = await Promise.all([
    prisma.membershipPlan.create({
      data: {
        gymId: gym.id,
        name: "Monthly",
        priceCents: 9900,
        durationDays: 30,
        maxCheckInsPerMonth: 20,
        billingKind: "SUBSCRIPTION",
        duration: "ONE_MONTH",
        age: "ADULTS",
      },
    }),
    prisma.membershipPlan.create({
      data: {
        gymId: gym.id,
        name: "Yearly",
        priceCents: 99000,
        durationDays: 365,
        maxCheckInsPerMonth: 20,
        billingKind: "SUBSCRIPTION",
        duration: "ONE_YEAR",
        age: "ADULTS",
      },
    }),
    prisma.membershipPlan.create({
      data: {
        gymId: gym.id,
        name: "10-visit pass",
        priceCents: 4900,
        durationDays: 90,
        billingKind: "PASS",
        duration: "ONE_MONTH",
        age: "ADULTS",
        visits: "TEN_VISITS",
      },
    }),
    prisma.membershipPlan.create({
      data: {
        gymId: gym.id,
        name: "Kids & Juniors",
        priceCents: 4900,
        durationDays: 30,
        maxCheckInsPerMonth: 12,
        billingKind: "SUBSCRIPTION",
        duration: "ONE_MONTH",
        age: "KIDS_AND_JUNIORS",
      },
    }),
  ]);
  console.log("Created 4 plans");

  const staffEmails = [
    "platform-admin@seed.local",
    "gym-admin@seed.local",
    "location-admin@seed.local",
    "staff@seed.local",
    "instructor@seed.local",
  ];
  const roles = ["PLATFORM_ADMIN", "GYM_ADMIN", "LOCATION_ADMIN", "STAFF", "INSTRUCTOR"] as const;

  const members: { id: string; email: string; birthDate: Date; role?: (typeof roles)[number] }[] = [];

  const staffNames: [string, string][] = [
    ["Platform", "Admin"],
    ["Gym", "Admin"],
    ["Location", "Admin"],
    ["Staff", "User"],
    ["Instructor", "User"],
  ];

  for (let i = 0; i < 105; i++) {
    const age = randomInt(4, 65);
    const birthDate = new Date(now.getFullYear() - age, randomInt(0, 11), randomInt(1, 28));
    const email = i < 5 ? staffEmails[i] : `member-${i - 4}@seed.local`;
    const phone = `+1555${String(1000000 + i).slice(1)}`;
    const belt = BELT_RANKS[randomInt(0, BELT_RANKS.length - 1)];
    const stripes = randomInt(0, 4);

    const member = await prisma.member.create({
      data: {
        gymId: gym.id,
        firstName: i < 5 ? staffNames[i][0] : "Member",
        lastName: i < 5 ? staffNames[i][1] : String(i - 4),
        email,
        phone,
        birthDate,
        belt,
        stripes,
        memberType: "ADULT",
        status: "ACTIVE",
      },
    });
    members.push({
      id: member.id,
      email,
      birthDate,
      role: i < 5 ? roles[i] : undefined,
    });
  }
  console.log("Created 105 members");

  for (let i = 0; i < 105; i++) {
    const m = members[i];
    const role = m.role ?? "MEMBER";
    await prisma.user.create({
      data: {
        email: m.email,
        password: hashedPassword,
        name: `${m.email.split("@")[0].replace(/-/g, " ")}`,
        role,
        gymId: role === "PLATFORM_ADMIN" ? null : gym.id,
        memberId: m.id,
      },
    });
  }
  console.log("Created 105 users");

  for (let i = 0; i < 105; i++) {
    const plan = plans[i % plans.length];
    const startsAt = new Date(now);
    startsAt.setMonth(startsAt.getMonth() - 1);
    const endsAt = new Date(startsAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
    if (endsAt <= now) {
      endsAt.setTime(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
    await prisma.subscription.create({
      data: {
        memberId: members[i].id,
        planId: plan.id,
        startsAt,
        endsAt,
        status: "ACTIVE",
      },
    });
  }
  console.log("Created 105 active subscriptions");

  const instructorMemberId = members.find((m) => m.role === "INSTRUCTOR")!.id;
  const instructorUser = await prisma.user.findFirst({
    where: { email: "instructor@seed.local" },
    select: { name: true },
  });
  const instructor = await prisma.instructor.create({
    data: {
      gymId: gym.id,
      memberId: instructorMemberId,
      name: instructorUser?.name ?? "Instructor",
    },
  });
  console.log("Created instructor");

  const scheduleStart = new Date(now);
  scheduleStart.setFullYear(scheduleStart.getFullYear() - YEARS_HISTORY);
  const weekStart = startOfWeek(scheduleStart);
  const classData: Array<{
    gymId: string;
    locationId: string | null;
    name: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    mainCategory: ClassMainCategory;
    subCategory: ClassSubCategory;
    age: ClassAge;
    instructorId: string;
    startAt: Date;
    endAt: Date;
    capacity: number;
  }> = [];

  let cursor = new Date(weekStart);
  while (cursor <= now) {
    for (let slot = 0; slot < TIME_SLOTS.length; slot++) {
      const mainCategory: ClassMainCategory = slot % 2 === 0 ? "GI" : "NO_GI";
      const [sh, sm] = TIME_SLOTS[slot].split(":").map(Number);
      const endH = sh + Math.floor(DURATION_MINUTES / 60);
      const endM = sm + (DURATION_MINUTES % 60);
      const classDate = new Date(cursor);
      const startAt = new Date(
        classDate.getFullYear(),
        classDate.getMonth(),
        classDate.getDate(),
        sh,
        sm,
        0,
        0,
      );
      const endAt = new Date(startAt.getTime() + DURATION_MINUTES * 60 * 1000);
      if (startAt > now) break;
      const age: ClassAge = CLASS_AGES[randomInt(0, CLASS_AGES.length - 1)];
      classData.push({
        gymId: gym.id,
        locationId: location.id,
        name: `${mainCategory} ${TIME_SLOTS[slot]}`,
        dayOfWeek: classDate.getDay(),
        startTime: TIME_SLOTS[slot],
        endTime: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
        mainCategory,
        subCategory: SUB_CATEGORIES[randomInt(0, SUB_CATEGORIES.length - 1)],
        age,
        instructorId: instructor.id,
        startAt,
        endAt,
        capacity: 30,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const BATCH = 200;
  for (let i = 0; i < classData.length; i += BATCH) {
    await prisma.class.createMany({ data: classData.slice(i, i + BATCH) });
  }
  console.log("Created recurring classes:", classData.length);

  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(now.getFullYear() - YEARS_HISTORY);
  const gradTimes = [
    new Date(twoYearsAgo.getTime() + (now.getTime() - twoYearsAgo.getTime()) * 0.25),
    new Date(twoYearsAgo.getTime() + (now.getTime() - twoYearsAgo.getTime()) * 0.5),
    new Date(twoYearsAgo.getTime() + (now.getTime() - twoYearsAgo.getTime()) * 0.75),
  ];
  for (const gd of gradTimes) {
    const startAt = new Date(gd.getFullYear(), gd.getMonth(), gd.getDate(), 10, 0, 0, 0);
    const endAt = new Date(startAt.getTime() + 120 * 60 * 1000);
    await prisma.class.create({
      data: {
        gymId: gym.id,
        locationId: location.id,
        name: "Graduation",
        dayOfWeek: startAt.getDay(),
        startTime: "10:00",
        endTime: "12:00",
        mainCategory: "GRADUATION",
        subCategory: "INTERMEDIATE",
        age: "ALL_AGES",
        instructorId: instructor.id,
        startAt,
        endAt,
        capacity: 50,
      },
    });
  }
  const allClasses = await prisma.class.findMany({
    where: { gymId: gym.id, startAt: { not: null, lte: now } },
    select: { id: true, startAt: true, age: true },
  });
  const pastClasses = allClasses.filter(
    (c): c is typeof c & { startAt: Date } => c.startAt != null,
  );
  console.log("Created 3 graduation classes. Total classes with startAt:", pastClasses.length);

  const membersWithBirth = await prisma.member.findMany({
    where: { gymId: gym.id },
    select: { id: true, birthDate: true },
  });

  const checkInData: { memberId: string; classId: string; checkedAt: Date; attended: boolean }[] = [];
  for (const member of membersWithBirth) {
    const eligible = pastClasses.filter(
      (c) =>
        member.birthDate != null &&
        canAttendClass(member.birthDate, c.age, c.startAt),
    );
    if (eligible.length === 0) continue;
    const pct =
      ATTENDANCE_MIN_PCT +
      Math.random() * (ATTENDANCE_MAX_PCT - ATTENDANCE_MIN_PCT);
    const count = Math.max(1, Math.round(eligible.length * pct));
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, count);
    for (const cls of chosen) {
      checkInData.push({
        memberId: member.id,
        classId: cls.id,
        checkedAt: cls.startAt,
        attended: true,
      });
    }
  }

  const CHECKIN_BATCH = 500;
  for (let i = 0; i < checkInData.length; i += CHECKIN_BATCH) {
    await prisma.checkIn.createMany({ data: checkInData.slice(i, i + CHECKIN_BATCH) });
  }
  console.log("Check-ins created (above-average attendance):", checkInData.length);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
