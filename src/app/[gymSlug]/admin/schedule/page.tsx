import { prisma } from "@/lib/prisma";
import type { ClassAge } from "@prisma/client";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ScheduleView } from "@/components/ScheduleView";
import {
  ScheduleOnboarding,
  ScheduleTourRestart,
} from "@/components/ScheduleOnboarding";
import type { BulkClassUpdatePayload } from "@/lib/scheduleBulkTypes";
import { getGymAndUser, requireGymAccess } from "@/lib/gymAuth";

const INSTRUCTOR_AND_ABOVE = ["INSTRUCTOR", "STAFF", "LOCATION_ADMIN", "GYM_ADMIN", "PLATFORM_ADMIN"] as const;

const VALID_CLASS_AGES = ["ALL_AGES", "ADULT_17_PLUS", "AGE_4_6", "AGE_7_10", "AGE_11_15"] as const;
const GUESTS_INSTRUCTOR_VALUE = "__guests__";

function parseAge(value: string): ClassAge | null {
  if (!value || !VALID_CLASS_AGES.includes(value as any)) return null;
  return value as ClassAge;
}

interface SchedulePageProps {
  params: Promise<{
    gymSlug: string;
  }>;
  searchParams?: Promise<{
    view?: string;
  }>;
}

export async function createClass(formData: FormData) {
  "use server";

  const gymSlug = String(formData.get("gymSlug") ?? "");
  const gymId = String(formData.get("gymId") ?? "");
  const locationIdRaw = String(formData.get("locationId") ?? "").trim();
  const locationId = locationIdRaw || null;
  const instructorIdRaw = String(formData.get("instructorId") ?? "").trim();
  const guestNamesRaw = formData.getAll("guestNames") as string[];
  const guestNames = guestNamesRaw.map((s) => s.trim()).filter(Boolean);
  const isGuests = instructorIdRaw === GUESTS_INSTRUCTOR_VALUE;
  const instructorId = isGuests ? null : instructorIdRaw || null;
  if (isGuests && guestNames.length === 0) return;
  const topic = isGuests
    ? String(formData.get("topic") ?? "").trim() || null
    : null;
  const name = String(formData.get("name") ?? "").trim();
  const mainCategory = String(formData.get("mainCategory") ?? "") || null;
  const subCategory = String(formData.get("subCategory") ?? "") || null;
  const dateStr = String(formData.get("date") ?? "");
  const timeStr = String(formData.get("time") ?? "");
  const durationMinutes = Number(formData.get("durationMinutes") ?? "60");
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacityRaw ? Number(capacityRaw) : null;
  const age = parseAge(String(formData.get("age") ?? "").trim());
  const isRecurring =
    String(formData.get("isRecurring") ?? "").toLowerCase() === "on";
  const repeatDaysRaw = formData.getAll("repeatDays") as string[];
  const repeatEndDateStr = String(formData.get("repeatEndDate") ?? "");
  const viewModeRaw = String(formData.get("viewMode") ?? "week");
  const viewMode =
    viewModeRaw === "day" || viewModeRaw === "week" || viewModeRaw === "month"
      ? viewModeRaw
      : "week";

  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) redirect(gymSlug ? `/${gymSlug}/login` : "/login");
  if (ctx.gym.id !== gymId) return;

  const gym = await prisma.gym.findUnique({
    where: { id: gymId },
    include: { locations: true },
  });
  if (!gym) return;
  const hasLocations = gym.locations.length > 0;
  if (hasLocations && !locationId) return;

  const isGraduation = mainCategory === "GRADUATION";
  if (
    !gymId ||
    !dateStr ||
    !timeStr ||
    !durationMinutes ||
    !capacityRaw ||
    !mainCategory ||
    (!isGraduation && !subCategory)
  ) {
    return;
  }

  const startAt = new Date(`${dateStr}T${timeStr}:00`);
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

  const dayOfWeek = startAt.getUTCDay();
  const startTime = timeStr;
  const endTime = new Date(endAt.getTime())
    .toISOString()
    .slice(11, 16); // HH:MM

  const occurrences: {
    gymId: string;
    locationId: string | null;
    name: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    capacity: number | null;
    instructorId: string | null;
    guestNames: string[];
    topic: string | null;
    startAt: Date;
    endAt: Date;
    mainCategory: any;
    subCategory: any;
    age: ClassAge | null;
  }[] = [];

  const resolvedSubCategory = isGraduation ? (subCategory || null) : subCategory;

  // Base occurrence from the primary date/time/duration
  occurrences.push({
    gymId,
    locationId,
    name: name || "Class",
    dayOfWeek,
    startTime,
    endTime,
    capacity,
    instructorId,
    guestNames: isGuests ? guestNames : [],
    topic,
    startAt,
    endAt,
    mainCategory: mainCategory as any,
    subCategory: resolvedSubCategory as any,
    age,
  });

  if (
    isRecurring &&
    repeatDaysRaw.length > 0 &&
    repeatEndDateStr &&
    !Number.isNaN(durationMinutes)
  ) {
    const repeatEndDate = new Date(`${repeatEndDateStr}T23:59:59.999Z`);
    const baseDate = new Date(
      startAt.getFullYear(),
      startAt.getMonth(),
      startAt.getDate(),
      0,
      0,
      0,
      0,
    );

    let cursor = new Date(baseDate);
    while (cursor <= repeatEndDate) {
      for (const dayRaw of repeatDaysRaw) {
        const weekdayIndex = Number(dayRaw);
        if (Number.isNaN(weekdayIndex) || weekdayIndex < 0 || weekdayIndex > 6)
          continue;

        const candidate = new Date(cursor);
        const currentWeekday = candidate.getDay();
        const diffDays = weekdayIndex - currentWeekday;
        candidate.setDate(candidate.getDate() + diffDays);

        if (candidate < baseDate || candidate > repeatEndDate) continue;

        const candidateStart = new Date(
          candidate.getFullYear(),
          candidate.getMonth(),
          candidate.getDate(),
          startAt.getHours(),
          startAt.getMinutes(),
          0,
          0,
        );
        const candidateEnd = new Date(
          candidateStart.getTime() + durationMinutes * 60 * 1000,
        );

        // Avoid duplicating the base occurrence
        if (candidateStart.getTime() === startAt.getTime()) {
          continue;
        }

        const repeatDayOfWeek = candidateStart.getUTCDay();
        const repeatStartTime = startTime;
        const repeatEndTime = new Date(
          candidateEnd.getTime(),
        )
          .toISOString()
          .slice(11, 16);

        occurrences.push({
          gymId,
          locationId,
          name: name || "Class",
          dayOfWeek: repeatDayOfWeek,
          startTime: repeatStartTime,
          endTime: repeatEndTime,
          capacity,
          instructorId,
          guestNames: isGuests ? guestNames : [],
          topic,
          startAt: candidateStart,
          endAt: candidateEnd,
          mainCategory: mainCategory as any,
          subCategory: resolvedSubCategory as any,
          age,
        });
      }

      // Move cursor one week forward
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  if (occurrences.length === 1) {
    await prisma.class.create({
      data: occurrences[0],
    });
  } else if (occurrences.length > 1) {
    await prisma.$transaction(
      occurrences.map((occ) =>
        prisma.class.create({
          data: occ,
        }),
      ),
    );
  }
  redirect(`/${gymSlug}/admin/schedule?view=${viewMode}`);
}

async function updateClass(formData: FormData) {
  "use server";

  const gymSlug = String(formData.get("gymSlug") ?? "");
  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const classId = String(formData.get("classId") ?? "");
  const locationIdRaw = String(formData.get("locationId") ?? "").trim();
  const locationId = locationIdRaw || null;
  const instructorIdRaw = String(formData.get("instructorId") ?? "").trim();
  const guestNamesRaw = formData.getAll("guestNames") as string[];
  const guestNames = guestNamesRaw.map((s) => s.trim()).filter(Boolean);
  const isGuests = instructorIdRaw === GUESTS_INSTRUCTOR_VALUE;
  const instructorId = isGuests ? null : instructorIdRaw || null;
  if (isGuests && guestNames.length === 0) return;
  const topic = isGuests
    ? String(formData.get("topic") ?? "").trim() || null
    : null;
  const name = String(formData.get("name") ?? "").trim();
  const mainCategory = String(formData.get("mainCategory") ?? "") || null;
  const subCategory = String(formData.get("subCategory") ?? "") || null;
  const dateStr = String(formData.get("date") ?? "");
  const timeStr = String(formData.get("time") ?? "");
  const durationMinutes = Number(formData.get("durationMinutes") ?? "60");
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacityRaw ? Number(capacityRaw) : null;
  const age = parseAge(String(formData.get("age") ?? "").trim());
  const viewModeRaw = String(formData.get("viewMode") ?? "week");
  const viewMode =
    viewModeRaw === "day" || viewModeRaw === "week" || viewModeRaw === "month"
      ? viewModeRaw
      : "week";

  if (!classId || !dateStr || !timeStr || !durationMinutes) {
    return;
  }

  const existing = await prisma.class.findUnique({
    where: { id: classId },
    include: { gym: { include: { locations: true } } },
  });
  if (!existing) return;
  const hasLocations = existing.gym.locations.length > 0;
  if (hasLocations && !locationId) return;

  const startAt = new Date(`${dateStr}T${timeStr}:00`);
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

  const dayOfWeek = startAt.getUTCDay();
  const startTime = timeStr;
  const endTime = new Date(endAt.getTime()).toISOString().slice(11, 16);

  const isGraduationUpdate = mainCategory === "GRADUATION";
  if (!mainCategory || (!isGraduationUpdate && !subCategory)) {
    redirect(`/${gymSlug}/admin/schedule?view=${viewMode}`);
  }

  const resolvedSubCategoryUpdate = isGraduationUpdate ? (subCategory || null) : subCategory;

  try {
    await prisma.class.update({
      where: { id: classId },
      data: {
        locationId,
        name: name || "Class",
        dayOfWeek,
        startTime,
        endTime,
        capacity: capacity ?? undefined,
        instructorId: instructorId ?? undefined,
        guestNames: isGuests ? guestNames : [],
        topic: topic ?? undefined,
        startAt,
        endAt,
        mainCategory: mainCategory as any,
        subCategory: resolvedSubCategoryUpdate as any,
        age: age ?? undefined,
      },
    });
  } catch (error: any) {
    throw error;
  }

  redirect(`/${gymSlug}/admin/schedule?view=${viewMode}`);
}

async function deleteClass(formData: FormData) {
  "use server";

  const gymSlug = String(formData.get("gymSlug") ?? "");
  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const classId = String(formData.get("classId") ?? "");
  const viewModeRaw = String(formData.get("viewMode") ?? "week");
  const viewMode =
    viewModeRaw === "day" || viewModeRaw === "week" || viewModeRaw === "month"
      ? viewModeRaw
      : "week";

  if (!classId) return;

  await prisma.class.delete({
    where: { id: classId },
  });

  redirect(`/${gymSlug}/admin/schedule?view=${viewMode}`);
}

export async function bulkUpdateClasses(formData: FormData) {
  "use server";

  const gymSlug = String(formData.get("gymSlug") ?? "");
  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const rawPayload = formData.get("bulkPayload");
  if (!rawPayload) redirect(`/${gymSlug}/admin/schedule`);

  const payload = JSON.parse(String(rawPayload)) as BulkClassUpdatePayload;
  if (!payload.classIds || payload.classIds.length === 0) redirect(`/${gymSlug}/admin/schedule`);
  const gym = { id: ctx.gym.id };

  await prisma.$transaction(async (tx) => {
    if (payload.operation === "delete") {
      await tx.class.deleteMany({
        where: {
          id: { in: payload.classIds },
          gymId: gym.id,
        },
      });
      return;
    }

    const classes = await tx.class.findMany({
      where: {
        id: { in: payload.classIds },
        gymId: gym.id,
      },
    });

    for (const c of classes) {
      const data: any = {};

      if (payload.instructor) {
        if (payload.instructor.kind === "clear") {
          data.instructorId = null;
        } else if (payload.instructor.kind === "set") {
          data.instructorId = payload.instructor.instructorId ?? null;
        }
      }

      if (payload.mainCategory && payload.mainCategory.kind === "set" && payload.mainCategory.value) {
        data.mainCategory = payload.mainCategory.value;
      }

      if (payload.subCategory && payload.subCategory.kind === "set" && payload.subCategory.value) {
        data.subCategory = payload.subCategory.value;
      }

      if (Object.keys(data).length > 0) {
        await tx.class.update({
          where: { id: c.id },
          data,
        });
      }
    }
  });

  redirect(`/${gymSlug}/admin/schedule`);
}

export async function bulkCreateOnDates(formData: FormData) {
  "use server";

  const gymSlug = String(formData.get("gymSlug") ?? "");
  const ctx = await getGymAndUser(gymSlug);
  if (!ctx) redirect(gymSlug ? `/${gymSlug}/login` : "/login");

  const datesJson = String(formData.get("datesJson") ?? "[]");
  const name = String(formData.get("name") ?? "").trim();
  const gymId = String(formData.get("gymId") ?? "");
  if (gymId !== ctx.gym.id) redirect(`/${gymSlug}/admin/schedule`);

  const locationIdRaw = String(formData.get("locationId") ?? "").trim();
  const locationId = locationIdRaw || null;
  const instructorIdRaw = String(formData.get("instructorId") ?? "").trim();
  const guestNamesRaw = formData.getAll("guestNames") as string[];
  const guestNames = guestNamesRaw.map((s) => s.trim()).filter(Boolean);
  const isGuests = instructorIdRaw === GUESTS_INSTRUCTOR_VALUE;
  const instructorId = isGuests ? null : instructorIdRaw || null;
  if (isGuests && guestNames.length === 0) redirect(`/${gymSlug}/admin/schedule`);
  const topic = isGuests
    ? String(formData.get("topic") ?? "").trim() || null
    : null;
  const timeStr = String(formData.get("time") ?? "").trim();
  const durationMinutes = Number(formData.get("durationMinutes") ?? "60");
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacityRaw ? Number(capacityRaw) : null;
  const mainCategory = String(formData.get("mainCategory") ?? "") || null;
  const subCategory = String(formData.get("subCategory") ?? "") || null;
  const age = parseAge(String(formData.get("age") ?? "").trim());

  let dateKeys: string[] = [];
  try {
    dateKeys = JSON.parse(datesJson) as string[];
  } catch {
    dateKeys = [];
  }

  const gymWithLocations = await prisma.gym.findUnique({
    where: { id: ctx.gym.id },
    include: { locations: true },
  });
  if (!gymWithLocations) redirect(`/${gymSlug}/admin/schedule`);
  const hasLocations = gymWithLocations.locations.length > 0;
  if (hasLocations && !locationId) redirect(`/${gymSlug}/admin/schedule`);

  const isGraduationBulk = mainCategory === "GRADUATION";
  if (
    !gymId ||
    !timeStr ||
    !durationMinutes ||
    !dateKeys.length ||
    !capacityRaw ||
    !mainCategory ||
    (!isGraduationBulk && !subCategory)
  ) {
    redirect(`/${gymSlug}/admin/schedule`);
  }

  const resolvedSubCategoryBulk = isGraduationBulk ? (subCategory || null) : subCategory;

  const occurrences = dateKeys.map((dateStr) => {
    const startAt = new Date(`${dateStr}T${timeStr}:00`);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
    const dayOfWeek = startAt.getUTCDay();
    const startTime = timeStr;
    const endTime = new Date(endAt.getTime()).toISOString().slice(11, 16);

    return {
      gymId,
      locationId,
      name: name || "Class",
      dayOfWeek,
      startTime,
      endTime,
      capacity,
      instructorId,
      guestNames: isGuests ? guestNames : [],
      topic,
      startAt,
      endAt,
      mainCategory: mainCategory as any,
      subCategory: resolvedSubCategoryBulk as any,
      age,
    };
  });

  await prisma.$transaction(async (tx) => {
    for (const occ of occurrences) {
      await tx.class.create({ data: occ });
    }
  });

  redirect(`/${gymSlug}/admin/schedule`);
}

export default async function SchedulePage({
  params,
  searchParams,
}: SchedulePageProps) {
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

  const search = searchParams ? await searchParams : undefined;

  const now = new Date();
  const startWindow = new Date(now);
  startWindow.setDate(startWindow.getDate() - 14);
  const endWindow = new Date(now);
  endWindow.setDate(endWindow.getDate() + 60);

  const classes = await prisma.class.findMany({
    where: {
      gymId: gym.id,
      OR: [
        { startAt: { gte: startWindow, lte: endWindow } },
        { startAt: null },
      ],
    },
    include: {
      instructor: true,
      location: true,
    },
    orderBy: {
      startAt: "asc",
    },
  });

  const locationsForSelect = gym.locations.map((loc) => ({
    id: loc.id,
    name: loc.name,
  }));

  // Ensure every user with INSTRUCTOR role or above (with a linked member) has an Instructor record for this gym so they can be set as class instructor
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
      if (existing.gymId !== gym.id) continue; // instructor at another gym
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

  const classItems = classes.map((c) => ({
    id: c.id,
    name: c.name,
    startAt: c.startAt?.toISOString() ?? "",
    endAt: c.endAt?.toISOString() ?? "",
    locationName: c.location?.name ?? "",
    instructorName:
      c.instructor?.name ??
      (c.guestNames?.length
        ? `Guests: ${c.guestNames.join(", ")}`
        : ""),
    guestNames: c.guestNames ?? [],
    topic: c.topic ?? null,
    mainCategory: c.mainCategory ?? null,
    subCategory: c.subCategory,
    age: c.age ?? null,
  }));

  const initialViewRaw = search?.view ?? "week";
  const initialViewMode =
    initialViewRaw === "day" ||
    initialViewRaw === "week" ||
    initialViewRaw === "month"
      ? initialViewRaw
      : "week";

  return (
    <div className="space-y-4">
      <ScheduleOnboarding gymSlug={gymSlug} />
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-semibold">Planning</h1>
        <div className="flex items-center gap-4">
          <Link
            href={`/${gymSlug}/admin/schedule/new`}
            className="text-sm text-orange-400 hover:text-orange-300 underline"
            data-tour="schedule-new-class"
          >
            New class
          </Link>
          <ScheduleTourRestart />
        </div>
      </div>
      <section className="border border-white/10 rounded-xl p-4 space-y-4">
        <ScheduleView
          gymId={gym.id}
          gymSlug={gymSlug}
          locations={locationsForSelect}
          instructors={instructorsForSelect}
          classes={classItems}
          action={createClass}
          updateAction={updateClass}
          deleteAction={deleteClass}
          bulkUpdateAction={bulkUpdateClasses}
          bulkCreateOnDatesAction={bulkCreateOnDates}
          initialViewMode={initialViewMode}
        />
      </section>
    </div>
  );
}

