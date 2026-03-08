"use server";

import type { BeltRank } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { roleAtLeast } from "@/lib/roles";
import { BELT_RANKS } from "@/lib/beltRanks";
import { getGymAndUser } from "@/lib/gymAuth";

export type CloseGraduationUpdate = { memberId: string; belt: string; stripes: number };

export async function closeGraduationEvent(
  gymSlug: string,
  classId: string,
  updates: CloseGraduationUpdate[],
): Promise<{ error?: string }> {
  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) return { error: "Not authenticated" };
  if (!roleAtLeast(ctx.user.role, "STAFF")) return { error: "Forbidden" };
  const { gym, user } = ctx;
  const userId = user.id;

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
  revalidatePath(`/${gymSlug}/admin/members`);
  return {};
}

export async function setCheckInAttended(formData: FormData): Promise<void> {
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
  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) return;
  if (ctx.user.memberId !== checkIn.class.instructor?.memberId) return;

  await prisma.checkIn.update({
    where: { id: checkInId },
    data: { attended },
  });

  revalidatePath(`/${gymSlug}/admin/schedule/${checkIn.classId}`);
  revalidatePath(`/${gymSlug}/admin/my-schedule`);
  revalidatePath(`/${gymSlug}/admin/members/${checkIn.memberId}`);
}

export async function confirmClassAttendance(formData: FormData): Promise<void> {
  const classId = formData.get("classId") as string;
  const gymSlug = formData.get("gymSlug") as string;

  if (!classId || !gymSlug) return;

  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) return;

  const clazz = await prisma.class.findFirst({
    where: { id: classId, gymId: ctx.gym.id },
    include: { instructor: true },
  });

  if (!clazz) return;
  if (ctx.user.memberId !== clazz.instructor?.memberId) return;

  await prisma.class.update({
    where: { id: classId },
    data: { attendanceConfirmedAt: new Date() },
  });

  revalidatePath(`/${gymSlug}/admin/schedule/${classId}`);
  revalidatePath(`/${gymSlug}/admin/my-schedule`);
  revalidatePath(`/${gymSlug}/admin/members`);
}
