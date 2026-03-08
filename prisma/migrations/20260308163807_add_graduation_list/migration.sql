-- CreateTable
CREATE TABLE "GraduationList" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraduationList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GraduationList_classId_key" ON "GraduationList"("classId");

-- AddForeignKey
ALTER TABLE "GraduationList" ADD CONSTRAINT "GraduationList_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraduationList" ADD CONSTRAINT "GraduationList_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
