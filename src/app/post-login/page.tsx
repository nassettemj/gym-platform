import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function PostLoginPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  const userId = (session.user as any).id as string | undefined;

  if (!userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      memberId: true,
      gym: {
        select: { slug: true },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const gymSlug = user.gym?.slug ?? null;

  if (user.role === "PLATFORM_ADMIN") {
    redirect("/platform/gyms");
  }

  if (gymSlug) {
    if (user.memberId) {
      const member = await prisma.member.findFirst({
        where: { id: user.memberId },
        include: {
          subscriptions: {
            where: { status: "ACTIVE" },
            include: { plan: true },
          },
        },
      });
      const now = new Date();
      const hasActiveSubscription =
        member?.subscriptions?.some(
          (s) => s.startsAt <= now && s.endsAt > now
        ) ?? false;
      const isStaff =
        ["GYM_ADMIN", "STAFF", "INSTRUCTOR", "LOCATION_ADMIN"].includes(
          user.role ?? ""
        );
      if (hasActiveSubscription || isStaff) {
        redirect(`/${gymSlug}/admin/my-schedule`);
      }
    }

    if (user.role === "MEMBER" && user.memberId) {
      redirect(`/${gymSlug}/admin/members/${user.memberId}`);
    }

    if (user.role === "GYM_ADMIN") {
      redirect(`/${gymSlug}/admin`);
    }

    // Fallback for other roles tied to a gym.
    redirect(`/${gymSlug}/admin`);
  }

  // If no gym, send to a sensible default.
  redirect("/platform/gyms");
}

