/**
 * Drop all seed data from the database.
 * Deletes all records in dependency order.
 *
 * Usage: npx tsx scripts/seed-reset.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Dropping all seed data...\n");

  await prisma.$transaction(async (tx) => {
    const r1 = await tx.checkIn.deleteMany();
    console.log(`  CheckIn: ${r1.count}`);

    const r2 = await tx.eventRegistration.deleteMany();
    console.log(`  EventRegistration: ${r2.count}`);

    const r3 = await tx.orderItem.deleteMany();
    console.log(`  OrderItem: ${r3.count}`);

    const r4 = await tx.subscription.deleteMany();
    console.log(`  Subscription: ${r4.count}`);

    const r5 = await tx.memberRelation.deleteMany();
    console.log(`  MemberRelation: ${r5.count}`);

    const r6 = await tx.memberBeltStripeLog.deleteMany();
    console.log(`  MemberBeltStripeLog: ${r6.count}`);

    const r7 = await tx.memberProfileChangeLog.deleteMany();
    console.log(`  MemberProfileChangeLog: ${r7.count}`);

    const r8 = await tx.class.deleteMany();
    console.log(`  Class: ${r8.count}`);

    const r9 = await tx.instructor.deleteMany();
    console.log(`  Instructor: ${r9.count}`);

    const r10 = await tx.event.deleteMany();
    console.log(`  Event: ${r10.count}`);

    const r11 = await tx.order.deleteMany();
    console.log(`  Order: ${r11.count}`);

    const r12 = await tx.product.deleteMany();
    console.log(`  Product: ${r12.count}`);

    const r13 = await tx.membershipPlan.deleteMany();
    console.log(`  MembershipPlan: ${r13.count}`);

    const r14 = await tx.location.deleteMany();
    console.log(`  Location: ${r14.count}`);

    const r15 = await tx.user.deleteMany();
    console.log(`  User: ${r15.count}`);

    const r16 = await tx.member.deleteMany();
    console.log(`  Member: ${r16.count}`);

    const r17 = await tx.gymCustomization.deleteMany();
    console.log(`  GymCustomization: ${r17.count}`);

    const r18 = await tx.gym.deleteMany();
    console.log(`  Gym: ${r18.count}`);
  });

  console.log("\nDone. Database is empty.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
