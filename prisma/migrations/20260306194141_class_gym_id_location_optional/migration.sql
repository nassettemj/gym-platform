-- Add gymId as nullable first, backfill from Location, then make required
ALTER TABLE "Class" ADD COLUMN "gymId" TEXT;

UPDATE "Class" SET "gymId" = "Location"."gymId"
FROM "Location"
WHERE "Class"."locationId" = "Location"."id";

ALTER TABLE "Class" ALTER COLUMN "gymId" SET NOT NULL;

-- Make locationId nullable
ALTER TABLE "Class" ALTER COLUMN "locationId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
