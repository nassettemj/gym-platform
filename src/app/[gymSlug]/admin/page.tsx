import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { GymMemberForm } from "@/components/GymMemberForm";
import { auth } from "@/auth";

interface AdminPageProps {
  params: Promise<{
    gymSlug: string;
  }>;
}

async function createLocation(formData: FormData) {
  "use server";

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const gymId = String(formData.get("gymId") ?? "");
  const gymSlug = String(formData.get("gymSlug") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const zipCode = String(formData.get("zipCode") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();

  if (!gymId || !name) return;

  const fullAddressParts = [address, zipCode, city, country].filter(Boolean);
  const fullAddress =
    fullAddressParts.length > 0 ? fullAddressParts.join(", ") : null;

  await prisma.location.create({
    data: {
      gymId,
      name,
      address: fullAddress,
    },
  });

  revalidatePath(`/${gymSlug}/admin`);
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

  revalidatePath(`/${gymSlug}/admin`);
}

export default async function GymAdminPage({ params }: AdminPageProps) {
  const session = await auth();
  const user = session?.user as any;

  if (!user) {
    redirect("/login");
  }

  const { gymSlug } = await params;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    include: {
      locations: true,
      members: {
        orderBy: { lastName: "asc" },
      },
    },
  });

  if (!gym) {
    notFound();
  }

  // Allow platform admins or users whose gymId matches this gym
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{gym.name} admin</h1>
          <p className="text-sm text-white/70 mt-1">
            Gym slug: <code>{gym.slug}</code>
          </p>
        </div>
        <Link
          href="/platform/gyms"
          className="text-xs text-white/60 hover:text-white"
        >
          ← Back to platform gyms
        </Link>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-white/10 rounded-xl p-4">
          <h2 className="text-sm font-medium text-white/80">Members</h2>
          <p className="mt-2 text-2xl font-semibold">{memberCount}</p>
          <p className="text-xs text-white/60 mt-1">
            (Parent/child relationships enabled for children)
          </p>
        </div>

        <div className="border border-white/10 rounded-xl p-4">
          <h2 className="text-sm font-medium text-white/80">Locations</h2>
          <p className="mt-2 text-2xl font-semibold">
            {gym.locations.length}
          </p>
          <p className="text-xs text-white/60 mt-1">
            (Location CRUD in progress)
          </p>
        </div>

        <div className="border border-white/10 rounded-xl p-4">
          <h2 className="text-sm font-medium text-white/80">Status</h2>
          <p className="mt-2 text-lg font-semibold">{gym.status}</p>
          <p className="text-xs text-white/60 mt-1">
            (Gym customization & billing to be implemented)
          </p>
        </div>
      </section>

      {/* Locations */}
      <section className="border border-white/10 rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-medium text-white/80">Add location</h2>
        <form
          action={createLocation}
          className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
        >
          <input type="hidden" name="gymId" value={gym.id} />
          <input type="hidden" name="gymSlug" value={gym.slug} />

          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-xs font-medium">
              Name
            </label>
            <input
              id="name"
              name="name"
              required
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
              placeholder="Main Dojo"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="address" className="text-xs font-medium">
              Address
            </label>
            <input
              id="address"
              name="address"
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
              placeholder="Street and number"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="zipCode" className="text-xs font-medium">
              Zip Code
            </label>
            <input
              id="zipCode"
              name="zipCode"
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
              placeholder="1234 AB"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="city" className="text-xs font-medium">
              City
            </label>
            <input
              id="city"
              name="city"
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
              placeholder="Amsterdam"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="country" className="text-xs font-medium">
              Country
            </label>
            <input
              id="country"
              name="country"
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
              placeholder="Netherlands"
            />
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-600 text-xs font-medium hover:bg-orange-500 transition-colors md:mt-4"
          >
            Add location
          </button>
        </form>

        <div className="pt-2 border-t border-white/10">
          <h3 className="text-xs font-medium text-white/70 mb-2">
            Existing locations
          </h3>
          {gym.locations.length === 0 ? (
            <p className="text-sm text-white/60">No locations yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {gym.locations.map((loc) => (
                <li
                  key={loc.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between"
                >
                  <span className="font-medium">{loc.name}</span>
                  <span className="text-xs text-white/60">
                    {loc.address ?? "No address set"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Members */}
      <section className="border border-white/10 rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-medium text-white/80">Add member</h2>
        <GymMemberForm
          gymId={gym.id}
          gymSlug={gym.slug}
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
