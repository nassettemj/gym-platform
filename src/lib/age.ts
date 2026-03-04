/**
 * Compute age in whole years at a given date.
 * Used for class min/max age enforcement.
 */
export function getAgeAt(dateOfBirth: Date, at: Date): number {
  let age = at.getFullYear() - dateOfBirth.getFullYear();
  const m = at.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  return age;
}
