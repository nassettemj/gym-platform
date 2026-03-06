-- AlterTable
ALTER TABLE "CheckIn" ADD COLUMN     "attended" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "attendanceConfirmedAt" TIMESTAMP(3);
