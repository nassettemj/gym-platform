/**
 * Minimal seed: 1 gym (RGA), 1 gym owner, 1 instructor, 1 member.
 * All with random names and valid E.164 phone numbers.
 *
 * Usage: npm run seed
 * Run after: npm run seed:reset (or fresh migrate)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const FIRST_NAMES = [
  "Alex", "Jordan", "Sam", "Taylor", "Morgan", "Casey", "Riley",
  "Jamie", "Quinn", "Avery", "Skyler", "Parker", "Dakota", "Reese",
  "Blake", "Cameron", "Drew", "Emery", "Finley", "Harper",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Wilson", "Anderson", "Thomas",
  "Taylor", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White",
];

function randomName(): { firstName: string; lastName: string } {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return { firstName: first!, lastName: last! };
}

/** Generate a valid E.164 phone number (+1 + 10 digits for US) */
function randomPhone(): string {
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10));
  return `+1${digits.join("")}`;
}

const TEST_PASSWORD = "test1234";
const HASHED_PASSWORD = bcrypt.hashSync(TEST_PASSWORD, 10);

async function main() {
  console.log("Seeding minimal data...\n");

  // 1. Gym
  const gym = await prisma.gym.upsert({
    where: { slug: "rga" },
    create: { name: "RGA", slug: "rga", status: "ACTIVE" },
    update: {},
  });
  console.log("Created gym: RGA");

  // 2. Location (needed for classes)
  let location = await prisma.location.findFirst({ where: { gymId: gym.id } });
  if (!location) {
    location = await prisma.location.create({
      data: {
        gymId: gym.id,
        name: "RGA Main",
        address: "123 Main St",
        timezone: "Europe/Paris",
      },
    });
  }

  // 3. Gym owner (Member + User as GYM_ADMIN)
  const ownerName = randomName();
  const ownerPhone = randomPhone();
  const ownerEmail = `owner@rga.test`;

  let ownerMember = await prisma.member.findFirst({
    where: { gymId: gym.id, email: ownerEmail },
  });
  if (!ownerMember) {
    ownerMember = await prisma.member.create({
      data: {
        gymId: gym.id,
        firstName: ownerName.firstName,
        lastName: ownerName.lastName,
        email: ownerEmail,
        phone: ownerPhone,
        memberType: "ADULT",
        birthDate: new Date(1985, 0, 1),
      },
    });
  }

  await prisma.user.upsert({
    where: { email: ownerEmail },
    create: {
      email: ownerEmail,
      password: HASHED_PASSWORD,
      name: `${ownerName.firstName} ${ownerName.lastName}`,
      role: "GYM_ADMIN",
      gymId: gym.id,
      memberId: ownerMember.id,
    },
    update: { password: HASHED_PASSWORD, memberId: ownerMember.id },
  });
  console.log(`Created gym owner: ${ownerName.firstName} ${ownerName.lastName} (${ownerEmail})`);

  // 4. Instructor (Member + Instructor, different from owner)
  const instructorName = randomName();
  const instructorPhone = randomPhone();
  const instructorEmail = `instructor@rga.test`;

  const instructorMember = await prisma.member.create({
    data: {
      gymId: gym.id,
      firstName: instructorName.firstName,
      lastName: instructorName.lastName,
      email: instructorEmail,
      phone: instructorPhone,
      memberType: "ADULT",
      birthDate: new Date(1990, 5, 15),
    },
  });

  await prisma.instructor.create({
    data: {
      gymId: gym.id,
      memberId: instructorMember.id,
      name: `${instructorName.firstName} ${instructorName.lastName}`,
    },
  });

  await prisma.user.upsert({
    where: { email: instructorEmail },
    create: {
      email: instructorEmail,
      password: HASHED_PASSWORD,
      name: `${instructorName.firstName} ${instructorName.lastName}`,
      role: "INSTRUCTOR",
      gymId: gym.id,
      memberId: instructorMember.id,
    },
    update: { password: HASHED_PASSWORD, memberId: instructorMember.id },
  });
  console.log(`Created instructor: ${instructorName.firstName} ${instructorName.lastName} (${instructorEmail})`);

  // 5. Member (with subscription for class sign-up)
  const memberName = randomName();
  const memberPhone = randomPhone();
  const memberEmail = `member@rga.test`;

  const membershipPlan = await prisma.membershipPlan.create({
    data: {
      gymId: gym.id,
      locationId: location.id,
      name: "Monthly Unlimited",
      description: "Unlimited classes",
      priceCents: 7900,
      durationDays: 30,
      billingKind: "SUBSCRIPTION",
      duration: "ONE_MONTH",
      age: "ADULTS",
    },
  });

  const member = await prisma.member.create({
    data: {
      gymId: gym.id,
      firstName: memberName.firstName,
      lastName: memberName.lastName,
      email: memberEmail,
      phone: memberPhone,
      memberType: "ADULT",
      birthDate: new Date(1995, 2, 10),
    },
  });

  const startsAt = new Date();
  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + 30);

  await prisma.subscription.create({
    data: {
      memberId: member.id,
      planId: membershipPlan.id,
      startsAt,
      endsAt,
      status: "ACTIVE",
    },
  });

  await prisma.user.create({
    data: {
      email: memberEmail,
      password: HASHED_PASSWORD,
      name: `${memberName.firstName} ${memberName.lastName}`,
      role: "MEMBER",
      gymId: gym.id,
      memberId: member.id,
    },
  });
  console.log(`Created member: ${memberName.firstName} ${memberName.lastName} (${memberEmail})`);

  console.log("\nDone. Credentials (password: test1234):");
  console.log(`  - Gym owner: ${ownerEmail}`);
  console.log(`  - Instructor: ${instructorEmail}`);
  console.log(`  - Member: ${memberEmail}`);
  console.log("\nRun 'npm run seed:classes' to add classes (Mon/Wed/Fri).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
