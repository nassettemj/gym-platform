import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { MembershipPlanForm } from "@/components/MembershipPlanForm";
import { MembershipPlansList } from "@/components/MembershipPlansList";

interface MembershipsPageProps {
  params: Promise<{
    gymSlug: string;
  }>;
}

function mapDurationToDays(value: string): number {
  switch (value) {
    case "single_day":
      return 1;
    case "week":
      return 7;
    case "month":
      return 30;
    case "year":
      return 365;
    default:
      return 30;
  }
}

function mapClassLimit(value: string): number | null {
  if (value === "unlimited") return null;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? null : n;
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
  const duration = String(formData.get("duration") ?? "").trim();
  const classLimit = String(formData.get("classLimit") ?? "").trim();

  // All fields mandatory
  if (!gymId || !name || !priceStr || !duration || !classLimit) return;

  const priceNumber = Number(priceStr.replace(",", "."));
  if (!Number.isFinite(priceNumber) || priceNumber < 0) return;

  const durationDays = mapDurationToDays(duration);
  const maxCheckInsPerMonth = mapClassLimit(classLimit);
  const priceCents = Math.round(priceNumber * 100);

  await prisma.membershipPlan.create({
    data: {
      gymId,
      name,
      description: null,
      priceCents,
      durationDays,
      maxCheckInsPerMonth,
    },
  });

  redirect(`/${gymSlug}/admin/memberships`);
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
  const duration = String(formData.get("duration") ?? "").trim();
  const classLimit = String(formData.get("classLimit") ?? "").trim();

  if (!planId || !name || !priceStr || !duration || !classLimit) return;

  const priceNumber = Number(priceStr.replace(",", "."));
  if (!Number.isFinite(priceNumber) || priceNumber < 0) return;

  const durationDays = mapDurationToDays(duration);
  const maxCheckInsPerMonth = mapClassLimit(classLimit);
  const priceCents = Math.round(priceNumber * 100);

  await prisma.membershipPlan.update({
    where: { id: planId },
    data: {
      name,
      priceCents,
      durationDays,
      maxCheckInsPerMonth,
    },
  });

  redirect(`/${gymSlug}/admin/memberships`);
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

  redirect(`/${gymSlug}/admin/memberships`);
}

export default async function MembershipsPage({ params }: MembershipsPageProps) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const { gymSlug } = await params;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    include: {
      membershipPlans: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!gym) {
    notFound();
  }

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect("/login");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{gym.name} · Plans</h1>

      <section className="border border-white/10 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white/80">Plans</h2>
          <MembershipPlanForm
            gymId={gym.id}
            gymSlug={gymSlug}
            action={createPlan}
          />
        </div>

        <div className="pt-2 border-t border-white/10">
          <h3 className="text-xs font-medium text-white/70 mb-2">
            Existing plans
          </h3>
          {gym.membershipPlans.length === 0 ? (
            <p className="text-sm text-white/60">No plans yet.</p>
          ) : (
            <MembershipPlansList
              gymSlug={gymSlug}
              plans={gym.membershipPlans}
              updateAction={updatePlan}
              deleteAction={deletePlan}
            />
          )}
        </div>
      </section>
    </div>
  );
}
