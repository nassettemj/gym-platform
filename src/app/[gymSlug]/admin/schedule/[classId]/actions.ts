"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

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
