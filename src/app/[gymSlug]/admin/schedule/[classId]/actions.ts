"use server";

import type { BeltRank } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { roleAtLeast } from "@/lib/roles";

const BELT_RANKS: BeltRank[] = ["WHITE", "BLUE", "PURPLE", "BROWN", "BLACK"];

export type CloseGraduationUpdate = { memberId: string; belt: string; stripes: number };

export async function closeGraduationEvent(
  gymSlug: string,
  classId: string,
  updates: CloseGraduationUpdate[],
): Promise<{ error?: string }> {
  const session = await auth();
  const user = session?.user as { id?: string; gymId?: string; role?: string } | undefined;
  if (!user?.id) return { error: "Not authenticated" };
  const userId = user.id;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true, slug: true },
  });
  if (!gym || (user.gymId !== gym.id && user.role !== "PLATFORM_ADMIN")) return { error: "Unauthorized" };
  if (!roleAtLeast(user.role as Parameters<typeof roleAtLeast>[0], "STAFF")) return { error: "Forbidden" };

  if (updates.length === 0) {
    revalidatePath(`/${gymSlug}/admin/schedule/${classId}`);
    return {};
  }

  const validUpdates: { memberId: string; belt: BeltRank; stripes: number }[] = [];
  for (const u of updates) {
    const belt =
      BELT_RANKS.includes(u.belt as BeltRank) ? (u.belt as BeltRank) : null;
    if (belt == null) continue;
    const stripes = Math.min(4, Math.max(0, Math.floor(u.stripes)));
    validUpdates.push({ memberId: u.memberId, belt, stripes });
  }

  const members = await prisma.member.findMany({
    where: {
      id: { in: validUpdates.map((u) => u.memberId) },
      gymId: gym.id,
    },
    select: { id: true, belt: true, stripes: true },
  });
  const memberMap = new Map(members.map((m) => [m.id, m]));

  await prisma.$transaction(
    validUpdates.flatMap((u) => {
      const member = memberMap.get(u.memberId);
      if (!member) return [];
      return [
        prisma.member.update({
          where: { id: u.memberId },
          data: { belt: u.belt, stripes: u.stripes },
        }),
        prisma.memberBeltStripeLog.create({
          data: {
            memberId: u.memberId,
            changedByUserId: userId,
            previousBelt: member.belt,
            newBelt: u.belt,
            previousStripes: member.stripes,
            newStripes: u.stripes,
          },
        }),
      ];
    }),
  );

  revalidatePath(`/${gymSlug}/admin/schedule/${classId}`);
  for (const u of validUpdates) {
    revalidatePath(`/${gymSlug}/admin/members/${u.memberId}`);
  }
  return {};
}

export async function setCheckInAttended(formData: FormData): Promise<void> {
  const session = await auth();
  const user = session?.user as { id?: string; gymId?: string; memberId?: string } | undefined;
  if (!user?.id) return;

  const checkInId = formData.get("checkInId") as string;
  const attended = formData.get("attended") === "true";

  if (!checkInId) return;

  const checkIn = await prisma.checkIn.findUnique({
    where: { id: checkInId },
    include: {
      class: {
        include: {
          instructor: true,
          gym: { select: { id: true, slug: true } },
        },
      },
    },
  });

  if (!checkIn?.class) return;

  const gymSlug = checkIn.class.gym.slug;
  if (user.gymId !== checkIn.class.gym.id) return;

  const instructorMemberId = checkIn.class.instructor?.memberId;
  if (user.memberId !== instructorMemberId) return;

  await prisma.checkIn.update({
    where: { id: checkInId },
    data: { attended },
  });

  revalidatePath(`/${gymSlug}/admin/schedule/${checkIn.classId}`);
  revalidatePath(`/${gymSlug}/admin/my-schedule`);
  revalidatePath(`/${gymSlug}/admin/members/${checkIn.memberId}`);
}

export async function confirmClassAttendance(formData: FormData): Promise<void> {
  const session = await auth();
  const user = session?.user as { id?: string; gymId?: string; memberId?: string } | undefined;
  if (!user?.id) return;

  const classId = formData.get("classId") as string;
  const gymSlug = formData.get("gymSlug") as string;

  if (!classId || !gymSlug) return;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true, slug: true },
  });
  if (!gym || user.gymId !== gym.id) return;

  const clazz = await prisma.class.findFirst({
    where: { id: classId, gymId: gym.id },
    include: { instructor: true },
  });

  if (!clazz) return;

  const instructorMemberId = clazz.instructor?.memberId;
  if (user.memberId !== instructorMemberId) return;

  await prisma.class.update({
    where: { id: classId },
    data: { attendanceConfirmedAt: new Date() },
  });

  revalidatePath(`/${gymSlug}/admin/schedule/${classId}`);
  revalidatePath(`/${gymSlug}/admin/my-schedule`);
  const checkIns = await prisma.checkIn.findMany({
    where: { classId },
    select: { memberId: true },
  });
  for (const ci of checkIns) {
    revalidatePath(`/${gymSlug}/admin/members/${ci.memberId}`);
  }
}
