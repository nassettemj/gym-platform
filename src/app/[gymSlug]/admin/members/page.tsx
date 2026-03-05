import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { GymMemberFormToggle } from "@/components/GymMemberFormToggle";
import { MembersTable } from "@/components/MembersTable";

interface MembersPageProps {
  params: Promise<{
    gymSlug: string;
  }>;
}

async function createMember(formData: FormData) {
  "use server";

  const gymSlug = String(formData.get("gymSlug") ?? "");

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const gymId = String(formData.get("gymId") ?? "");
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const memberType = String(formData.get("memberType") ?? "ADULT") as
    | "ADULT"
    | "CHILD";
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw || null;
  const isInstructor = formData.get("isInstructor") === "on";

  if (!gymId || !firstName || !lastName) return;

  const member = await prisma.member.create({
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
        childId: member.id,
        relationship: "parent",
      },
    });
  }

  if (isInstructor) {
    await prisma.instructor.create({
      data: {
        gymId,
        memberId: member.id,
        name: `${member.firstName} ${member.lastName}`,
      },
    });
  }

  redirect(`/${gymSlug}/admin/members`);
}

export default async function MembersPage({ params }: MembersPageProps) {
  const { gymSlug } = await params;

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect(`/${gymSlug}/login`);

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    include: {
      members: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!gym) {
    notFound();
  }

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  const memberCount = gym.members.length;
  const adultsForSelect = gym.members
    .filter((m) => m.memberType === "ADULT")
    .map((m) => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
    }));

  const memberRows = gym.members.map((m) => ({
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    email: m.email,
    phone: m.phone,
    memberType: m.memberType as "ADULT" | "CHILD",
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-4">
      <section className="border border-white/10 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-white/70">
            Total members: <span className="font-semibold">{memberCount}</span>
          </p>
          <GymMemberFormToggle
            gymId={gym.id}
            gymSlug={gymSlug}
            adults={adultsForSelect}
            action={createMember}
          />
        </div>

        <div className="pt-2 border-t border-white/10">
          <MembersTable members={memberRows} />
        </div>
      </section>
    </div>
  );
}
