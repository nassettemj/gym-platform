/*
  Warnings:

  - Made the column `subCategory` on table `Class` required. This step will fail if there are existing NULL values in that column.

*/
-- Backfill existing NULL subCategory before making the column required
UPDATE "Class" SET "subCategory" = 'FUNDAMENTALS' WHERE "subCategory" IS NULL;

-- AlterTable
ALTER TABLE "Class" ALTER COLUMN "subCategory" SET NOT NULL;
