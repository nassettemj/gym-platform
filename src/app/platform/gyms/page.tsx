import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

async function createGym(formData: FormData) {
  "use server";

  const session = await auth();
  const user = session?.user as any;
  if (!user || user.role !== "PLATFORM_ADMIN") {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  let slug = String(formData.get("slug") ?? "").trim().toLowerCase();

  if (!name) return;

  if (!slug) {
    slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  await prisma.gym.create({
    data: {
      name,
      slug,
      status: "ACTIVE",
    },
  });

  redirect("/platform/gyms");
}

export default async function GymsPage() {
  const session = await auth();
  const user = session?.user as any;

  if (!user || user.role !== "PLATFORM_ADMIN") {
    redirect("/login");
  }

  const gyms = await prisma.gym.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Platform gyms</h1>
          <p className="text-sm text-white/70 mt-1">
            Manage tenant gyms for this platform.
          </p>
        </div>
      </header>

      <section className="border border-white/10 rounded-xl p-4">
        <h2 className="font-medium mb-3">Create gym</h2>
        <form action={createGym} className="flex flex-col gap-3 max-w-md">
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              name="name"
              required
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="slug" className="text-sm font-medium">
              Slug (optional)
            </label>
            <input
              id="slug"
              name="slug"
              placeholder="e.g. dragon-dojo"
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            />
            <p className="text-xs text-white/50">
              Used for URLs, for example:{" "}
              <code>{"https://"}slug.yourplatform.com</code>
            </p>
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-600 text-sm font-medium hover:bg-orange-500 transition-colors"
          >
            Save gym
          </button>
        </form>
      </section>

      <section className="border border-white/10 rounded-xl p-4">
        <h2 className="font-medium mb-3">Existing gyms</h2>
        {gyms.length === 0 ? (
          <p className="text-sm text-white/60">No gyms created yet.</p>
        ) : (
          <ul className="space-y-2">
            {gyms.map((gym) => (
              <li
                key={gym.id}
                className="flex items-center justify-between gap-3 border border-white/10 rounded-md px-3 py-2"
              >
                <div>
                  <p className="font-medium">{gym.name}</p>
                  <p className="text-xs text-white/60">Slug: {gym.slug}</p>
                </div>
                <Link
                  href={`/${gym.slug}/admin`}
                  className="text-xs text-orange-400 hover:text-orange-300 font-medium"
                >
                  Open admin
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
