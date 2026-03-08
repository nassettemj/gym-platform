import { requireGymAccess } from "@/lib/gymAuth";

interface AdminPageProps {
  params: Promise<{
    gymSlug: string;
  }>;
}

export default async function GymAdminIndex({ params }: AdminPageProps) {
  const { gymSlug } = await params;

  const { gym, user } = await requireGymAccess(gymSlug);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{gym.name} admin</h1>
      <p className="text-sm text-white/70">
        Select a section from the menu (top right) to manage this gym.
      </p>
    </div>
  );
}
