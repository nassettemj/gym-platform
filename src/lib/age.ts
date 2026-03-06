import type { ClassAge } from "@prisma/client";

/**
 * Compute age in whole years at a given date.
 * Used for class age enforcement (17+, 4-6, 7-10, 11-15 years).
 */
export function getAgeAt(dateOfBirth: Date, at: Date): number {
  let age = at.getFullYear() - dateOfBirth.getFullYear();
  const m = at.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Returns true if member (by birthDate) can attend class with given age at given time.
 * Used for filtering schedule by member age.
 */
export function canAttendClass(
  birthDate: Date | null,
  classAge: ClassAge | null,
  classStartAt: Date,
): boolean {
  if (!classAge || classAge === "ALL_AGES") return true;
  if (!birthDate) return false;

  const memberAge = getAgeAt(birthDate, classStartAt);

  switch (classAge) {
    case "ADULT_17_PLUS":
      return memberAge >= 17;
    case "AGE_4_6":
      return memberAge >= 4 && memberAge <= 6;
    case "AGE_7_10":
      return memberAge >= 7 && memberAge <= 10;
    case "AGE_11_15":
      return memberAge >= 11 && memberAge <= 15;
    default:
      return false;
  }
}
