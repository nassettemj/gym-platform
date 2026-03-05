import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { ScheduleView } from "@/components/ScheduleView";
import type { BulkClassUpdatePayload } from "@/lib/scheduleBulkTypes";

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

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const gymId = String(formData.get("gymId") ?? "");
  const gymSlug = String(formData.get("gymSlug") ?? "");
  const locationId = String(formData.get("locationId") ?? "");
  const instructorIdRaw = String(formData.get("instructorId") ?? "").trim();
  const instructorId = instructorIdRaw || null;
  const name = String(formData.get("name") ?? "").trim();
  const mainCategory = String(formData.get("mainCategory") ?? "") || null;
  const subCategory = String(formData.get("subCategory") ?? "") || null;
  const dateStr = String(formData.get("date") ?? "");
  const timeStr = String(formData.get("time") ?? "");
  const durationMinutes = Number(formData.get("durationMinutes") ?? "60");
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacityRaw ? Number(capacityRaw) : null;
  const minAgeRaw = String(formData.get("minAgeYears") ?? "").trim();
  const maxAgeRaw = String(formData.get("maxAgeYears") ?? "").trim();
  const minAgeYears = minAgeRaw ? Number(minAgeRaw) : null;
  const maxAgeYears = maxAgeRaw ? Number(maxAgeRaw) : null;
  const isRecurring =
    String(formData.get("isRecurring") ?? "").toLowerCase() === "on";
  const repeatDaysRaw = formData.getAll("repeatDays") as string[];
  const repeatEndDateStr = String(formData.get("repeatEndDate") ?? "");
  const viewModeRaw = String(formData.get("viewMode") ?? "week");
  const viewMode =
    viewModeRaw === "day" || viewModeRaw === "week" || viewModeRaw === "month"
      ? viewModeRaw
      : "week";

  if (
    !gymId ||
    !locationId ||
    !dateStr ||
    !timeStr ||
    !durationMinutes ||
    !capacityRaw ||
    !mainCategory
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
    locationId: string;
    name: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    capacity: number | null;
    instructorId: string | null;
    startAt: Date;
    endAt: Date;
    mainCategory: any;
    subCategory: any;
    minAgeYears: number | null;
    maxAgeYears: number | null;
  }[] = [];

  if (minAgeYears != null && maxAgeYears != null && minAgeYears > maxAgeYears) {
    return;
  }

  // Base occurrence from the primary date/time/duration
  occurrences.push({
    locationId,
    name: name || "Class",
    dayOfWeek,
    startTime,
    endTime,
    capacity,
    instructorId,
    startAt,
    endAt,
    mainCategory: mainCategory ? (mainCategory as any) : null,
    subCategory: subCategory ? (subCategory as any) : null,
    minAgeYears,
    maxAgeYears,
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
          locationId,
          name: name || "Class",
          dayOfWeek: repeatDayOfWeek,
          startTime: repeatStartTime,
          endTime: repeatEndTime,
          capacity,
          instructorId,
          startAt: candidateStart,
          endAt: candidateEnd,
          mainCategory: mainCategory ? (mainCategory as any) : null,
          subCategory: subCategory ? (subCategory as any) : null,
          minAgeYears,
          maxAgeYears,
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

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const gymSlug = String(formData.get("gymSlug") ?? "");
  const classId = String(formData.get("classId") ?? "");
  const locationId = String(formData.get("locationId") ?? "");
  const instructorIdRaw = String(formData.get("instructorId") ?? "").trim();
  const instructorId = instructorIdRaw || null;
  const name = String(formData.get("name") ?? "").trim();
  const mainCategory = String(formData.get("mainCategory") ?? "") || null;
  const subCategory = String(formData.get("subCategory") ?? "") || null;
  const dateStr = String(formData.get("date") ?? "");
  const timeStr = String(formData.get("time") ?? "");
  const durationMinutes = Number(formData.get("durationMinutes") ?? "60");
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacityRaw ? Number(capacityRaw) : null;
  const minAgeRaw = String(formData.get("minAgeYears") ?? "").trim();
  const maxAgeRaw = String(formData.get("maxAgeYears") ?? "").trim();
  const minAgeYears = minAgeRaw ? Number(minAgeRaw) : null;
  const maxAgeYears = maxAgeRaw ? Number(maxAgeRaw) : null;
  const viewModeRaw = String(formData.get("viewMode") ?? "week");
  const viewMode =
    viewModeRaw === "day" || viewModeRaw === "week" || viewModeRaw === "month"
      ? viewModeRaw
      : "week";

  if (!classId || !locationId || !dateStr || !timeStr || !durationMinutes) {
    return;
  }

  if (minAgeYears != null && maxAgeYears != null && minAgeYears > maxAgeYears) {
    return;
  }

  const startAt = new Date(`${dateStr}T${timeStr}:00`);
  const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

  const dayOfWeek = startAt.getUTCDay();
  const startTime = timeStr;
  const endTime = new Date(endAt.getTime()).toISOString().slice(11, 16);

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
        startAt,
        endAt,
        mainCategory: mainCategory ? (mainCategory as any) : null,
        subCategory: subCategory ? (subCategory as any) : null,
        minAgeYears: minAgeYears ?? undefined,
        maxAgeYears: maxAgeYears ?? undefined,
      },
    });
  } catch (error: any) {
    throw error;
  }

  redirect(`/${gymSlug}/admin/schedule?view=${viewMode}`);
}

async function deleteClass(formData: FormData) {
  "use server";

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const gymSlug = String(formData.get("gymSlug") ?? "");
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

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const gymSlug = String(formData.get("gymSlug") ?? "");
  const rawPayload = formData.get("bulkPayload");
  if (!rawPayload) {
    redirect(`/${gymSlug}/admin/schedule`);
  }

  const payload = JSON.parse(String(rawPayload)) as BulkClassUpdatePayload;
  if (!payload.classIds || payload.classIds.length === 0) {
    redirect(`/${gymSlug}/admin/schedule`);
  }

  await prisma.$transaction(async (tx) => {
    if (payload.operation === "delete") {
      await tx.class.deleteMany({
        where: {
          id: { in: payload.classIds },
          location: {
            gym: {
              slug: gymSlug,
            },
          },
        },
      });
      return;
    }

    const classes = await tx.class.findMany({
      where: {
        id: { in: payload.classIds },
        location: {
          gym: {
            slug: gymSlug,
          },
        },
      },
      include: {
        location: {
          select: { gymId: true },
        },
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

      if (payload.mainCategory) {
        data.mainCategory =
          payload.mainCategory.kind === "clear"
            ? null
            : payload.mainCategory.value ?? null;
      }

      if (payload.subCategory) {
        data.subCategory =
          payload.subCategory.kind === "clear"
            ? null
            : payload.subCategory.value ?? null;
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

  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const gymSlug = String(formData.get("gymSlug") ?? "");
  const datesJson = String(formData.get("datesJson") ?? "[]");
  const name = String(formData.get("name") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "");
  const instructorIdRaw = String(formData.get("instructorId") ?? "").trim();
  const instructorId = instructorIdRaw || null;
  const timeStr = String(formData.get("time") ?? "").trim();
  const durationMinutes = Number(formData.get("durationMinutes") ?? "60");
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const capacity = capacityRaw ? Number(capacityRaw) : null;
  const mainCategory = String(formData.get("mainCategory") ?? "") || null;
  const subCategory = String(formData.get("subCategory") ?? "") || null;
  const minAgeRaw = String(formData.get("minAgeYears") ?? "").trim();
  const maxAgeRaw = String(formData.get("maxAgeYears") ?? "").trim();
  const minAgeYears = minAgeRaw ? Number(minAgeRaw) : null;
  const maxAgeYears = maxAgeRaw ? Number(maxAgeRaw) : null;

  let dateKeys: string[] = [];
  try {
    dateKeys = JSON.parse(datesJson) as string[];
  } catch {
    dateKeys = [];
  }

  if (
    !locationId ||
    !timeStr ||
    !durationMinutes ||
    !dateKeys.length ||
    !capacityRaw ||
    !mainCategory
  ) {
    redirect(`/${gymSlug}/admin/schedule`);
  }

  if (minAgeYears != null && maxAgeYears != null && minAgeYears > maxAgeYears) {
    redirect(`/${gymSlug}/admin/schedule`);
  }

  const occurrences = dateKeys.map((dateStr) => {
    const startAt = new Date(`${dateStr}T${timeStr}:00`);
    const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
    const dayOfWeek = startAt.getUTCDay();
    const startTime = timeStr;
    const endTime = new Date(endAt.getTime()).toISOString().slice(11, 16);

    return {
      locationId,
      name: name || "Class",
      dayOfWeek,
      startTime,
      endTime,
      capacity,
      instructorId,
      startAt,
      endAt,
      mainCategory: mainCategory ? (mainCategory as any) : null,
      subCategory: subCategory ? (subCategory as any) : null,
      minAgeYears,
      maxAgeYears,
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
  const session = await auth();
  const user = session?.user as any;
  if (!user) redirect("/login");

  const { gymSlug } = await params;

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    include: {
      locations: {
        orderBy: { name: "asc" },
      },
      instructors: {
        orderBy: { name: "asc" },
      },
    },
  });

  if (!gym) {
    notFound();
  }

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect("/login");
  }

  const search = searchParams ? await searchParams : undefined;

  const now = new Date();
  const startWindow = new Date(now);
  startWindow.setDate(startWindow.getDate() - 14);
  const endWindow = new Date(now);
  endWindow.setDate(endWindow.getDate() + 60);

  const classes = await prisma.class.findMany({
    where: {
      location: {
        gymId: gym.id,
      },
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

  const instructorsForSelect = gym.instructors.map((inst) => ({
    id: inst.id,
    name: inst.name,
  }));

  const classItems = classes.map((c) => ({
    id: c.id,
    name: c.name,
    startAt: c.startAt?.toISOString() ?? "",
    endAt: c.endAt?.toISOString() ?? "",
    locationName: c.location.name,
    instructorName: c.instructor?.name ?? "",
    mainCategory: c.mainCategory ?? null,
    subCategory: c.subCategory ?? null,
    minAgeYears: c.minAgeYears ?? null,
    maxAgeYears: c.maxAgeYears ?? null,
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

