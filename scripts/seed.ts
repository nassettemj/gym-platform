/**
 * Seed: 200 members, staff, weekly schedule, graduation seminars, attendance.
 * Run: npx tsx scripts/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { ClassAge } from "@prisma/client";

const prisma = new PrismaClient();

const SEED_GYM_SLUG = "rga";
const SEED_GYM_NAME = "RGA";
const SEED_PASSWORD = "seedpassword";
const TIME_SLOTS = ["09:00", "12:00", "17:00", "19:00"];
const DURATION_MINUTES = 60;

const MAIN_CATS_OTHER = ["OPEN_MAT", "EVENT", "SEMINAR", "GRADUATION"] as const;
const SUB_CATS = ["FUNDAMENTALS", "INTERMEDIATE", "ADVANCED"] as const;
const ADULT_AGES: ClassAge[] = ["ADULT_17_PLUS", "ALL_AGES"];
const YOUTH_AGES: ClassAge[] = ["AGE_4_6", "AGE_7_10", "AGE_11_15", "ALL_AGES"];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalSample(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function normalCount(mean: number, std: number, min: number, max: number): number {
  const x = mean + std * normalSample();
  return Math.round(Math.max(min, Math.min(max, x)));
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

function endOfWeek(d: Date): Date {
  const x = startOfWeek(d);
  x.setDate(x.getDate() + 6);
  x.setHours(23, 59, 59, 999);
  return x;
}

async function main() {
  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);

  let gym = await prisma.gym.findUnique({ where: { slug: SEED_GYM_SLUG } });
  if (!gym) {
    gym = await prisma.gym.create({
      data: { name: SEED_GYM_NAME, slug: SEED_GYM_SLUG, status: "ACTIVE" },
    });
    console.log("Created gym:", gym.slug);
  } else {
    // Re-run: clear existing seed data so we don't hit unique constraints
    const memberIds = await prisma.member.findMany({ where: { gymId: gym.id }, select: { id: true } }).then((r) => r.map((m) => m.id));
    await prisma.checkIn.deleteMany({ where: { memberId: { in: memberIds } } });
    await prisma.subscription.deleteMany({ where: { memberId: { in: memberIds } } });
    const eventIds = await prisma.event.findMany({ where: { gymId: gym.id }, select: { id: true } }).then((r) => r.map((e) => e.id));
    await prisma.eventRegistration.deleteMany({ where: { OR: [{ memberId: { in: memberIds } }, { eventId: { in: eventIds } }] } });
    await prisma.memberRelation.deleteMany({
      where: { OR: [{ adultId: { in: memberIds } }, { childId: { in: memberIds } }] },
    });
    await prisma.class.deleteMany({ where: { gymId: gym.id } });
    await prisma.event.deleteMany({ where: { gymId: gym.id } });
    await prisma.instructor.updateMany({ where: { gymId: gym.id }, data: { memberId: null } });
    await prisma.user.updateMany({ where: { email: { endsWith: "@seed.local" } }, data: { memberId: null } });
    await prisma.member.deleteMany({ where: { gymId: gym.id } });
    await prisma.instructor.deleteMany({ where: { gymId: gym.id } });
    await prisma.membershipPlan.deleteMany({ where: { gymId: gym.id } });
    await prisma.location.deleteMany({ where: { gymId: gym.id } });
    await prisma.user.deleteMany({ where: { email: { endsWith: "@seed.local" } } });
    console.log("Cleared existing seed data for re-run");
  }

  const staffRoles = [
    { role: "PLATFORM_ADMIN" as const, email: "platform-admin@seed.local", name: "Platform Admin", gymId: null as string | null },
    { role: "GYM_ADMIN" as const, email: "gym-admin@seed.local", name: "Gym Admin", gymId: gym.id },
    { role: "LOCATION_ADMIN" as const, email: "location-admin@seed.local", name: "Location Admin", gymId: gym.id },
    { role: "STAFF" as const, email: "staff@seed.local", name: "Staff", gymId: gym.id },
    { role: "INSTRUCTOR" as const, email: "instructor@seed.local", name: "Instructor", gymId: gym.id },
  ];

  for (const s of staffRoles) {
    await prisma.user.upsert({
      where: { email: s.email },
      create: { email: s.email, password: hashedPassword, name: s.name, role: s.role, gymId: s.gymId },
      update: {},
    });
  }
  console.log("Staff users ready");

  let plan = await prisma.membershipPlan.findFirst({ where: { gymId: gym.id } });
  if (!plan) {
    plan = await prisma.membershipPlan.create({
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
    });
    console.log("Created plan:", plan.name);
  }

  const now = new Date();
  const staffMemberData = [
    { email: "platform-admin@seed.local", firstName: "Platform", lastName: "Admin", phone: "+15550000001" },
    { email: "gym-admin@seed.local", firstName: "Gym", lastName: "Admin", phone: "+15550000002" },
    { email: "location-admin@seed.local", firstName: "Location", lastName: "Admin", phone: "+15550000003" },
    { email: "staff@seed.local", firstName: "Staff", lastName: "User", phone: "+15550000004" },
    { email: "instructor@seed.local", firstName: "Instructor", lastName: "User", phone: "+15550000005" },
  ];
  const staffBirthDate = new Date(now.getFullYear() - 30, 0, 15);
  for (const d of staffMemberData) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: d.email } });
    let memberId: string;
    if (user.memberId) {
      await prisma.member.update({
        where: { id: user.memberId },
        data: { email: d.email, phone: d.phone, firstName: d.firstName, lastName: d.lastName, birthDate: staffBirthDate },
      });
      memberId = user.memberId;
    } else {
      const member = await prisma.member.create({
        data: {
          gymId: gym.id,
          firstName: d.firstName,
          lastName: d.lastName,
          email: d.email,
          phone: d.phone,
          birthDate: staffBirthDate,
          memberType: "ADULT",
          status: "ACTIVE",
        },
      });
      memberId = member.id;
    }
    await prisma.user.update({
      where: { email: d.email },
      data: { memberId, gymId: gym.id },
    });
    const existingSub = await prisma.subscription.findFirst({ where: { memberId } });
    if (!existingSub) {
      const startsAt = new Date(now);
      const endsAt = new Date(startsAt);
      endsAt.setDate(endsAt.getDate() + plan.durationDays);
      await prisma.subscription.create({
        data: { memberId, planId: plan.id, startsAt, endsAt, status: "ACTIVE" },
      });
    }
  }
  console.log("Staff members and subscriptions ready");

  const instructorRows = await Promise.all(
    ["Gym Admin", "Location Admin", "Staff", "Instructor"].map((name) =>
      prisma.instructor.create({ data: { gymId: gym!.id, name } }),
    ),
  );
  console.log("4 instructors created");

  const threeYearsAgo = new Date(now);
  threeYearsAgo.setFullYear(now.getFullYear() - 3);
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const memberCreatedAts: Date[] = [];
  for (let i = 0; i < 200; i++) {
    const createdAt = new Date(threeYearsAgo.getTime() + Math.random() * (lastWeek.getTime() - threeYearsAgo.getTime()));
    memberCreatedAts.push(createdAt);
    const email = `member-${i + 1}@seed.local`;
    const phone = `+1555${String(i + 1000000).slice(1)}`;
    const isAdult = i < 100 || Math.random() < 0.5;
    let birthDate: Date;
    if (isAdult) {
      birthDate = new Date(now.getFullYear() - 25 - randomInt(0, 40), randomInt(0, 11), randomInt(1, 28));
    } else {
      const band = YOUTH_AGES[randomInt(0, YOUTH_AGES.length - 1)];
      if (band === "AGE_4_6") birthDate = new Date(now.getFullYear() - 5 - randomInt(0, 2), randomInt(0, 11), randomInt(1, 28));
      else if (band === "AGE_7_10") birthDate = new Date(now.getFullYear() - 8 - randomInt(0, 3), randomInt(0, 11), randomInt(1, 28));
      else birthDate = new Date(now.getFullYear() - 13 - randomInt(0, 2), randomInt(0, 11), randomInt(1, 28));
    }

    const member = await prisma.member.create({
      data: {
        gymId: gym.id,
        firstName: `Member`,
        lastName: `${i + 1}`,
        email,
        phone,
        birthDate,
        memberType: "ADULT",
        status: "ACTIVE",
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        password: hashedPassword,
        name: `Member ${i + 1}`,
        gymId: gym.id,
        role: "MEMBER",
        memberId: member.id,
      },
      update: { memberId: member.id },
    });

    const endsAt = new Date(createdAt);
    endsAt.setDate(endsAt.getDate() + plan.durationDays);
    if (endsAt <= now) endsAt.setTime(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await prisma.subscription.create({
      data: { memberId: member.id, planId: plan.id, startsAt: createdAt, endsAt, status: "ACTIVE" },
    });
  }
  console.log("200 members, users, subscriptions created");

  const earliestCreated = new Date(Math.min(...memberCreatedAts.map((d) => d.getTime())));
  const scheduleStart = startOfWeek(earliestCreated);
  const twoMonthsLater = new Date(now);
  twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2);
  const scheduleEnd = endOfWeek(twoMonthsLater);

  const giCount = 12;
  const noGiCount = 5;
  const otherCount = 28 - giCount - noGiCount;
  const mainCategoryPool: (typeof MAIN_CATS_OTHER)[number][] = ["GI", "GI", "GI", "GI", "GI", "GI", "GI", "GI", "GI", "GI", "GI", "GI"];
  for (let i = 0; i < noGiCount; i++) mainCategoryPool.push("NO_GI");
  for (let i = 0; i < otherCount; i++) mainCategoryPool.push(MAIN_CATS_OTHER[randomInt(0, MAIN_CATS_OTHER.length - 1)]);
  const shuffledMain = mainCategoryPool.sort(() => Math.random() - 0.5);

  type Template = {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    mainCategory: string;
    subCategory: string;
    age: ClassAge;
    instructorId: string;
  };

  const templates: Template[] = [];
  for (let day = 0; day < 7; day++) {
    for (let slot = 0; slot < 4; slot++) {
      const idx = day * 4 + slot;
      const adultSlot = slot < 2 || Math.random() < 0.5;
      const age: ClassAge = adultSlot
        ? ADULT_AGES[randomInt(0, ADULT_AGES.length - 1)]
        : YOUTH_AGES[randomInt(0, YOUTH_AGES.length - 1)];
      const [h, m] = TIME_SLOTS[slot].split(":").map(Number);
      const endH = h + Math.floor(DURATION_MINUTES / 60);
      const endM = m + (DURATION_MINUTES % 60);
      templates.push({
        dayOfWeek: day,
        startTime: TIME_SLOTS[slot],
        endTime: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
        mainCategory: shuffledMain[idx],
        subCategory: SUB_CATS[randomInt(0, SUB_CATS.length - 1)],
        age,
        instructorId: instructorRows[idx % instructorRows.length].id,
      });
    }
  }

  const classData: Parameters<typeof prisma.class.createMany>[0]["data"] = [];
  let cursor = new Date(scheduleStart);
  while (cursor <= scheduleEnd) {
    for (const t of templates) {
      const classDate = new Date(cursor);
      const diff = t.dayOfWeek - classDate.getDay();
      classDate.setDate(classDate.getDate() + diff);
      const [sh, sm] = t.startTime.split(":").map(Number);
      const startAt = new Date(classDate.getFullYear(), classDate.getMonth(), classDate.getDate(), sh, sm, 0, 0);
      const endAt = new Date(startAt.getTime() + DURATION_MINUTES * 60 * 1000);
      classData.push({
        gymId: gym.id,
        name: `${t.mainCategory} ${t.startTime}`,
        dayOfWeek: t.dayOfWeek,
        startTime: t.startTime,
        endTime: t.endTime,
        mainCategory: t.mainCategory as any,
        subCategory: t.subCategory as any,
        age: t.age,
        instructorId: t.instructorId,
        startAt,
        endAt,
        capacity: 30,
      });
    }
    cursor.setDate(cursor.getDate() + 7);
  }

  const BATCH = 200;
  for (let i = 0; i < classData.length; i += BATCH) {
    await prisma.class.createMany({ data: classData.slice(i, i + BATCH) });
  }
  console.log("Weekly class occurrences created:", classData.length);

  const nextGrad = new Date(now);
  nextGrad.setMonth(nextGrad.getMonth() + 1);
  const gradDates: Date[] = [];
  let d = new Date(nextGrad);
  while (d >= scheduleStart) {
    gradDates.push(new Date(d));
    d.setMonth(d.getMonth() - 8);
  }
  d = new Date(nextGrad);
  d.setMonth(d.getMonth() + 8);
  while (d <= scheduleEnd) {
    gradDates.push(new Date(d));
    d.setMonth(d.getMonth() + 8);
  }
  const gradInstructorId = instructorRows[0].id;
  for (const gd of gradDates) {
    const startAt = new Date(gd.getFullYear(), gd.getMonth(), gd.getDate(), 10, 0, 0, 0);
    const endAt = new Date(startAt.getTime() + 120 * 60 * 1000);
    await prisma.class.create({
      data: {
        gymId: gym.id,
        name: Math.random() < 0.5 ? "Graduation" : "Seminar",
        dayOfWeek: startAt.getDay(),
        startTime: "10:00",
        endTime: "12:00",
        mainCategory: Math.random() < 0.5 ? "GRADUATION" : "SEMINAR",
        subCategory: "INTERMEDIATE",
        age: "ALL_AGES",
        instructorId: gradInstructorId,
        startAt,
        endAt,
        capacity: 50,
      },
    });
  }
  console.log("Graduation/seminar occurrences created:", gradDates.length);

  const pastClasses = await prisma.class.findMany({
    where: { gymId: gym.id, startAt: { not: null, lte: now } },
    select: { id: true, startAt: true, age: true },
  });
  const pastClassesList = pastClasses.filter((c): c is typeof c & { startAt: Date } => c.startAt != null);

  const members = await prisma.member.findMany({
    where: { gymId: gym.id },
    select: { id: true, createdAt: true, birthDate: true },
  });

  const ADULT_MEAN_WEEKLY = 3;
  const YOUTH_MEAN_WEEKLY = 2;

  const checkInData: { memberId: string; classId: string; checkedAt: Date; attended: boolean }[] = [];
  for (const member of members) {
    const eligible = pastClassesList.filter(
      (c) =>
        c.startAt >= member.createdAt &&
        member.birthDate != null &&
        canAttendClass(member.birthDate, c.age, c.startAt),
    );
    if (eligible.length === 0) continue;
    const refDate = eligible[0].startAt;
    const memberAge = member.birthDate ? getAgeAt(member.birthDate, refDate) : 17;
    const meanWeekly = memberAge >= 17 ? ADULT_MEAN_WEEKLY : YOUTH_MEAN_WEEKLY;
    const weeksEligible = Math.max(1, (now.getTime() - member.createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const meanTotal = meanWeekly * weeksEligible;
    const std = Math.max(2, meanTotal * 0.5);
    const count = normalCount(meanTotal, std, 0, eligible.length);
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, count);
    for (const cls of chosen) {
      checkInData.push({ memberId: member.id, classId: cls.id, checkedAt: cls.startAt, attended: true });
    }
  }
  const CHECKIN_BATCH = 500;
  for (let i = 0; i < checkInData.length; i += CHECKIN_BATCH) {
    await prisma.checkIn.createMany({ data: checkInData.slice(i, i + CHECKIN_BATCH) });
  }
  console.log("Check-ins created (bell curve, attended):", checkInData.length);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
