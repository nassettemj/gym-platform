import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getAgeAt } from "@/lib/age";
import { MemberProfilePanel } from "@/components/MemberProfilePanel";
import { BeltRank } from "@prisma/client";

const BELT_OPTIONS: readonly (keyof typeof BeltRank)[] = ["WHITE", "BLUE", "PURPLE", "BROWN", "BLACK"];
const STRIPE_OPTIONS = [0, 1, 2, 3, 4] as const;

interface MemberDetailPageProps {
  params: Promise<{
    gymSlug: string;
    memberId: string;
  }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function updateMemberProfile(formData: FormData) {
  "use server";

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const gymSlug = String(formData.get("gymSlug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
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
    redirect("/login");
  }

  const member = await prisma.member.findFirst({
    where: { id: memberId, gymId: gym.id },
    select: { id: true, email: true, phone: true, birthDate: true },
  });
  if (!member) notFound();

  const newEmail = emailRaw || null;
  const newPhone = phoneRaw || null;
  let newBirthDate: Date | null = null;
  if (birthDateRaw) {
    const d = new Date(`${birthDateRaw}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) newBirthDate = d;
  }

  const logs: { fieldName: string; previousValue: string | null; newValue: string | null }[] = [];

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
      data: { email: newEmail, phone: newPhone, birthDate: newBirthDate },
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

async function updateBeltStripes(formData: FormData) {
  "use server";

  const session = await auth();
  const user = session?.user as { id?: string; role?: string; gymId?: string };
  if (!user) redirect("/login");
  const userId = user.id ?? (session as any)?.user?.id;

  const gymSlug = String(formData.get("gymSlug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const beltRaw = String(formData.get("belt") ?? "").trim();
  const stripesRaw = String(formData.get("stripes") ?? "").trim();

  if (!gymSlug || !memberId) return;
  if (!userId) {
    redirect(`/${gymSlug}/admin/members/${memberId}?beltError=${encodeURIComponent("Session missing user id. Please sign in again.")}`);
  }

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true },
  });
  if (!gym) notFound();

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect("/login");
  }

  const member = await prisma.member.findFirst({
    where: { id: memberId, gymId: gym.id },
    select: { id: true, belt: true, stripes: true },
  });
  if (!member) notFound();

  const newBelt: BeltRank | null = BELT_OPTIONS.includes(beltRaw as keyof typeof BeltRank)
    ? (BeltRank[beltRaw as keyof typeof BeltRank] as BeltRank)
    : null;
  let newStripes: number | null = null;
  if (stripesRaw !== "") {
    const n = Number(stripesRaw);
    if (!Number.isNaN(n) && n >= 0 && n <= 4) newStripes = n;
  }

  const prevBelt = member.belt;
  const prevStripes = member.stripes;
  const beltChanged = prevBelt !== newBelt || prevStripes !== newStripes;

  if (!beltChanged) {
    redirect(`/${gymSlug}/admin/members/${memberId}`);
  }

  try {
    await prisma.$transaction([
      prisma.member.update({
        where: { id: member.id },
        data: { belt: newBelt, stripes: newStripes },
      }),
      prisma.memberBeltStripeLog.create({
        data: {
          previousBelt: prevBelt,
          newBelt: newBelt,
          previousStripes: prevStripes,
          newStripes: newStripes,
          member: {
            connect: { id: member.id },
          },
          changedByUser: {
            connect: { id: userId },
          },
        },
      }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    redirect(`/${gymSlug}/admin/members/${memberId}?beltError=${encodeURIComponent(message)}`);
  }

  redirect(`/${gymSlug}/admin/members/${memberId}`);
}

async function createCheckIn(formData: FormData) {
  "use server";

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const gymSlug = String(formData.get("gymSlug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const classId = String(formData.get("classId") ?? "").trim();

  if (!gymSlug || !memberId || !classId) return;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true },
  });
  if (!gym) notFound();

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect("/login");
  }

  const [member, clazz] = await Promise.all([
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
  if (!user) redirect("/login");

  const gymSlug = String(formData.get("gymSlug") ?? "");
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

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect("/login");
  }

  const plan = await prisma.membershipPlan.findFirst({
    where: { id: planId, gymId: gym.id },
    select: { durationDays: true },
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
  if (!user) redirect("/login");

  const gymSlug = String(formData.get("gymSlug") ?? "");
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
    redirect("/login");
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

export default async function MemberDetailPage({
  params,
  searchParams,
}: MemberDetailPageProps) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const { gymSlug, memberId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const beltError = typeof resolvedSearchParams.beltError === "string" ? resolvedSearchParams.beltError : null;

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
    redirect("/login");
  }

  const now = new Date();
  const classWindowEnd = new Date(now);
  classWindowEnd.setDate(classWindowEnd.getDate() + 60);

  const [member, plans, classesForCheckIn] = await Promise.all([
    prisma.member.findFirst({
      where: {
        id: memberId,
        gymId: gym.id,
      },
      include: {
        subscriptions: {
          include: {
            plan: true,
          },
          orderBy: { createdAt: "desc" },
        },
        beltStripeLogs: {
          orderBy: { changedAt: "desc" },
          take: 50,
          include: { changedByUser: { select: { name: true } } },
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
    prisma.class.findMany({
      where: {
        location: { gymId: gym.id },
        startAt: { gte: now, lte: classWindowEnd },
      },
      include: { location: true },
      orderBy: { startAt: "asc" },
      take: 100,
    }),
  ]);

  if (!member) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        {gym.name} · {member.firstName} {member.lastName}
      </h1>

      <section className="border border-white/10 rounded-xl p-4 space-y-4">
        <MemberProfilePanel
          member={{
            id: member.id,
            email: member.email,
            phone: member.phone,
            birthDate: member.birthDate,
            status: member.status,
          }}
          gymSlug={gymSlug}
          updateAction={updateMemberProfile}
        />
      </section>

      <section className="border border-white/10 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-medium text-white/80">Belt & stripes</h2>
        {beltError && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {beltError}
          </p>
        )}
        <form action={updateBeltStripes} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="gymSlug" value={gymSlug} />
          <input type="hidden" name="memberId" value={member.id} />
          <div className="flex flex-col gap-1">
            <label htmlFor="belt" className="text-xs font-medium text-white/80">
              Belt
            </label>
            <select
              id="belt"
              name="belt"
              className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              defaultValue={member.belt ?? ""}
            >
              <option value="">—</option>
              {BELT_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b.charAt(0) + b.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="stripes" className="text-xs font-medium text-white/80">
              Stripes
            </label>
            <select
              id="stripes"
              name="stripes"
              className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              defaultValue={member.stripes ?? ""}
            >
              <option value="">—</option>
              {STRIPE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center px-3 py-2 rounded-md bg-orange-600 text-[11px] font-medium hover:bg-orange-500"
          >
            Update
          </button>
        </form>
      </section>

      <section className="border border-white/10 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-medium text-white/80">Belt & stripes history</h2>
        {member.beltStripeLogs.length === 0 ? (
          <p className="text-xs text-white/60">No belt or stripe changes recorded.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {member.beltStripeLogs.map((log) => {
              const when = new Date(log.changedAt).toLocaleString();
              const by = log.changedByUser?.name ?? "—";
              const beltPart =
                log.previousBelt != null || log.newBelt != null
                  ? `Belt: ${log.previousBelt ?? "—"} → ${log.newBelt ?? "—"}`
                  : null;
              const stripePart =
                log.previousStripes != null || log.newStripes != null
                  ? `Stripes: ${log.previousStripes ?? "—"} → ${log.newStripes ?? "—"}`
                  : null;
              return (
                <li
                  key={log.id}
                  className="border border-white/10 rounded-md px-3 py-2 bg-black/40"
                >
                  <div className="flex justify-between gap-2">
                    <span className="text-white/90">{when}</span>
                    <span className="text-white/60">by {by}</span>
                  </div>
                  {(beltPart || stripePart) && (
                    <div className="mt-1 text-white/80">
                      {[beltPart, stripePart].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="border border-white/10 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-medium text-white/80">Profile change history</h2>
        {member.profileChangeLogs.length === 0 ? (
          <p className="text-xs text-white/60">No profile changes recorded.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {member.profileChangeLogs.map((log) => {
              const when = new Date(log.changedAt).toLocaleString();
              const by = log.changedByUser?.name ?? "—";
              const fieldLabel =
                log.fieldName === "birthDate"
                  ? "Date of birth"
                  : log.fieldName.charAt(0).toUpperCase() + log.fieldName.slice(1);
              return (
                <li
                  key={log.id}
                  className="border border-white/10 rounded-md px-3 py-2 bg-black/40"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-white/90">{fieldLabel}</span>
                    <span className="text-white/60">{when}</span>
                  </div>
                  <div className="mt-1 text-white/80">
                    {log.previousValue ?? "—"} → {log.newValue ?? "—"}
                  </div>
                  <div className="mt-1 text-[11px] text-white/60">
                    Changed by {by}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {classesForCheckIn.length > 0 && (
        <section className="border border-white/10 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-white/80">Check in to class</h2>
          <form action={createCheckIn} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="gymSlug" value={gymSlug} />
            <input type="hidden" name="memberId" value={member.id} />
            <div className="flex flex-col gap-1">
              <label htmlFor="classId" className="text-xs font-medium text-white/80">
                Class
              </label>
              <select
                id="classId"
                name="classId"
                required
                className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="">Select class…</option>
                {classesForCheckIn.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.startAt ? new Date(c.startAt).toLocaleString() : ""}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center px-3 py-2 rounded-md bg-orange-600 text-[11px] font-medium hover:bg-orange-500"
            >
              Check in
            </button>
          </form>
        </section>
      )}

      <section className="border border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white/80">Plans</h2>
        </div>

        {plans.length > 0 && (
          <details className="border border-white/10 rounded-md p-3 text-xs space-y-2">
            <summary className="cursor-pointer list-none flex items-center justify-between">
              <span className="font-medium text-white/80">Add plan</span>
              <span className="text-[11px] text-white/60">
                Click to assign a plan to this member
              </span>
            </summary>

            <form
              action={addSubscription}
              className="mt-2 grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
            >
              <input type="hidden" name="gymSlug" value={gymSlug} />
              <input type="hidden" name="memberId" value={member.id} />

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="planId"
                  className="text-xs font-medium text-white/80"
                >
                  Plan
                </label>
                <select
                  id="planId"
                  name="planId"
                  required
                  className="px-2 py-1 rounded-md bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs"
                >
                  <option value="">Select plan…</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="startDate"
                  className="text-xs font-medium text-white/80"
                >
                  Start date
                </label>
                <input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  className="px-2 py-1 rounded-md bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="autoRenew"
                  className="text-xs font-medium text-white/80"
                >
                  Auto renew
                </label>
                <select
                  id="autoRenew"
                  name="autoRenew"
                  defaultValue="no"
                  className="px-2 py-1 rounded-md bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>

              <div className="flex">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center px-3 py-2 rounded-md bg-orange-600 text-[11px] font-medium hover:bg-orange-500 transition-colors w-full md:w-auto"
                >
                  Add plan
                </button>
              </div>
            </form>
          </details>
        )}

        {member.subscriptions.length === 0 ? (
          <p className="text-sm text-white/60">
            This member has no plans yet.
          </p>
        ) : (
          <div className="overflow-x-auto border border-white/10 rounded-lg">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-3 py-2 text-left text-xs font-semibold">
                    Plan
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">
                    Starts
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">
                    Ends
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">
                    Auto-renew
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {member.subscriptions.map((sub) => {
                  const starts = new Date(sub.startsAt).toLocaleDateString();
                  const ends = new Date(sub.endsAt).toLocaleDateString();
                  return (
                    <tr
                      key={sub.id}
                      className="border-b border-white/5 hover:bg-white/5 align-top"
                    >
                      <td className="px-3 py-2 text-xs text-white/90">
                        {sub.plan?.name ?? "Unknown plan"}
                      </td>
                      <td className="px-3 py-2 text-xs text-white/80">
                        {sub.status}
                      </td>
                      <td className="px-3 py-2 text-xs text-white/80">
                        {starts}
                      </td>
                      <td className="px-3 py-2 text-xs text-white/80">
                        {ends}
                      </td>
                      <td className="px-3 py-2 text-xs text-white/80">
                        {sub.autoRenew ? "Yes" : "No"}
                      </td>
                      <td className="px-3 py-2 text-xs text-white/80">
                        <details className="space-y-2">
                          <summary className="cursor-pointer text-orange-400 hover:text-orange-300">
                            Cancel plan
                          </summary>
                          <form
                            action={cancelSubscription}
                            className="mt-1 flex flex-col gap-2"
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
                              value={sub.id}
                            />
                            <div className="flex flex-col gap-1">
                              <label
                                htmlFor={`cancelDate-${sub.id}`}
                                className="text-[11px] font-medium text-white/80"
                              >
                                Cancellation date
                              </label>
                              <input
                                id={`cancelDate-${sub.id}`}
                                name="cancelDate"
                                type="date"
                                required
                                className="px-2 py-1 rounded-md bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-red-500 text-[11px]"
                              />
                            </div>
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-red-600 text-[11px] font-medium hover:bg-red-500 transition-colors"
                            >
                              Confirm cancellation
                            </button>
                          </form>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

