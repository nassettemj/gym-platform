import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";

interface LocationsPageProps {
  params: Promise<{
    gymSlug: string;
  }>;
}

async function createLocation(formData: FormData) {
  "use server";

  const gymSlug = String(formData.get("gymSlug") ?? "");

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const gymId = String(formData.get("gymId") ?? "");
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

  redirect(`/${gymSlug}/admin/locations`);
}

export default async function LocationsPage({ params }: LocationsPageProps) {
  const { gymSlug } = await params;

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect(`/${gymSlug}/login`);

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    include: {
      locations: true,
    },
  });

  if (!gym) {
    notFound();
  }

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  return (
    <div className="space-y-4">
      <section className="border border-white/10 rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-medium text-white/80">Add location</h2>
        <form
          action={createLocation}
          className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
        >
          <input type="hidden" name="gymId" value={gym.id} />
          <input type="hidden" name="gymSlug" value={gymSlug} />

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
    </div>
  );
}
