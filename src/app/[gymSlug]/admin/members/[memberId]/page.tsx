import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";

interface MemberDetailPageProps {
  params: Promise<{
    gymSlug: string;
    memberId: string;
  }>;
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
}: MemberDetailPageProps) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const { gymSlug, memberId } = await params;

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

  const [member, plans] = await Promise.all([
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

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        {gym.name} · {member.firstName} {member.lastName}
      </h1>

      <section className="border border-white/10 rounded-xl p-4 space-y-4">
        <div className="space-y-1 text-sm">
          <p className="text-white/80">
            <span className="font-semibold">Status:</span>{" "}
            <span className="uppercase">{member.status}</span>
          </p>
          {member.email && (
            <p className="text-white/80">
              <span className="font-semibold">Email:</span> {member.email}
            </p>
          )}
          {member.phone && (
            <p className="text-white/80">
              <span className="font-semibold">Phone:</span> {member.phone}
            </p>
          )}
        </div>
      </section>

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

