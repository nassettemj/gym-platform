"use server";

import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAgeAt } from "@/lib/age";
import { ROLE_RANK, roleAtLeast } from "@/lib/roles";
import { BELT_RANKS } from "@/lib/beltRanks";
import { getGymAndUser } from "@/lib/gymAuth";

export async function updateMemberProfile(formData: FormData) {
  const gymSlug = String(formData.get("gymSlug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const firstNameRaw = String(formData.get("firstName") ?? "").trim();
  const lastNameRaw = String(formData.get("lastName") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const birthDateRaw = String(formData.get("birthDate") ?? "").trim();

  if (!gymSlug || !memberId) return;

  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const member = await prisma.member.findFirst({
    where: { id: memberId, gymId: ctx.gym.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      birthDate: true,
    },
  });
  if (!member) notFound();

  const newFirstName = firstNameRaw || member.firstName;
  const newLastName = lastNameRaw || member.lastName;
  const newEmail = emailRaw ? emailRaw : member.email;
  let newPhone: string | null = member.phone;
  if (phoneRaw !== "") {
    const normalizedPhone = phoneRaw.replace(/[\s-]+/g, "");
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(normalizedPhone)) {
      redirect(
        `/${gymSlug}/admin/members/${memberId}?profileError=${encodeURIComponent(
          "Phone number must be in E.164 format, e.g. +31612345678.",
        )}`,
      );
    }
    newPhone = normalizedPhone;
  }

  let newBirthDate: Date | null = member.birthDate;
  if (birthDateRaw) {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDateRegex.test(birthDateRaw)) {
      redirect(
        `/${gymSlug}/admin/members/${memberId}?profileError=${encodeURIComponent(
          "Birthday must be a valid ISO 8601 date (YYYY-MM-DD).",
        )}`,
      );
    }
    const d = new Date(`${birthDateRaw}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      redirect(
        `/${gymSlug}/admin/members/${memberId}?profileError=${encodeURIComponent(
          "Birthday must be a valid ISO 8601 date (YYYY-MM-DD).",
        )}`,
      );
    }
    newBirthDate = d;
  }

  const logs: { fieldName: string; previousValue: string | null; newValue: string | null }[] = [];
  if (member.firstName !== newFirstName)
    logs.push({ fieldName: "firstName", previousValue: member.firstName, newValue: newFirstName });
  if (member.lastName !== newLastName)
    logs.push({ fieldName: "lastName", previousValue: member.lastName, newValue: newLastName });
  if (member.email !== newEmail)
    logs.push({ fieldName: "email", previousValue: member.email, newValue: newEmail });
  if (member.phone !== newPhone)
    logs.push({ fieldName: "phone", previousValue: member.phone, newValue: newPhone });
  const oldDobStr = member.birthDate ? member.birthDate.toISOString().slice(0, 10) : null;
  const newDobStr = newBirthDate ? newBirthDate.toISOString().slice(0, 10) : null;
  if (oldDobStr !== newDobStr)
    logs.push({ fieldName: "birthDate", previousValue: oldDobStr, newValue: newDobStr });

  if (logs.length === 0) redirect(`/${gymSlug}/admin/members/${memberId}`);

  await prisma.$transaction([
    prisma.member.update({
      where: { id: member.id },
      data: {
        firstName: newFirstName,
        lastName: newLastName,
        email: newEmail,
        phone: newPhone,
        birthDate: newBirthDate,
      },
    }),
    ...logs.map((log) =>
      prisma.memberProfileChangeLog.create({
        data: {
          memberId: member.id,
          changedByUserId: ctx.user.id,
          fieldName: log.fieldName,
          previousValue: log.previousValue,
          newValue: log.newValue,
        },
      }),
    ),
  ]);

  redirect(`/${gymSlug}/admin/members/${memberId}`);
}

export async function updateMemberUserRole(formData: FormData) {
  const gymSlug = String(formData.get("gymSlug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const newRoleRaw = String(formData.get("newRole") ?? "").trim();

  if (!gymSlug || !memberId || !newRoleRaw) return;

  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) redirect(gymSlug ? `/${gymSlug}/login` : "/login");
  if (!roleAtLeast(ctx.user.role as UserRole | null, "LOCATION_ADMIN")) {
    redirect(`/${gymSlug}/admin/members/${memberId}`);
  }

  const validRoles: UserRole[] = [
    "PLATFORM_ADMIN",
    "GYM_ADMIN",
    "LOCATION_ADMIN",
    "STAFF",
    "INSTRUCTOR",
    "MEMBER",
  ];
  const newRole = newRoleRaw as UserRole;
  if (!validRoles.includes(newRole)) redirect(`/${gymSlug}/admin/members/${memberId}`);
  const editorRole = ctx.user.role as UserRole | null;
  if (!editorRole || ROLE_RANK[newRole] > ROLE_RANK[editorRole]) {
    redirect(`/${gymSlug}/admin/members/${memberId}`);
  }

  const targetUser = await prisma.user.findFirst({
    where: { memberId, gymId: ctx.gym.id },
    select: { id: true },
  });
  if (!targetUser) redirect(`/${gymSlug}/admin/members/${memberId}`);

  await prisma.user.update({
    where: { id: targetUser.id },
    data: { role: newRole },
  });

  redirect(`/${gymSlug}/admin/members/${memberId}`);
}

export async function updateMemberBeltStripes(formData: FormData) {
  const gymSlug = String(formData.get("gymSlug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const beltRaw = String(formData.get("belt") ?? "").trim();
  const stripesRaw = String(formData.get("stripes") ?? "").trim();

  if (!gymSlug || !memberId) return;

  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) redirect(gymSlug ? `/${gymSlug}/login` : "/login");
  if (!roleAtLeast(ctx.user.role as UserRole | null, "STAFF")) {
    redirect(`/${gymSlug}/admin/members/${memberId}`);
  }

  const member = await prisma.member.findFirst({
    where: { id: memberId, gymId: ctx.gym.id },
    select: { id: true, belt: true, stripes: true },
  });
  if (!member) notFound();

  const newBelt =
    beltRaw === "" || beltRaw === "UNRANKED"
      ? null
      : BELT_RANKS.includes(beltRaw as (typeof BELT_RANKS)[number])
        ? (beltRaw as (typeof BELT_RANKS)[number])
        : member.belt;
  const stripesNum = stripesRaw === "" ? null : parseInt(stripesRaw, 10);
  const newStripes =
    stripesNum === null
      ? null
      : Number.isNaN(stripesNum) || stripesNum < 0 || stripesNum > 4
        ? member.stripes
        : stripesNum;

  await prisma.$transaction([
    prisma.member.update({
      where: { id: member.id },
      data: { belt: newBelt, stripes: newStripes },
    }),
    prisma.memberBeltStripeLog.create({
      data: {
        memberId: member.id,
        changedByUserId: ctx.user.id,
        previousBelt: member.belt,
        newBelt: newBelt ?? undefined,
        previousStripes: member.stripes,
        newStripes: newStripes ?? undefined,
      },
    }),
  ]);

  revalidatePath(`/${gymSlug}/admin/members/${memberId}`);
}

export async function createCheckIn(formData: FormData) {
  const gymSlug = String(formData.get("gymSlug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const classId = String(formData.get("classId") ?? "").trim();

  if (!gymSlug || !memberId || !classId) return;

  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const [member, clazz, activeSubscription] = await Promise.all([
    prisma.member.findFirst({
      where: { id: memberId, gymId: ctx.gym.id },
      select: { id: true, birthDate: true },
    }),
    prisma.class.findFirst({
      where: { id: classId, gymId: ctx.gym.id },
      include: { location: true, instructor: true },
    }),
    prisma.subscription.findFirst({
      where: { memberId, status: "ACTIVE" },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!member || !clazz) return;

  const at = clazz.startAt ?? new Date();
  if (clazz.age != null && clazz.age !== "ALL_AGES") {
    if (!member.birthDate) {
      redirect(`/${gymSlug}/admin/members/${memberId}?error=birthdate_required`);
    }
    const memberAge = getAgeAt(member.birthDate, at);
    switch (clazz.age) {
      case "ADULT_17_PLUS":
        if (memberAge < 17) redirect(`/${gymSlug}/admin/members/${memberId}?error=too_young`);
        break;
      case "AGE_4_6":
        if (memberAge < 4) redirect(`/${gymSlug}/admin/members/${memberId}?error=too_young`);
        if (memberAge > 6) redirect(`/${gymSlug}/admin/members/${memberId}?error=too_old`);
        break;
      case "AGE_7_10":
        if (memberAge < 7) redirect(`/${gymSlug}/admin/members/${memberId}?error=too_young`);
        if (memberAge > 10) redirect(`/${gymSlug}/admin/members/${memberId}?error=too_old`);
        break;
      case "AGE_11_15":
        if (memberAge < 11) redirect(`/${gymSlug}/admin/members/${memberId}?error=too_young`);
        if (memberAge > 15) redirect(`/${gymSlug}/admin/members/${memberId}?error=too_old`);
        break;
    }
  }

  const isInstructorOfClass = member.id === clazz.instructor?.memberId;
  if (
    !isInstructorOfClass &&
    activeSubscription?.plan?.billingKind === "PASS" &&
    activeSubscription.plan.maxCheckInsPerMonth != null
  ) {
    const usedCount = await prisma.checkIn.count({
      where: {
        memberId: member.id,
        checkedAt: {
          gte: activeSubscription.startsAt,
          lt: activeSubscription.endsAt,
        },
      },
    });
    if (usedCount >= activeSubscription.plan.maxCheckInsPerMonth) {
      redirect(`/${gymSlug}/admin/members/${memberId}?error=usage_limit_reached`);
    }
  }

  await prisma.checkIn.create({
    data: {
      memberId: member.id,
      locationId: clazz.locationId,
      classId: clazz.id,
    },
  });

  revalidatePath(`/${gymSlug}/admin/members/${memberId}`);
  revalidatePath(`/${gymSlug}/admin/my-schedule`);
}

export async function bulkCreateCheckIns(formData: FormData) {
  const gymSlug = String(formData.get("gymSlug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const classIds = formData.getAll("classIds").map((v) => String(v).trim()).filter(Boolean);

  if (!gymSlug || !memberId || classIds.length === 0) return;

  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const [member, activeSubscription] = await Promise.all([
    prisma.member.findFirst({
      where: { id: memberId, gymId: ctx.gym.id },
      select: { id: true, birthDate: true },
    }),
    prisma.subscription.findFirst({
      where: { memberId, status: "ACTIVE" },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!member) return;

  const classes = await prisma.class.findMany({
    where: { id: { in: classIds }, gymId: ctx.gym.id },
    include: { location: true, instructor: true },
  });

  const created: string[] = [];
  for (const clazz of classes) {
    const at = clazz.startAt ?? new Date();
    if (clazz.age != null && clazz.age !== "ALL_AGES") {
      if (!member.birthDate) {
        redirect(`/${gymSlug}/admin/members/${memberId}?error=birthdate_required`);
      }
      const memberAge = getAgeAt(member.birthDate, at);
      switch (clazz.age) {
        case "ADULT_17_PLUS":
          if (memberAge < 17) continue;
          break;
        case "AGE_4_6":
          if (memberAge < 4 || memberAge > 6) continue;
          break;
        case "AGE_7_10":
          if (memberAge < 7 || memberAge > 10) continue;
          break;
        case "AGE_11_15":
          if (memberAge < 11 || memberAge > 15) continue;
          break;
      }
    }

    const isInstructorOfClass = member.id === clazz.instructor?.memberId;
    if (
      !isInstructorOfClass &&
      activeSubscription?.plan?.billingKind === "PASS" &&
      activeSubscription.plan.maxCheckInsPerMonth != null
    ) {
      const usedCount = await prisma.checkIn.count({
        where: {
          memberId: member.id,
          checkedAt: {
            gte: activeSubscription.startsAt,
            lt: activeSubscription.endsAt,
          },
        },
      });
      if (usedCount + created.length >= activeSubscription.plan.maxCheckInsPerMonth) break;
    }

    await prisma.checkIn.create({
      data: {
        memberId: member.id,
        locationId: clazz.locationId,
        classId: clazz.id,
      },
    });
    created.push(clazz.id);
  }

  revalidatePath(`/${gymSlug}/admin/members/${memberId}`);
  revalidatePath(`/${gymSlug}/admin/my-schedule`);
}

export async function deleteCheckIn(formData: FormData) {
  const gymSlug = String(formData.get("gymSlug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const classId = String(formData.get("classId") ?? "").trim();

  if (!gymSlug || !memberId || !classId) return;

  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  await prisma.checkIn.deleteMany({
    where: { memberId, classId },
  });

  revalidatePath(`/${gymSlug}/admin/members/${memberId}`);
  revalidatePath(`/${gymSlug}/admin/my-schedule`);
}

export async function addSubscription(formData: FormData) {
  const gymSlug = String(formData.get("gymSlug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const startDateRaw = String(formData.get("startDate") ?? "").trim();
  const autoRenewRaw = String(formData.get("autoRenew") ?? "").toLowerCase();

  if (!gymSlug || !memberId || !planId || !startDateRaw) return;

  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const canAdd =
    ctx.user.role === "PLATFORM_ADMIN" ||
    (ctx.user.role === "GYM_ADMIN" && ctx.user.gymId === ctx.gym.id);
  if (!canAdd) redirect(`/${gymSlug}/login`);

  const plan = await prisma.membershipPlan.findFirst({
    where: { id: planId, gymId: ctx.gym.id },
    select: { durationDays: true },
  });
  if (!plan) return;

  const startsAt = new Date(`${startDateRaw}T00:00:00.000Z`);
  if (Number.isNaN(startsAt.getTime())) return;
  const endsAt = new Date(startsAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);
  const autoRenew = autoRenewRaw === "yes";

  await prisma.subscription.create({
    data: { memberId, planId, startsAt, endsAt, autoRenew, status: "ACTIVE" },
  });

  redirect(`/${gymSlug}/admin/members/${memberId}`);
}

export async function cancelSubscription(formData: FormData) {
  const gymSlug = String(formData.get("gymSlug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const cancelDateRaw = String(formData.get("cancelDate") ?? "").trim();

  if (!gymSlug || !memberId || !subscriptionId || !cancelDateRaw) return;

  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const subscription = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      memberId,
      member: { gymId: ctx.gym.id },
    },
  });
  if (!subscription) return;

  const cancelAt = new Date(`${cancelDateRaw}T00:00:00.000Z`);
  if (Number.isNaN(cancelAt.getTime())) return;

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: "CANCELLED", endsAt: cancelAt, autoRenew: false },
  });

  redirect(`/${gymSlug}/admin/members/${memberId}`);
}

export async function pickPlanForMember(formData: FormData) {
  const gymSlug = String(formData.get("gymSlug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const planId = String(formData.get("planId") ?? "");

  if (!gymSlug || !memberId || !planId) return;

  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const plan = await prisma.membershipPlan.findFirst({
    where: { id: planId, gymId: ctx.gym.id },
    select: { id: true, durationDays: true },
  });
  if (!plan) return;

  const today = new Date();
  const startsAt = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const endsAt = new Date(startsAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

  await prisma.subscription.create({
    data: {
      memberId,
      planId: plan.id,
      startsAt,
      endsAt,
      status: "ACTIVE",
      autoRenew: false,
    },
  });

  redirect(`/${gymSlug}/admin/members/${memberId}`);
}

export async function deleteMember(formData: FormData) {
  const gymSlug = String(formData.get("gymSlug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const confirm = String(formData.get("confirm") ?? "").trim().toUpperCase();

  if (!gymSlug || !memberId) return;
  if (confirm !== "DELETE") return;

  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const member = await prisma.member.findFirst({
    where: { id: memberId, gymId: ctx.gym.id },
    select: { id: true },
  });
  if (!member) return;

  const memberUser = await prisma.user.findFirst({
    where: { memberId: member.id },
    select: { id: true },
  });
  if (memberUser) {
    await prisma.memberBeltStripeLog.deleteMany({ where: { changedByUserId: memberUser.id } });
    await prisma.memberProfileChangeLog.deleteMany({ where: { changedByUserId: memberUser.id } });
    await prisma.user.delete({ where: { id: memberUser.id } });
  }

  await prisma.member.delete({ where: { id: member.id } });

  redirect(`/${gymSlug}/admin/members`);
}
