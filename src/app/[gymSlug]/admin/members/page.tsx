import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { GymMemberForm } from "@/components/GymMemberForm";

interface MembersPageProps {
  params: Promise<{
    gymSlug: string;
  }>;
}

async function createMember(formData: FormData) {
  "use server";

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const gymId = String(formData.get("gymId") ?? "");
  const gymSlug = String(formData.get("gymSlug") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const memberType = String(formData.get("memberType") ?? "ADULT") as
    | "ADULT"
    | "CHILD";
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw || null;

  if (!gymId || !firstName || !lastName) return;

  const child = await prisma.member.create({
    data: {
      gymId,
      firstName,
      lastName,
      email: email || null,
      phone: phone || null,
      memberType,
    },
  });

  if (memberType === "CHILD" && parentId) {
    await prisma.memberRelation.create({
      data: {
        adultId: parentId,
        childId: child.id,
        relationship: "parent",
      },
    });
  }

  revalidatePath(`/${gymSlug}/admin/members`);
}

export default async function MembersPage({ params }: MembersPageProps) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const { gymSlug } = await params;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    include: {
      members: {
        orderBy: { lastName: "asc" },
      },
    },
  });

  if (!gym) {
    notFound();
  }

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect("/login");
  }

  const memberCount = gym.members.length;
  const adultsForSelect = gym.members
    .filter((m) => m.memberType === "ADULT")
    .map((m) => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
    }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{gym.name} · Members</h1>

      <section className="border border-white/10 rounded-xl p-4 space-y-4">
        <p className="text-xs text-white/70">
          Total members: <span className="font-semibold">{memberCount}</span>
        </p>

        <h2 className="text-sm font-medium text-white/80">Add member</h2>
        <GymMemberForm
          gymId={gym.id}
          gymSlug={gymSlug}
          adults={adultsForSelect}
          action={createMember}
        />

        <div className="pt-2 border-t border-white/10">
          <h3 className="text-xs font-medium text-white/70 mb-2">
            Existing members
          </h3>
          {gym.members.length === 0 ? (
            <p className="text-sm text-white/60">No members yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {gym.members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between"
                >
                  <span>
                    {m.firstName} {m.lastName}
                  </span>
                  <span className="text-xs text-white/60">
                    {m.memberType}
                    {m.email ? ` · ${m.email}` : ""}
                    {m.phone ? ` · ${m.phone}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
