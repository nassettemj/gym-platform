import type { UserRole } from "@prisma/client";

/** Authenticated user shape from session (after callbacks). */
export type AuthUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: UserRole | null;
  gymId?: string | null;
  memberId?: string | null;
};
