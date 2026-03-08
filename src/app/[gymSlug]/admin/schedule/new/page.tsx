import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClass } from "../page";
import { InstructorGuestSelector } from "@/components/InstructorGuestSelector";
import { requireGymAccess } from "@/lib/gymAuth";

const INSTRUCTOR_AND_ABOVE = ["INSTRUCTOR", "STAFF", "LOCATION_ADMIN", "GYM_ADMIN", "PLATFORM_ADMIN"] as const;

interface NewSchedulePageProps {
  params: Promise<{
    gymSlug: string;
  }>;
}

export default async function NewSchedulePage({ params }: NewSchedulePageProps) {
  const { gymSlug } = await params;

  const { gym: gymAccess } = await requireGymAccess(gymSlug);
  const gym = await prisma.gym.findUnique({
    where: { id: gymAccess.id },
    include: {
      locations: { orderBy: { name: "asc" } },
      instructors: { orderBy: { name: "asc" } },
    },
  });

  if (!gym) notFound();

  const locationsForSelect = gym.locations.map((loc) => ({
    id: loc.id,
    name: loc.name,
  }));

  // Ensure every user with INSTRUCTOR role or above (with a linked member) has an Instructor record for this gym
  const usersInstructorAndAbove = await prisma.user.findMany({
    where: {
      gymId: gym.id,
      role: { in: [...INSTRUCTOR_AND_ABOVE] },
      memberId: { not: null },
    },
    include: { member: true },
  });
  for (const u of usersInstructorAndAbove) {
    if (!u.memberId || !u.member) continue;
    const existing = await prisma.instructor.findUnique({
      where: { memberId: u.memberId },
    });
    if (existing) {
      if (existing.gymId !== gym.id) continue;
    } else {
      const name =
        [u.member.firstName, u.member.lastName].filter(Boolean).join(" ").trim() ||
        u.name ||
        u.email ||
        "Instructor";
      await prisma.instructor.create({
        data: {
          gymId: gym.id,
          memberId: u.memberId,
          name,
        },
      });
    }
  }

  const allInstructors = await prisma.instructor.findMany({
    where: { gymId: gym.id },
    orderBy: { name: "asc" },
  });
  const instructorsForSelect = allInstructors.map((inst) => ({
    id: inst.id,
    name: inst.name,
  }));

  return (
    <div className="space-y-4">
      <section className="border border-white/10 rounded-xl p-4 space-y-4 bg-black/40">
        <h1 className="text-lg font-semibold">Create class</h1>

        <form
          action={createClass}
          className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
        >
          <input type="hidden" name="gymId" value={gym.id} />
          <input type="hidden" name="gymSlug" value={gymSlug} />

          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-xs font-medium">
              Class name
            </label>
            <input
              id="name"
              name="name"
              className="px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
              placeholder="e.g. Evening Gi Fundamentals"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="locationId" className="text-xs font-medium">
              Location
            </label>
            <select
              id="locationId"
              name="locationId"
              required={locationsForSelect.length > 0}
              className="px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            >
              <option value="">
                {locationsForSelect.length === 0 ? "—" : "Select location"}
              </option>
              {locationsForSelect.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <InstructorGuestSelector
            instructors={instructorsForSelect}
            size="md"
            selectId="instructorId"
          />

          <div className="flex flex-col gap-1">
            <label htmlFor="mainCategory" className="text-xs font-medium">
              Category
            </label>
            <select
              id="mainCategory"
              name="mainCategory"
              required
              className="px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Select
              </option>
              <option value="OPEN_MAT">Open Mat</option>
              <option value="GI">Gi</option>
              <option value="NO_GI">No Gi</option>
              <option value="EVENT">Event</option>
              <option value="SEMINAR">Seminar</option>
              <option value="GRADUATION">Graduation</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="subCategory" className="text-xs font-medium">
              Sub category (optional for Graduation)
            </label>
            <select
              id="subCategory"
              name="subCategory"
              className="px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
              defaultValue=""
            >
              <option value="">—</option>
              <option value="STAND_UP">Stand-up</option>
              <option value="FUNDAMENTALS">Fundamentals</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
              <option value="COMPETITION">Competition</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="capacity" className="text-xs font-medium">
              Capacity
            </label>
            <input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              required
              className="px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="age" className="text-xs font-medium">
              Age (optional)
            </label>
            <select
              id="age"
              name="age"
              className="px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            >
              <option value="">No restriction</option>
              <option value="ALL_AGES">All ages</option>
              <option value="ADULT_17_PLUS">17+</option>
              <option value="AGE_4_6">4-6 years</option>
              <option value="AGE_7_10">7-10 years</option>
              <option value="AGE_11_15">11-15 years</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="date" className="text-xs font-medium">
              Date
            </label>
            <input
              id="date"
              name="date"
              type="date"
              required
              className="px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="time" className="text-xs font-medium">
              Start time
            </label>
            <input
              id="time"
              name="time"
              type="time"
              required
              className="px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="durationMinutes"
              className="text-xs font-medium"
            >
              Duration (minutes)
            </label>
            <input
              id="durationMinutes"
              name="durationMinutes"
              type="number"
              min={15}
              step={15}
              defaultValue={60}
              required
              className="px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-6 border-t border-white/10 pt-2 mt-1">
            <label className="text-xs font-medium flex items-center gap-2">
              <input
                type="checkbox"
                name="isRecurring"
                className="h-3 w-3 rounded border border-white/40 bg-black/40"
              />
              Make this a recurring weekly class
            </label>

            <div className="mt-1 space-y-2 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="space-y-1">
                  {[
                    { label: "Monday", index: 1 },
                    { label: "Tuesday", index: 2 },
                    { label: "Wednesday", index: 3 },
                    { label: "Thursday", index: 4 },
                    { label: "Friday", index: 5 },
                    { label: "Saturday", index: 6 },
                    { label: "Sunday", index: 0 },
                  ].map((dayCfg) => (
                    <div
                      key={dayCfg.index}
                      className="flex items-center justify-between gap-2"
                    >
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          name="repeatDays"
                          value={dayCfg.index}
                          className="h-3 w-3 rounded border border-white/40 bg-black/40"
                        />
                        <span>{dayCfg.label}</span>
                      </label>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="repeatEndDate"
                    className="text-xs font-medium"
                  >
                    Repeat until
                  </label>
                  <input
                    id="repeatEndDate"
                    name="repeatEndDate"
                    type="date"
                    className="px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
                  />
                  <p className="text-[11px] text-white/50">
                    Recurring classes will be scheduled on the selected days
                    each week until this date (inclusive).
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-6 flex justify-end gap-2">
            <Link
              href={`/${gymSlug}/admin/schedule`}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-white/20 text-xs font-medium hover:bg-white/10 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-600 text-xs font-medium hover:bg-orange-500 transition-colors"
            >
              Save class
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

