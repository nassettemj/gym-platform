import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

interface AdminPageProps {
  params: Promise<{
    gymSlug: string;
  }>;
}

export default async function GymAdminIndex({ params }: AdminPageProps) {
  const { gymSlug } = await params;

  const session = await auth();
  const user = session?.user as any;

  if (!user) {
    redirect(`/${gymSlug}/login`);
  }

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true, name: true },
  });

  if (!gym) {
    redirect("/platform/gyms");
  }

  // Allow platform admins or users whose gymId matches this gym
  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{gym.name} admin</h1>
      <p className="text-sm text-white/70">
        Select a section from the menu (top right) to manage this gym.
      </p>
    </div>
  );
}
