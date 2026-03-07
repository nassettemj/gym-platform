/*
  Warnings:

  - Made the column `mainCategory` on table `Class` required. This step will fail if there are existing NULL values in that column.

*/
-- Backfill existing NULL mainCategory before making the column required
UPDATE "Class" SET "mainCategory" = 'OPEN_MAT' WHERE "mainCategory" IS NULL;

-- AlterTable
ALTER TABLE "Class" ALTER COLUMN "mainCategory" SET NOT NULL;
