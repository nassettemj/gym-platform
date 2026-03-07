import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getAgeAt } from "@/lib/age";
import { MemberProfilePanel } from "@/components/MemberProfilePanel";
import { MemberClassHistoryTable } from "@/components/MemberClassHistoryTable";
import { MemberPlanChooser } from "@/components/MemberPlanChooser";
import { MemberBeltStripesPanel } from "@/components/MemberBeltStripesPanel";
import { UserRole } from "@prisma/client";
import { ROLE_RANK, roleAtLeast } from "@/lib/roles";

interface MemberDetailPageProps {
  params: Promise<{
    gymSlug: string;
    memberId: string;
  }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function updateMemberProfile(formData: FormData) {
  "use server";

  const gymSlug = String(formData.get("gymSlug") ?? "");

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect(gymSlug ? `/${gymSlug}/login` : "/login");
  const memberId = String(formData.get("memberId") ?? "");
  const firstNameRaw = String(formData.get("firstName") ?? "").trim();
  const lastNameRaw = String(formData.get("lastName") ?? "").trim();
  const emailRaw = String(formData.get("email") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const birthDateRaw = String(formData.get("birthDate") ?? "").trim();

  if (!gymSlug || !memberId) return;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true },
  });
  if (!gym) notFound();

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  const member = await prisma.member.findFirst({
    where: { id: memberId, gymId: gym.id },
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

  // Each profile field has its own form; missing/empty values mean "leave unchanged".
  const newFirstName = firstNameRaw || member.firstName;
  const newLastName = lastNameRaw || member.lastName;
  const newEmail = emailRaw ? emailRaw : member.email;
  // Normalize and validate phone (E.164) and birthday (ISO 8601 date).
  let newPhone: string | null = member.phone;
  if (phoneRaw !== "") {
    // Basic normalization: strip spaces and hyphens.
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
  // else: leave newPhone as member.phone (preserve when form didn't submit phone)

  let newBirthDate: Date | null = member.birthDate;
  if (birthDateRaw) {
    // Require strict ISO 8601 date string (YYYY-MM-DD).
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

  if (member.firstName !== newFirstName) {
    logs.push({
      fieldName: "firstName",
      previousValue: member.firstName,
      newValue: newFirstName,
    });
  }
  if (member.lastName !== newLastName) {
    logs.push({
      fieldName: "lastName",
      previousValue: member.lastName,
      newValue: newLastName,
    });
  }
  if (member.email !== newEmail) {
    logs.push({
      fieldName: "email",
      previousValue: member.email,
      newValue: newEmail,
    });
  }
  if (member.phone !== newPhone) {
    logs.push({
      fieldName: "phone",
      previousValue: member.phone,
      newValue: newPhone,
    });
  }
  const oldDobStr = member.birthDate
    ? member.birthDate.toISOString().slice(0, 10)
    : null;
  const newDobStr = newBirthDate ? newBirthDate.toISOString().slice(0, 10) : null;
  if (oldDobStr !== newDobStr) {
    logs.push({
      fieldName: "birthDate",
      previousValue: oldDobStr,
      newValue: newDobStr,
    });
  }

  if (logs.length === 0) {
    redirect(`/${gymSlug}/admin/members/${memberId}`);
  }

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
          changedByUserId: user.id,
          fieldName: log.fieldName,
          previousValue: log.previousValue,
          newValue: log.newValue,
        },
      })
    ),
  ]);

  redirect(`/${gymSlug}/admin/members/${memberId}`);
}

async function updateMemberUserRole(formData: FormData) {
  "use server";

  const gymSlug = String(formData.get("gymSlug") ?? "");

  const session = await auth();
  const currentUser = session?.user as { role?: UserRole; gymId?: string } | undefined;
  if (!currentUser) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const memberId = String(formData.get("memberId") ?? "");
  const newRoleRaw = String(formData.get("newRole") ?? "").trim();

  if (!gymSlug || !memberId || !newRoleRaw) return;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true },
  });

  if (!gym) {
    notFound();
  }

  if (currentUser.role !== "PLATFORM_ADMIN" && currentUser.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  const editorRole = currentUser.role;

  // Only users strictly above STAFF (LOCATION_ADMIN, GYM_ADMIN, PLATFORM_ADMIN) may edit roles.
  if (!editorRole || !roleAtLeast(editorRole, "LOCATION_ADMIN")) {
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
  if (!validRoles.includes(newRole)) {
    redirect(`/${gymSlug}/admin/members/${memberId}`);
  }

  // Do not allow assigning a role higher than the editor's own role.
  if (ROLE_RANK[newRole] > ROLE_RANK[editorRole]) {
    redirect(`/${gymSlug}/admin/members/${memberId}`);
  }

  // Ensure the target user belongs to the specified member and gym.
  const targetUser = await prisma.user.findFirst({
    where: {
      memberId,
      gymId: gym.id,
    },
    select: { id: true },
  });

  if (!targetUser) {
    redirect(`/${gymSlug}/admin/members/${memberId}`);
  }

  await prisma.user.update({
    where: { id: targetUser.id },
    data: { role: newRole },
  });

  redirect(`/${gymSlug}/admin/members/${memberId}`);
}

const BELT_RANKS = ["WHITE", "BLUE", "PURPLE", "BROWN", "BLACK"] as const;

export async function updateMemberBeltStripes(formData: FormData) {
  "use server";

  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) redirect("/login");

  const gymSlug = String(formData.get("gymSlug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const beltRaw = String(formData.get("belt") ?? "").trim();
  const stripesRaw = String(formData.get("stripes") ?? "").trim();

  if (!gymSlug || !memberId) return;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true },
  });
  if (!gym) notFound();

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  if (!roleAtLeast(user.role, "STAFF")) {
    redirect(`/${gymSlug}/admin/members/${memberId}`);
  }

  const member = await prisma.member.findFirst({
    where: { id: memberId, gymId: gym.id },
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
        changedByUserId: user.id,
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
  "use server";

  const session = await auth();
  const user = session?.user as any;
  const gymSlug = String(formData.get("gymSlug") ?? "");
  if (!user) redirect(gymSlug ? `/${gymSlug}/login` : "/login");
  const memberId = String(formData.get("memberId") ?? "");
  const classId = String(formData.get("classId") ?? "").trim();

  if (!gymSlug || !memberId || !classId) return;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true },
  });
  if (!gym) notFound();

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  const [member, clazz, activeSubscription] = await Promise.all([
    prisma.member.findFirst({
      where: { id: memberId, gymId: gym.id },
      select: { id: true, birthDate: true },
    }),
    prisma.class.findFirst({
      where: {
        id: classId,
        gymId: gym.id,
      },
      include: { location: true, instructor: true },
    }),
    prisma.subscription.findFirst({
      where: {
        memberId,
        status: "ACTIVE",
      },
      include: {
        plan: true,
      },
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
        if (memberAge < 17) {
          redirect(`/${gymSlug}/admin/members/${memberId}?error=too_young`);
        }
        break;
      case "AGE_4_6":
        if (memberAge < 4) {
          redirect(`/${gymSlug}/admin/members/${memberId}?error=too_young`);
        }
        if (memberAge > 6) {
          redirect(`/${gymSlug}/admin/members/${memberId}?error=too_old`);
        }
        break;
      case "AGE_7_10":
        if (memberAge < 7) {
          redirect(`/${gymSlug}/admin/members/${memberId}?error=too_young`);
        }
        if (memberAge > 10) {
          redirect(`/${gymSlug}/admin/members/${memberId}?error=too_old`);
        }
        break;
      case "AGE_11_15":
        if (memberAge < 11) {
          redirect(`/${gymSlug}/admin/members/${memberId}?error=too_young`);
        }
        if (memberAge > 15) {
          redirect(`/${gymSlug}/admin/members/${memberId}?error=too_old`);
        }
        break;
    }
  }

  // Enforce visit limit for Pass plans (instructors can always sign up for their own classes)
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
  "use server";

  const session = await auth();
  const user = session?.user as any;
  const gymSlug = String(formData.get("gymSlug") ?? "");
  if (!user) redirect(gymSlug ? `/${gymSlug}/login` : "/login");
  const memberId = String(formData.get("memberId") ?? "");
  const classIds = formData.getAll("classIds").map((v) => String(v).trim()).filter(Boolean);

  if (!gymSlug || !memberId || classIds.length === 0) return;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true },
  });
  if (!gym) notFound();

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  const [member, activeSubscription] = await Promise.all([
    prisma.member.findFirst({
      where: { id: memberId, gymId: gym.id },
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
    where: { id: { in: classIds }, gymId: gym.id },
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
      if (usedCount + created.length >= activeSubscription.plan.maxCheckInsPerMonth) {
        break;
      }
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
  "use server";

  const session = await auth();
  const user = session?.user as any;
  const gymSlug = String(formData.get("gymSlug") ?? "");
  if (!user) redirect(gymSlug ? `/${gymSlug}/login` : "/login");
  const memberId = String(formData.get("memberId") ?? "");
  const classId = String(formData.get("classId") ?? "").trim();

  if (!gymSlug || !memberId || !classId) return;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true },
  });
  if (!gym) notFound();

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  await prisma.checkIn.deleteMany({
    where: {
      memberId,
      classId,
    },
  });

  revalidatePath(`/${gymSlug}/admin/members/${memberId}`);
  revalidatePath(`/${gymSlug}/admin/my-schedule`);
}

async function addSubscription(formData: FormData) {
  "use server";

  const session = await auth();
  const user = session?.user as any;
  const gymSlug = String(formData.get("gymSlug") ?? "");
  if (!user) redirect(gymSlug ? `/${gymSlug}/login` : "/login");
  const memberId = String(formData.get("memberId") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const startDateRaw = String(formData.get("startDate") ?? "").trim();
  const autoRenewRaw = String(formData.get("autoRenew") ?? "").toLowerCase();

  if (!gymSlug || !memberId || !planId || !startDateRaw) return;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true },
  });

  if (!gym) {
    notFound();
  }

  const canDelete =
    user.role === "PLATFORM_ADMIN" ||
    (user.role === "GYM_ADMIN" && user.gymId === gym.id);

  if (!canDelete) {
    redirect(`/${gymSlug}/login`);
  }

  const plan = await prisma.membershipPlan.findFirst({
    where: { id: planId, gymId: gym.id },
    select: {
      durationDays: true,
    },
  });

  if (!plan) return;

  const startsAt = new Date(`${startDateRaw}T00:00:00.000Z`);
  if (Number.isNaN(startsAt.getTime())) return;

  const endsAt = new Date(
    startsAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000,
  );

  const autoRenew = autoRenewRaw === "yes";

  await prisma.subscription.create({
    data: {
      memberId,
      planId,
      startsAt,
      endsAt,
      autoRenew,
      status: "ACTIVE",
    },
  });

  redirect(`/${gymSlug}/admin/members/${memberId}`);
}

async function cancelSubscription(formData: FormData) {
  "use server";

  const session = await auth();
  const user = session?.user as any;
  const gymSlug = String(formData.get("gymSlug") ?? "");
  if (!user) redirect(gymSlug ? `/${gymSlug}/login` : "/login");
  const memberId = String(formData.get("memberId") ?? "");
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const cancelDateRaw = String(formData.get("cancelDate") ?? "").trim();

  if (!gymSlug || !memberId || !subscriptionId || !cancelDateRaw) return;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true },
  });

  if (!gym) {
    notFound();
  }

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  const subscription = await prisma.subscription.findFirst({
    where: {
      id: subscriptionId,
      memberId,
      member: {
        gymId: gym.id,
      },
    },
  });

  if (!subscription) return;

  const cancelAt = new Date(`${cancelDateRaw}T00:00:00.000Z`);
  if (Number.isNaN(cancelAt.getTime())) return;

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: "CANCELLED",
      endsAt: cancelAt,
      autoRenew: false,
    },
  });

  redirect(`/${gymSlug}/admin/members/${memberId}`);
}

async function pickPlanForMember(formData: FormData) {
  "use server";

  const session = await auth();
  const user = session?.user as any;
  const gymSlug = String(formData.get("gymSlug") ?? "");
  if (!user) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const memberId = String(formData.get("memberId") ?? "");
  const planId = String(formData.get("planId") ?? "");

  if (!gymSlug || !memberId || !planId) return;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true },
  });

  if (!gym) {
    notFound();
  }

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  const plan = await prisma.membershipPlan.findFirst({
    where: { id: planId, gymId: gym.id },
    select: {
      id: true,
      durationDays: true,
    },
  });

  if (!plan) {
    return;
  }

  const today = new Date();
  const startsAt = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const endsAt = new Date(
    startsAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000,
  );

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

async function deleteMember(formData: FormData) {
  "use server";

  const session = await auth();
  const user = session?.user as any;

  const gymSlug = String(formData.get("gymSlug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const confirm = String(formData.get("confirm") ?? "").trim().toUpperCase();

  if (!gymSlug || !memberId) return;
  if (!user) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  // Require explicit confirmation text to reduce accidental deletions.
  if (confirm !== "DELETE") {
    return;
  }

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true },
  });

  if (!gym) {
    notFound();
  }

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  const member = await prisma.member.findFirst({
    where: {
      id: memberId,
      gymId: gym.id,
    },
    select: { id: true },
  });

  if (!member) return;

  const memberUser = await prisma.user.findFirst({
    where: { memberId: member.id },
    select: { id: true },
  });

  if (memberUser) {
    await prisma.memberBeltStripeLog.deleteMany({
      where: { changedByUserId: memberUser.id },
    });
    await prisma.memberProfileChangeLog.deleteMany({
      where: { changedByUserId: memberUser.id },
    });
    await prisma.user.delete({
      where: { id: memberUser.id },
    });
  }

  await prisma.member.delete({
    where: { id: member.id },
  });

  redirect(`/${gymSlug}/admin/members`);
}

export default async function MemberDetailPage({
  params,
  searchParams,
}: MemberDetailPageProps) {
  const { gymSlug, memberId } = await params;

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect(`/${gymSlug}/login`);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const profileError =
    typeof resolvedSearchParams.profileError === "string"
      ? resolvedSearchParams.profileError
      : null;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: {
      id: true,
      name: true,
    },
  });

  if (!gym) {
    notFound();
  }

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  const [member, plans] = await Promise.all([
    prisma.member.findFirst({
      where: {
        id: memberId,
        gymId: gym.id,
      },
      include: {
        user: {
          select: {
            role: true,
          },
        },
        subscriptions: {
          include: {
            plan: true,
          },
          orderBy: { createdAt: "desc" },
        },
        profileChangeLogs: {
          include: { changedByUser: { select: { name: true } } },
          orderBy: { changedAt: "desc" },
          take: 50,
        },
      },
    }),
    prisma.membershipPlan.findMany({
      where: { gymId: gym.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!member) {
    notFound();
  }

  const isMemberViewer = user.role === "MEMBER";
  const isProfileComplete = !!member.birthDate && !!member.phone;
  const hideMemberExtras = isMemberViewer && !isProfileComplete;

  const now = new Date();
  const activeSubscription =
    member.subscriptions.find((sub) => {
      return (
        sub.status === "ACTIVE" &&
        sub.startsAt <= now &&
        sub.endsAt > now
      );
    }) ?? null;

  const summarySubscription =
    activeSubscription ?? member.subscriptions[0] ?? null;

  const showClassHistory =
    !hideMemberExtras &&
    (user.memberId === member.id ||
      user.role === "PLATFORM_ADMIN" ||
      user.role === "GYM_ADMIN");

  const checkInHistoryRaw = showClassHistory
    ? await prisma.checkIn.findMany({
        where: {
          memberId: member.id,
          classId: { not: null },
        },
        include: {
          class: {
            select: {
              name: true,
              startAt: true,
              endAt: true,
              dayOfWeek: true,
              startTime: true,
              endTime: true,
              mainCategory: true,
              subCategory: true,
              age: true,
              discipline: true,
              topic: true,
              capacity: true,
              attendanceConfirmedAt: true,
              guestNames: true,
              location: { select: { name: true } },
              instructor: { select: { name: true } },
            },
          },
        },
        orderBy: { checkedAt: "desc" },
        take: 50,
      })
    : [];

  const checkInHistory: Array<{
    id: string;
    className: string;
    date: string;
    startTime: string;
    endTime: string;
    locationName: string | null;
    instructorName: string | null;
    mainCategory: string | null;
    subCategory: string | null;
    age: string | null;
    discipline: string | null;
    topic: string | null;
    capacity: number | null;
    signedUpAt: string;
    status: "Signed up" | "Present" | "Absent";
  }> = checkInHistoryRaw.map((ci) => {
    const c = ci.class;
    if (!c) {
      return {
        id: ci.id,
        className: "",
        date: "",
        startTime: "",
        endTime: "",
        locationName: null,
        instructorName: null,
        mainCategory: null,
        subCategory: null,
        age: null,
        discipline: null,
        topic: null,
        capacity: null,
        signedUpAt: ci.checkedAt.toISOString(),
        status: "Signed up" as const,
      };
    }
    const dateStr = c.startAt
      ? c.startAt.toISOString().slice(0, 10)
      : "";
    const startTimeStr = c.startAt
      ? c.startAt.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : c.startTime ?? "";
    const endTimeStr = c.endAt
      ? c.endAt.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : c.endTime ?? "";
    const instructorName =
      c.instructor?.name ??
      (c.guestNames?.length ? `Guests: ${c.guestNames.join(", ")}` : null);
    let status: "Signed up" | "Present" | "Absent" = "Signed up";
    if (c.attendanceConfirmedAt) {
      status = ci.attended ? "Present" : "Absent";
    }
    return {
      id: ci.id,
      className: c.name ?? "",
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      locationName: c.location?.name ?? null,
      instructorName,
      mainCategory: c.mainCategory,
      subCategory: c.subCategory,
      age: c.age,
      discipline: c.discipline ?? null,
      topic: c.topic ?? null,
      capacity: c.capacity ?? null,
      signedUpAt: ci.checkedAt.toISOString(),
      status,
    };
  });

  return (
    <div className="space-y-4">
      {hideMemberExtras && (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          role="alert"
        >
          Please fill in your Birthday and Phone number for additional features to become visible.
        </div>
      )}
      <section className="border border-white/10 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white/80">Profile</h2>
        </div>
        <MemberProfilePanel
          member={{
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.email,
            phone: member.phone,
            birthDate: member.birthDate,
            status: member.status,
            userRole: member.user?.role ?? null,
          }}
          gymSlug={gymSlug}
          updateAction={updateMemberProfile}
          updateRoleAction={updateMemberUserRole}
          currentUserRole={user.role}
          deleteAction={deleteMember}
          canDeleteMember={
            user.role === "PLATFORM_ADMIN" || user.role === "GYM_ADMIN"
          }
          canEditProfile={
            user.role === "PLATFORM_ADMIN" || user.role === "GYM_ADMIN"
          }
          profileError={profileError}
        />
      </section>

      {!hideMemberExtras && (
        <section className="border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/80">Belt & stripes</h2>
          </div>
          <MemberBeltStripesPanel
            memberId={member.id}
            gymSlug={gymSlug}
            belt={member.belt ?? null}
            stripes={member.stripes ?? null}
            canEdit={roleAtLeast(user.role, "STAFF")}
            updateAction={updateMemberBeltStripes}
          />
        </section>
      )}

      {!hideMemberExtras && (
        <section className="border border-white/10 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/80">Plan</h2>
          </div>

          {summarySubscription && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-2 border border-white/15 rounded-xl p-4 bg-black/40 min-h-[160px]">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <span className="font-medium">
                    {summarySubscription.plan?.name ?? "Unknown plan"}
                  </span>
                  <span className="text-[11px] text-white/60 uppercase">
                    {summarySubscription.status}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5 text-[11px] text-white/60">
                  <div>
                    {summarySubscription.plan?.billingKind === "PASS" ? "Pass" : "Subscription"}
                  </div>
                  {summarySubscription.plan && (
                    <div>
                      {summarySubscription.plan.billingKind === "PASS"
                        ? summarySubscription.plan.visits === "TEN_VISITS"
                          ? "10 visits"
                          : "1 visit"
                        : `${summarySubscription.plan.duration === "ONE_YEAR" ? "1 year" : "1 month"} · ${summarySubscription.plan.age === "KIDS_AND_JUNIORS" ? "Kids & Juniors" : "Adults"}`}
                    </div>
                  )}
                  {summarySubscription.plan?.priceCents != null && (
                    <div>
                      €
                      {(summarySubscription.plan.priceCents / 100).toFixed(2)}
                    </div>
                  )}
                </div>

                <div className="mt-auto flex justify-end">
                  <div className="flex flex-col items-end gap-1 text-[11px]">
                    {activeSubscription &&
                      activeSubscription.id === summarySubscription.id && (
                        <details className="text-right">
                          <summary className="cursor-pointer text-orange-400 hover:text-orange-300 list-none">
                            Cancel plan
                          </summary>
                          <form
                            action={cancelSubscription}
                            className="mt-1 flex flex-col items-end gap-1"
                          >
                            <input
                              type="hidden"
                              name="gymSlug"
                              value={gymSlug}
                            />
                            <input
                              type="hidden"
                              name="memberId"
                              value={member.id}
                            />
                            <input
                              type="hidden"
                              name="subscriptionId"
                              value={activeSubscription.id}
                            />
                            <div className="flex flex-col gap-1 items-end">
                              <label className="text-[10px] font-medium text-white/80">
                                Cancellation date
                                <input
                                  name="cancelDate"
                                  type="date"
                                  required
                                  className="mt-1 px-2 py-1 rounded-md bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-red-500 text-[11px]"
                                />
                              </label>
                            </div>
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-red-600 text-[11px] font-medium hover:bg-red-500 transition-colors"
                            >
                              Confirm cancellation
                            </button>
                          </form>
                        </details>
                      )}
                    <Link
                      href={`/${gymSlug}/admin/members/${member.id}/change-plan`}
                      className="text-orange-400 hover:text-orange-300"
                    >
                      Change plan
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {member.subscriptions.length === 0 && plans.length > 0 && (
            <div className="mt-4">
              <MemberPlanChooser
                plans={plans as any}
                gymSlug={gymSlug}
                memberId={member.id}
                pickPlanAction={pickPlanForMember}
              />
            </div>
          )}
        </section>
      )}

      {showClassHistory && (
        <section className="border border-white/10 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/80">Class history</h2>
          </div>
          <MemberClassHistoryTable rows={checkInHistory} />
        </section>
      )}
    </div>
  );
}

