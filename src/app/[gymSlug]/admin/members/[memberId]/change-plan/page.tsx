import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { MemberPlanChooser } from "@/components/MemberPlanChooser";
import { getGymAndUser, requireGymAccess } from "@/lib/gymAuth";

interface ChangePlanPageProps {
  params: Promise<{
    gymSlug: string;
    memberId: string;
  }>;
}

async function pickPlanForMemberFromChangePage(formData: FormData) {
  "use server";

  const gymSlug = String(formData.get("gymSlug") ?? "");
  const memberId = String(formData.get("memberId") ?? "");
  const planId = String(formData.get("planId") ?? "");

  if (!gymSlug || !memberId || !planId) return;

  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const plan = await prisma.membershipPlan.findFirst({
    where: { id: planId, gymId: ctx.gym.id },
    select: {
      id: true,
      durationDays: true,
    },
  });

  if (!plan) {
    return;
  }

  // Mark any active subscriptions for this member as CHANGED before creating the new one
  await prisma.subscription.updateMany({
    where: {
      memberId,
      status: "ACTIVE",
    },
    data: { status: "CHANGED" },
  });

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

export default async function ChangePlanPage({ params }: ChangePlanPageProps) {
  const { gymSlug, memberId } = await params;

  const { gym } = await requireGymAccess(gymSlug);

  const member = await prisma.member.findFirst({
    where: {
      id: memberId,
      gymId: gym.id,
    },
    select: { id: true },
  });

  if (!member) {
    notFound();
  }

  const plans = await prisma.membershipPlan.findMany({
    where: { gymId: gym.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-base font-semibold text-white">Change plan</h1>
        <p className="text-xs text-white/70">
          Choose a different plan from the options below. Your selected plan will
          start when your current plan expires at the end of the month.
        </p>
      </header>

      {plans.length === 0 ? (
        <p className="text-xs text-white/70">
          There are no plans configured for this gym yet.
        </p>
      ) : (
        <MemberPlanChooser
          plans={plans as any}
          gymSlug={gymSlug}
          memberId={member.id}
          pickPlanAction={pickPlanForMemberFromChangePage}
          showWarning={false}
        />
      )}
    </div>
  );
}

