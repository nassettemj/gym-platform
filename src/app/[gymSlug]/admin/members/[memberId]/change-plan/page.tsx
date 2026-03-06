import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { MemberPlanChooser } from "@/components/MemberPlanChooser";

interface ChangePlanPageProps {
  params: Promise<{
    gymSlug: string;
    memberId: string;
  }>;
}

async function pickPlanForMemberFromChangePage(formData: FormData) {
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

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect(`/${gymSlug}/login`);

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

