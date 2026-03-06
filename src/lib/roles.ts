import type { UserRole } from "@prisma/client";

// Higher number = higher privilege.
export const ROLE_RANK: Record<UserRole, number> = {
  PLATFORM_ADMIN: 60,
  GYM_ADMIN: 50,
  LOCATION_ADMIN: 40,
  STAFF: 30,
  INSTRUCTOR: 20,
  MEMBER: 10,
};

export function roleAtLeast(
  current: UserRole | null | undefined,
  minimum: UserRole,
): boolean {
  if (!current) return false;
  return ROLE_RANK[current] >= ROLE_RANK[minimum];
}

