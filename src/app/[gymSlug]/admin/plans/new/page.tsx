import { prisma } from "@/lib/prisma";
import type { PlanDuration, PlanAge, PlanVisits } from "@prisma/client";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { MembershipPlanForm } from "@/components/MembershipPlanForm";

interface NewPlanPageProps {
  params: Promise<{
    gymSlug: string;
  }>;
}

function durationDaysFromDuration(duration: string): number {
  return duration === "ONE_YEAR" ? 365 : 30;
}

function durationDaysFromVisits(visits: string): number {
  return visits === "TEN_VISITS" ? 90 : 30;
}

function maxCheckInsFromVisits(visits: string): number | null {
  return visits === "TEN_VISITS" ? 10 : 1;
}

async function createPlan(formData: FormData) {
  "use server";

  const gymSlug = String(formData.get("gymSlug") ?? "");

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const gymId = String(formData.get("gymId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const priceStr = String(formData.get("price") ?? "").trim();
  const billingKind = String(formData.get("billingKind") ?? "").trim();
  const duration = String(formData.get("duration") ?? "").trim();
  const age = String(formData.get("age") ?? "").trim();
  const visits = String(formData.get("visits") ?? "").trim();

  if (!gymId || !name || !priceStr || !billingKind) return;

  const priceNumber = Number(priceStr.replace(",", "."));
  if (!Number.isFinite(priceNumber) || priceNumber < 0) return;

  const isPass = billingKind === "PASS";
  const durationDays = isPass
    ? durationDaysFromVisits(visits || "ONE_VISIT")
    : durationDaysFromDuration(duration || "ONE_MONTH");
  const maxCheckIns = isPass ? maxCheckInsFromVisits(visits || "ONE_VISIT") : null;
  const priceCents = Math.round(priceNumber * 100);

  const stripeProductId: string | null = null;
  const stripePriceId: string | null = null;

  await prisma.membershipPlan.create({
    data: {
      gymId,
      name,
      description: null,
      priceCents,
      durationDays,
      maxCheckInsPerMonth: maxCheckIns,
      billingKind: isPass ? "PASS" : "SUBSCRIPTION",
      duration: (duration === "ONE_YEAR" ? "ONE_YEAR" : "ONE_MONTH") as PlanDuration,
      age: (age === "KIDS_AND_JUNIORS" ? "KIDS_AND_JUNIORS" : "ADULTS") as PlanAge,
      visits: isPass ? ((visits === "TEN_VISITS" ? "TEN_VISITS" : "ONE_VISIT") as PlanVisits) : null,
      stripeProductId,
      stripePriceId,
    },
  });

  redirect(`/${gymSlug}/admin/plans`);
}

export default async function NewPlanPage({ params }: NewPlanPageProps) {
  const { gymSlug } = await params;

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

  if (!gym) notFound();

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  return (
    <div className="space-y-4">
      <section className="border border-white/10 rounded-xl p-4 space-y-4 bg-black/40">
        <h2 className="text-sm font-medium text-white/80">Create plan</h2>
        <MembershipPlanForm
          gymId={gym.id}
          gymSlug={gymSlug}
          action={createPlan}
          forceOpen
        />
      </section>
    </div>
  );
}

