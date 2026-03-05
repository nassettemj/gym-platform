import { prisma } from "@/lib/prisma";
import type { BillingInterval, CreditInterval } from "@prisma/client";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { MembershipPlansList } from "@/components/MembershipPlansList";

interface MembershipsPageProps {
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

  // Mandatory core fields
  if (!gymId || !name || !priceStr || !billingKind) return;

  const priceNumber = Number(priceStr.replace(",", "."));
  if (!Number.isFinite(priceNumber) || priceNumber < 0) return;

  const durationDays =
    billingKind === "ONE_TIME"
      ? mapBillingIntervalToDays(billingInterval || "DAY")
      : mapBillingIntervalToDays(billingInterval || "MONTH");
  const priceCents = Math.round(priceNumber * 100);

  try {
    await prisma.membershipPlan.create({
      data: {
        gymId,
        name,
        description: null,
        priceCents,
        durationDays,
        maxCheckInsPerMonth: null,
        billingKind: billingKind === "ONE_TIME" ? "ONE_TIME" : "SUBSCRIPTION",
        billingInterval: billingInterval
          ? (billingInterval as BillingInterval)
          : null,
        intervalCount: 1,
        usageKind: usageKind === "LIMITED_CREDITS" ? "LIMITED_CREDITS" : "UNLIMITED",
        creditsPerPeriod:
          usageKind === "LIMITED_CREDITS" && creditsPerPeriodRaw
            ? Number(creditsPerPeriodRaw)
            : null,
        creditsPeriodUnit:
          usageKind === "LIMITED_CREDITS" && creditsPerPeriodRaw
            ? ((creditsPeriodUnit || "WEEK") as CreditInterval)
            : null,
        stripeProductId: null,
        stripePriceId: null,
      },
    });
  } catch (err) {
    throw err;
  }

  redirect(`/${gymSlug}/admin/plans`);
}

async function updatePlan(formData: FormData) {
  "use server";

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const planId = String(formData.get("planId") ?? "");
  const gymSlug = String(formData.get("gymSlug") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const priceStr = String(formData.get("price") ?? "").trim();
  const billingKind = String(formData.get("billingKind") ?? "").trim();
  const billingInterval = String(formData.get("billingInterval") ?? "").trim();
  const usageKind = String(formData.get("usageKind") ?? "").trim();
  const creditsPerPeriodRaw = String(formData.get("creditsPerPeriod") ?? "").trim();
  const creditsPeriodUnit = String(formData.get("creditsPeriodUnit") ?? "").trim();

  if (!planId || !name || !priceStr || !billingKind) return;

  const priceNumber = Number(priceStr.replace(",", "."));
  if (!Number.isFinite(priceNumber) || priceNumber < 0) return;

  const durationDays =
    billingKind === "ONE_TIME"
      ? mapBillingIntervalToDays(billingInterval || "DAY")
      : mapBillingIntervalToDays(billingInterval || "MONTH");
  const priceCents = Math.round(priceNumber * 100);

  await prisma.membershipPlan.update({
    where: { id: planId },
    data: {
      name,
      priceCents,
      durationDays,
      maxCheckInsPerMonth: null,
      billingKind: billingKind === "ONE_TIME" ? "ONE_TIME" : "SUBSCRIPTION",
      billingInterval: billingInterval
        ? (billingInterval as BillingInterval)
        : null,
      intervalCount: 1,
      usageKind: usageKind === "LIMITED_CREDITS" ? "LIMITED_CREDITS" : "UNLIMITED",
      creditsPerPeriod:
        usageKind === "LIMITED_CREDITS" && creditsPerPeriodRaw
          ? Number(creditsPerPeriodRaw)
          : null,
      creditsPeriodUnit:
        usageKind === "LIMITED_CREDITS" && creditsPerPeriodRaw
          ? ((creditsPeriodUnit || "WEEK") as CreditInterval)
          : null,
    },
  });

  redirect(`/${gymSlug}/admin/plans`);
}

async function deletePlan(formData: FormData) {
  "use server";

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const planId = String(formData.get("planId") ?? "");
  const gymSlug = String(formData.get("gymSlug") ?? "");
  const confirm = String(formData.get("confirm") ?? "").trim();

  if (!planId || confirm !== "delete") return;

  // If needed later, delete related subscriptions/orderItems first.
  await prisma.membershipPlan.delete({
    where: { id: planId },
  });

  redirect(`/${gymSlug}/admin/plans`);
}

export default async function MembershipsPage({ params }: MembershipsPageProps) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const { gymSlug } = await params;

  let gym;
  try {
    gym = await prisma.gym.findUnique({
      where: { slug: gymSlug },
      include: {
        membershipPlans: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
  } catch (err) {
    throw err;
  }

  if (!gym) {
    notFound();
  }

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect("/login");
  }

  return (
    <div className="space-y-4">
      <section className="border border-white/10 rounded-xl p-4 space-y-4">
        <MembershipPlansList
          gymSlug={gymSlug}
          gymId={gym.id}
          plans={gym.membershipPlans}
          createAction={createPlan}
          updateAction={updatePlan}
          deleteAction={deletePlan}
        />
        {gym.membershipPlans.length === 0 && (
          <p className="text-sm text-white/60">No plans yet.</p>
        )}
      </section>
    </div>
  );
}
