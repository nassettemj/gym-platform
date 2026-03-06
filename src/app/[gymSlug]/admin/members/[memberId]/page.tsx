import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAgeAt } from "@/lib/age";
import { MemberProfilePanel } from "@/components/MemberProfilePanel";
import { MemberPlanChooser } from "@/components/MemberPlanChooser";
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

async function createCheckIn(formData: FormData) {
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
        location: { gymId: gym.id },
      },
      include: { location: true },
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
  if (clazz.minAgeYears != null || clazz.maxAgeYears != null) {
    if (!member.birthDate) {
      redirect(`/${gymSlug}/admin/members/${memberId}?error=birthdate_required`);
    }
    const age = getAgeAt(member.birthDate, at);
    if (clazz.minAgeYears != null && age < clazz.minAgeYears) {
      redirect(`/${gymSlug}/admin/members/${memberId}?error=too_young`);
    }
    if (clazz.maxAgeYears != null && age > clazz.maxAgeYears) {
      redirect(`/${gymSlug}/admin/members/${memberId}?error=too_old`);
    }
  }

  // Enforce plan usage limits if there is an active subscription with limited credits.
  if (activeSubscription?.plan?.usageKind === "LIMITED_CREDITS" && activeSubscription.plan.creditsPerPeriod != null && activeSubscription.plan.creditsPeriodUnit != null) {
    const unit = activeSubscription.plan.creditsPeriodUnit;

    let windowStart = new Date(at);
    let windowEnd = new Date(at);

    if (unit === "DAY") {
      windowStart.setHours(0, 0, 0, 0);
      windowEnd.setHours(23, 59, 59, 999);
    } else if (unit === "WEEK") {
      const day = windowStart.getDay(); // 0 (Sun) - 6 (Sat)
      const diffToMonday = (day + 6) % 7; // Monday as start of week
      windowStart.setDate(windowStart.getDate() - diffToMonday);
      windowStart.setHours(0, 0, 0, 0);
      windowEnd = new Date(windowStart);
      windowEnd.setDate(windowEnd.getDate() + 7);
    } else if (unit === "MONTH") {
      windowStart = new Date(windowStart.getFullYear(), windowStart.getMonth(), 1, 0, 0, 0, 0);
      windowEnd = new Date(windowStart.getFullYear(), windowStart.getMonth() + 1, 1, 0, 0, 0, 0);
    } else if (unit === "YEAR") {
      windowStart = new Date(windowStart.getFullYear(), 0, 1, 0, 0, 0, 0);
      windowEnd = new Date(windowStart.getFullYear() + 1, 0, 1, 0, 0, 0, 0);
    } else if (unit === "NONE") {
      windowStart = activeSubscription.startsAt;
      windowEnd = activeSubscription.endsAt;
    }

    const usedCount = await prisma.checkIn.count({
      where: {
        memberId: member.id,
        checkedAt: {
          gte: windowStart,
          lt: windowEnd,
        },
      },
    });

    if (usedCount >= activeSubscription.plan.creditsPerPeriod) {
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

  redirect(`/${gymSlug}/admin/members/${memberId}`);
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
                    {summarySubscription.plan?.billingKind === "ONE_TIME"
                      ? "One-time"
                      : summarySubscription.plan?.billingInterval === "DAY"
                      ? "Daily subscription"
                      : summarySubscription.plan?.billingInterval === "WEEK"
                      ? "Weekly subscription"
                      : summarySubscription.plan?.billingInterval === "YEAR"
                      ? "Yearly subscription"
                      : "Monthly subscription"}
                  </div>
                  <div>
                    {summarySubscription.plan?.usageKind === "UNLIMITED"
                      ? "Unlimited"
                      : summarySubscription.plan?.creditsPerPeriod != null &&
                        summarySubscription.plan?.creditsPeriodUnit != null
                      ? (() => {
                          const unit =
                            summarySubscription.plan!.creditsPeriodUnit ===
                            "DAY"
                              ? "day"
                              : summarySubscription.plan!.creditsPeriodUnit ===
                                "WEEK"
                              ? "week"
                              : summarySubscription.plan!.creditsPeriodUnit ===
                                "MONTH"
                              ? "month"
                              : summarySubscription.plan!.creditsPeriodUnit ===
                                "YEAR"
                              ? "year"
                              : "total";
                          if (
                            summarySubscription.plan!.creditsPeriodUnit ===
                            "NONE"
                          ) {
                            return `${summarySubscription.plan!.creditsPerPeriod} classes total`;
                          }
                          return `${summarySubscription.plan!.creditsPerPeriod} classes/${unit}`;
                        })()
                      : "Limited credits"}
                  </div>
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
    </div>
  );
}

