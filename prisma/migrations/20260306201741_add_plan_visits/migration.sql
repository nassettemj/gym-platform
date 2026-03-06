-- CreateEnum
CREATE TYPE "PlanVisits" AS ENUM ('ONE_VISIT', 'TEN_VISITS');

-- AlterTable
ALTER TABLE "MembershipPlan" ADD COLUMN "visits" "PlanVisits";
