-- CreateEnum
CREATE TYPE "PlanBillingKind" AS ENUM ('SUBSCRIPTION', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "PlanUsageKind" AS ENUM ('UNLIMITED', 'LIMITED_CREDITS');

-- CreateEnum
CREATE TYPE "CreditInterval" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR', 'NONE');

-- AlterTable
ALTER TABLE "MembershipPlan" ADD COLUMN     "billingInterval" "BillingInterval",
ADD COLUMN     "billingKind" "PlanBillingKind" NOT NULL DEFAULT 'SUBSCRIPTION',
ADD COLUMN     "creditsPerPeriod" INTEGER,
ADD COLUMN     "creditsPeriodUnit" "CreditInterval",
ADD COLUMN     "intervalCount" INTEGER,
ADD COLUMN     "stripePriceId" TEXT,
ADD COLUMN     "stripeProductId" TEXT,
ADD COLUMN     "usageKind" "PlanUsageKind" NOT NULL DEFAULT 'UNLIMITED';
