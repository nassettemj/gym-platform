-- AlterTable
ALTER TABLE "Class" ADD COLUMN     "guestNames" TEXT[] DEFAULT ARRAY[]::TEXT[];
