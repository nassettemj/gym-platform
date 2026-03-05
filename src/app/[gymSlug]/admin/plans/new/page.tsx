import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { MembershipPlanForm } from "@/components/MembershipPlanForm";

interface NewPlanPageProps {
  params: Promise<{
    gymSlug: string;
  }>;
}

function mapBillingIntervalToDays(value: string): number {
  switch (value) {
    case "DAY":
      return 1;
    case "WEEK":
      return 7;
    case "MONTH":
      return 30;
    case "YEAR":
      return 365;
    default:
      return 30;
  }
}

async function createPlan(formData: FormData) {
  "use server";

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const gymId = String(formData.get("gymId") ?? "");
  const gymSlug = String(formData.get("gymSlug") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const priceStr = String(formData.get("price") ?? "").trim();
  const billingKind = String(formData.get("billingKind") ?? "").trim();
  const billingInterval = String(formData.get("billingInterval") ?? "").trim();
  const usageKind = String(formData.get("usageKind") ?? "").trim();
  const creditsPerPeriodRaw = String(formData.get("creditsPerPeriod") ?? "").trim();
  const creditsPeriodUnit = String(formData.get("creditsPeriodUnit") ?? "").trim();

  if (!gymId || !name || !priceStr || !billingKind) return;

  const priceNumber = Number(priceStr.replace(",", "."));
  if (!Number.isFinite(priceNumber) || priceNumber < 0) return;

  const durationDays =
    billingKind === "ONE_TIME"
      ? mapBillingIntervalToDays(billingInterval || "DAY")
      : mapBillingIntervalToDays(billingInterval || "MONTH");
  const priceCents = Math.round(priceNumber * 100);

  await prisma.membershipPlan.create({
    data: {
      gymId,
      name,
      description: null,
      priceCents,
      durationDays,
      maxCheckInsPerMonth: null,
      billingKind: billingKind === "ONE_TIME" ? "ONE_TIME" : "SUBSCRIPTION",
      billingInterval: billingInterval || null,
      intervalCount: 1,
      usageKind: usageKind === "LIMITED_CREDITS" ? "LIMITED_CREDITS" : "UNLIMITED",
      creditsPerPeriod:
        usageKind === "LIMITED_CREDITS" && creditsPerPeriodRaw
          ? Number(creditsPerPeriodRaw)
          : null,
      creditsPeriodUnit:
        usageKind === "LIMITED_CREDITS" && creditsPerPeriodRaw
          ? (creditsPeriodUnit || "WEEK")
          : null,
      stripeProductId: null,
      stripePriceId: null,
    },
  });

  redirect(`/${gymSlug}/admin/plans`);
}

export default async function NewPlanPage({ params }: NewPlanPageProps) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const { gymSlug } = await params;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: {
      id: true,
      name: true,
    },
  });

  if (!gym) notFound();

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect("/login");
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

