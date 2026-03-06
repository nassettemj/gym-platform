-- Wipe existing plans (cascades to Subscription, sets OrderItem.planId to null)
DELETE FROM "MembershipPlan";

-- AlterTable
ALTER TABLE "MembershipPlan" DROP COLUMN "usageKind",
DROP COLUMN "creditsPerPeriod",
DROP COLUMN "creditsPeriodUnit";

-- DropEnum
DROP TYPE "PlanUsageKind";

-- DropEnum
DROP TYPE "CreditInterval";
