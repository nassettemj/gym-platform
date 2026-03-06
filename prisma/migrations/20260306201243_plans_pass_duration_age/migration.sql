-- CreateEnum
CREATE TYPE "PlanDuration" AS ENUM ('ONE_MONTH', 'ONE_YEAR');

-- CreateEnum
CREATE TYPE "PlanAge" AS ENUM ('ADULTS', 'KIDS_AND_JUNIORS');

-- AlterTable
ALTER TABLE "MembershipPlan" ADD COLUMN "duration" "PlanDuration" NOT NULL DEFAULT 'ONE_MONTH',
ADD COLUMN "age" "PlanAge" NOT NULL DEFAULT 'ADULTS';

-- Migrate duration from billingInterval (MONTH/YEAR -> ONE_MONTH/ONE_YEAR)
UPDATE "MembershipPlan"
SET "duration" = CASE
  WHEN "billingInterval" = 'YEAR' THEN 'ONE_YEAR'::"PlanDuration"
  ELSE 'ONE_MONTH'::"PlanDuration"
END;

-- Rename ONE_TIME to PASS in PlanBillingKind
ALTER TYPE "PlanBillingKind" RENAME VALUE 'ONE_TIME' TO 'PASS';

-- AlterTable
ALTER TABLE "MembershipPlan" DROP COLUMN "billingInterval",
DROP COLUMN "intervalCount";

-- DropEnum
DROP TYPE "BillingInterval";
