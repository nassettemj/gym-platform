import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import type { AuthUser } from "@/types/auth";
import { prisma } from "@/lib/prisma";
import { roleAtLeast } from "@/lib/roles";
import type { UserRole } from "@prisma/client";

type GymSlug = string;

/** Resolve gym by slug and current session. Returns null if not authed or gym not found. */
export async function getGymAndUser(
  gymSlug: GymSlug,
): Promise<{ gym: { id: string; slug: string }; user: AuthUser } | null> {
  const session = await auth();
  const user = session?.user as AuthUser | undefined;
  if (!user?.id) return null;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true, slug: true },
  });
  if (!gym) return null;
  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) return null;

  return { gym, user };
}

/**
 * Require access to the gym (platform admin or gym user). Redirects or notFound on failure.
 * Use in server components (pages).
 */
export async function requireGymAccess(
  gymSlug: GymSlug,
): Promise<{ gym: { id: string; slug: string; name?: string }; user: AuthUser }> {
  const session = await auth();
  const user = session?.user as AuthUser | undefined;
  if (!user?.id) redirect(`/${gymSlug}/login`);

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true, slug: true, name: true },
  });
  if (!gym) notFound();
  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  return { gym, user };
}

/**
 * Require at least INSTRUCTOR role for the gym. Use for pages that need to see member names / reporting.
 */
export async function requireGymInstructor(
  gymSlug: GymSlug,
): Promise<{ gym: { id: string; slug: string; name?: string }; user: AuthUser }> {
  const out = await requireGymAccess(gymSlug);
  if (!roleAtLeast(out.user.role as UserRole | null, "INSTRUCTOR")) {
    redirect(`/${gymSlug}/login`);
  }
  return out;
}

/**
 * Require at least STAFF role for the gym. Use for actions that modify data.
 */
export async function requireGymStaff(
  gymSlug: GymSlug,
): Promise<{ gym: { id: string; slug: string }; user: AuthUser }> {
  const out = await requireGymAccess(gymSlug);
  if (!roleAtLeast(out.user.role as UserRole | null, "STAFF")) {
    redirect(`/${gymSlug}/login`);
  }
  return { gym: { id: out.gym.id, slug: out.gym.slug }, user: out.user };
}

/**
 * For API routes: resolve gym and user by slug. Returns 401/403 response or { gym, user }.
 */
export async function getGymAndUserForApi(
  gymSlug: GymSlug,
): Promise<
  | { error: 401 | 403 | 404; response: Response }
  | { gym: { id: string }; user: AuthUser }
> {
  const session = await auth();
  const user = session?.user as AuthUser | undefined;
  if (!user?.id) {
    return { error: 401, response: new Response("Unauthorized", { status: 401 }) };
  }

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true },
  });
  if (!gym) {
    return { error: 404, response: new Response("Not found", { status: 404 }) };
  }
  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    return { error: 403, response: new Response("Forbidden", { status: 403 }) };
  }

  return { gym, user };
}
