-- CreateEnum
CREATE TYPE "ClassAge" AS ENUM ('ADULT_17_PLUS', 'AGE_4_6', 'AGE_7_10', 'AGE_11_15');

-- AlterTable
ALTER TABLE "Class" ADD COLUMN "age" "ClassAge";

-- Migrate existing min/max age data to age enum
UPDATE "Class"
SET "age" = CASE
  WHEN "minAgeYears" = 4 AND "maxAgeYears" = 6 THEN 'AGE_4_6'::"ClassAge"
  WHEN "minAgeYears" = 7 AND "maxAgeYears" = 10 THEN 'AGE_7_10'::"ClassAge"
  WHEN "minAgeYears" = 11 AND "maxAgeYears" = 15 THEN 'AGE_11_15'::"ClassAge"
  WHEN "minAgeYears" >= 17 AND ("maxAgeYears" IS NULL OR "maxAgeYears" >= 17) THEN 'ADULT_17_PLUS'::"ClassAge"
  WHEN "minAgeYears" = 4 AND ("maxAgeYears" IS NULL OR "maxAgeYears" = 6) THEN 'AGE_4_6'::"ClassAge"
  WHEN "minAgeYears" = 7 AND ("maxAgeYears" IS NULL OR "maxAgeYears" = 10) THEN 'AGE_7_10'::"ClassAge"
  WHEN "minAgeYears" = 11 AND ("maxAgeYears" IS NULL OR "maxAgeYears" = 15) THEN 'AGE_11_15'::"ClassAge"
  ELSE NULL
END;

-- AlterTable
ALTER TABLE "Class" DROP COLUMN "minAgeYears",
DROP COLUMN "maxAgeYears";
