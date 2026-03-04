"use client";

import { useMemo, useState } from "react";

type LocationOption = {
  id: string;
  name: string;
};

type InstructorOption = {
  id: string;
  name: string;
};

type ClassItem = {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  locationName: string;
  instructorName: string;
  mainCategory: string | null;
  subCategory: string | null;
  minAgeYears: number | null;
  maxAgeYears: number | null;
};

type Props = {
  gymId: string;
  gymSlug: string;
  locations: LocationOption[];
  instructors: InstructorOption[];
  classes: ClassItem[];
  action: (formData: FormData) => void;
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  initialViewMode?: ViewMode;
};

type ViewMode = "day" | "week" | "month";

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const weekdayConfigs = [
  { label: "Mon", full: "Monday", index: 1 },
  { label: "Tue", full: "Tuesday", index: 2 },
  { label: "Wed", full: "Wednesday", index: 3 },
  { label: "Thu", full: "Thursday", index: 4 },
  { label: "Fri", full: "Friday", index: 5 },
  { label: "Sat", full: "Saturday", index: 6 },
  { label: "Sun", full: "Sunday", index: 0 },
];

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function toLocalDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function ScheduleView({
  gymId,
  gymSlug,
  locations,
  instructors,
  classes,
  action,
  updateAction,
  deleteAction,
  initialViewMode,
}: Props) {
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(
    initialViewMode ?? "week",
  );
  const [selectedInstructor, setSelectedInstructor] = useState<string>("all");
  const [selectedMainCategory, setSelectedMainCategory] =
    useState<string>("all");
  const [selectedSubCategory, setSelectedSubCategory] =
    useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatDayEnabled, setRepeatDayEnabled] = useState<Record<number, boolean>>(
    {},
  );
  const [baseDateValue, setBaseDateValue] = useState("");

  const filteredClasses = useMemo(() => {
    const startOfDay = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
      0,
      0,
      0,
      0,
    );
    const endOfDay = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
      23,
      59,
      59,
      999,
    );

    const startOfWeek = new Date(startOfDay);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
    );

    return classes.filter((c) => {
      if (!c.startAt) return false;
      const start = new Date(c.startAt);

      if (viewMode === "day") {
        if (start < startOfDay || start > endOfDay) return false;
      } else if (viewMode === "week") {
        if (start < startOfWeek || start > endOfWeek) return false;
      } else {
        if (start < startOfMonth || start > endOfMonth) return false;
      }

      if (
        selectedInstructor !== "all" &&
        c.instructorName &&
        c.instructorName !==
          instructors.find((i) => i.id === selectedInstructor)?.name
      ) {
        return false;
      }

      if (
        selectedMainCategory !== "all" &&
        c.mainCategory !== selectedMainCategory
      ) {
        return false;
      }

      if (
        selectedSubCategory !== "all" &&
        c.subCategory !== selectedSubCategory
      ) {
        return false;
      }

      return true;
    });
  }, [
    classes,
    currentDate,
    viewMode,
    selectedInstructor,
    selectedMainCategory,
    selectedSubCategory,
    instructors,
  ]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, ClassItem[]> = {};
    for (const c of filteredClasses) {
      if (!c.startAt) continue;
      const d = new Date(c.startAt);
      const key = d.toISOString().slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    }
    return Object.entries(groups).sort(([a], [b]) => (a < b ? -1 : 1));
  }, [filteredClasses]);

  const weekGrid = useMemo(() => {
    if (viewMode !== "week") return [];

    const startOfWeek = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
      0,
      0,
      0,
      0,
    );
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const days: { date: Date; items: ClassItem[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const items = groupedByDate.find(([k]) => k === key)?.[1] ?? [];
      const sorted = [...items].sort((a, b) => {
        const sa = a.startAt ? new Date(a.startAt).getTime() : 0;
        const sb = b.startAt ? new Date(b.startAt).getTime() : 0;
        return sa - sb;
      });
      days.push({ date: d, items: sorted });
    }
    return days;
  }, [groupedByDate, currentDate, viewMode]);

  const monthGrid = useMemo(() => {
    if (viewMode !== "month") return [];

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstOfMonth = new Date(year, month, 1);
    const firstDay = firstOfMonth.getDay();
    const startOffset = firstDay === 0 ? -6 : 1 - firstDay;
    const startOfCalendar = new Date(year, month, startOffset);

    const cells: { date: Date; items: ClassItem[]; inCurrentMonth: boolean }[] =
      [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(startOfCalendar);
      d.setDate(startOfCalendar.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const items = groupedByDate.find(([k]) => k === key)?.[1] ?? [];
      const sorted = [...items].sort((a, b) => {
        const sa = a.startAt ? new Date(a.startAt).getTime() : 0;
        const sb = b.startAt ? new Date(b.startAt).getTime() : 0;
        return sa - sb;
      });

      cells.push({
        date: d,
        items: sorted,
        inCurrentMonth: d.getMonth() === month,
      });
    }

    return cells;
  }, [groupedByDate, currentDate, viewMode]);

  const weekLabel = useMemo(() => {
    const startOfWeek = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate(),
      0,
      0,
      0,
      0,
    );
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const monthLabel = startOfWeek.toLocaleString("en-US", {
      month: "long",
    });
    return `${startOfWeek.getDate()}–${endOfWeek.getDate()} ${monthLabel} ${startOfWeek.getFullYear()}`;
  }, [currentDate]);

  const monthLabel = useMemo(() => {
    return `${currentDate.toLocaleString("en-US", {
      month: "long",
    })} ${currentDate.getFullYear()}`;
  }, [currentDate]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("day")}
            className={`px-2 py-1 rounded-md border text-xs ${
              viewMode === "day"
                ? "border-orange-500 bg-orange-600/20 text-orange-200"
                : "border-white/15 text-white/80 hover:bg-white/5"
            }`}
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={`px-2 py-1 rounded-md border text-xs ${
              viewMode === "week"
                ? "border-orange-500 bg-orange-600/20 text-orange-200"
                : "border-white/15 text-white/80 hover:bg-white/5"
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setViewMode("month")}
            className={`px-2 py-1 rounded-md border text-xs ${
              viewMode === "month"
                ? "border-orange-500 bg-orange-600/20 text-orange-200"
                : "border-white/15 text-white/80 hover:bg-white/5"
            }`}
          >
            Month
          </button>
          {viewMode === "week" && (
            <span className="ml-2 text-[11px] text-white/70">{weekLabel}</span>
          )}
          {viewMode === "month" && (
            <span className="ml-2 text-[11px] text-white/70">
              {monthLabel}
            </span>
          )}
          <button
            type="button"
            className="ml-2 px-2 py-1 rounded-md border border-white/20 text-[11px]"
            onClick={() =>
              setCurrentDate((d) =>
                new Date(
                  d.getFullYear(),
                  d.getMonth(),
                  d.getDate() - (viewMode === "month" ? 28 : 7),
                ),
              )
            }
          >
            {"<"}
          </button>
          <button
            type="button"
            className="px-2 py-1 rounded-md border border-white/20 text-[11px]"
            onClick={() =>
              setCurrentDate((d) =>
                new Date(
                  d.getFullYear(),
                  d.getMonth(),
                  d.getDate() + (viewMode === "month" ? 28 : 7),
                ),
              )
            }
          >
            {">"}
          </button>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <select
            value={selectedInstructor}
            onChange={(e) => setSelectedInstructor(e.target.value)}
            className="px-2 py-1 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="all">All instructors</option>
            {instructors.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name}
              </option>
            ))}
          </select>

          <select
            value={selectedMainCategory}
            onChange={(e) => setSelectedMainCategory(e.target.value)}
            className="px-2 py-1 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="all">All categories</option>
            <option value="OPEN_MAT">Open Mat</option>
            <option value="GI">Gi</option>
            <option value="NO_GI">No Gi</option>
          </select>

          <select
            value={selectedSubCategory}
            onChange={(e) => setSelectedSubCategory(e.target.value)}
            className="px-2 py-1 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="all">All subcategories</option>
            <option value="STAND_UP">Stand-up</option>
            <option value="FUNDAMENTALS">Fundamentals</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
            <option value="COMPETITION">Competition</option>
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="inline-flex items-center justify-center px-3 py-1.5 rounded-md bg-orange-600 text-xs font-medium hover:bg-orange-500 transition-colors"
        >
          {showForm ? "Close" : "Create class"}
        </button>
      </div>

      {showForm && (
        <form
          action={action}
          className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end border border-white/10 rounded-lg p-3 bg-black/40"
        >
          <input type="hidden" name="gymId" value={gymId} />
          <input type="hidden" name="gymSlug" value={gymSlug} />
          <input type="hidden" name="viewMode" value={viewMode} />

          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-xs font-medium">
              Class name
            </label>
            <input
              id="name"
              name="name"
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
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
              required
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            >
              <option value="" disabled>
                Select location
              </option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="instructorId" className="text-xs font-medium">
              Instructor
            </label>
            <select
              id="instructorId"
              name="instructorId"
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
              defaultValue=""
            >
              <option value="">Unassigned</option>
              {instructors.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="mainCategory" className="text-xs font-medium">
              Category
            </label>
            <select
              id="mainCategory"
              name="mainCategory"
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Select
              </option>
              <option value="OPEN_MAT">Open Mat</option>
              <option value="GI">Gi</option>
              <option value="NO_GI">No Gi</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="subCategory" className="text-xs font-medium">
              Sub category
            </label>
            <select
              id="subCategory"
              name="subCategory"
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Select
              </option>
              <option value="STAND_UP">Stand-up</option>
              <option value="FUNDAMENTALS">Fundamentals</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
              <option value="COMPETITION">Competition</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="capacity" className="text-xs font-medium">
              Capacity (optional)
            </label>
            <input
              id="capacity"
              name="capacity"
              type="number"
              min={1}
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="minAgeYears" className="text-xs font-medium">
              Min age (optional)
            </label>
            <input
              id="minAgeYears"
              name="minAgeYears"
              type="number"
              min={0}
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="maxAgeYears" className="text-xs font-medium">
              Max age (optional)
            </label>
            <input
              id="maxAgeYears"
              name="maxAgeYears"
              type="number"
              min={0}
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            />
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
              value={baseDateValue}
              onChange={(e) => {
                setBaseDateValue(e.target.value);
                if (!e.target.value) return;
                const d = new Date(e.target.value);
                const dayIndex = d.getDay();
                setRepeatDayEnabled((prev) => {
                  // If some day is already enabled, don't override
                  if (Object.values(prev).some(Boolean)) {
                    return prev;
                  }
                  return { ...prev, [dayIndex]: true };
                });
              }}
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
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
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
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
              className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1 md:col-span-6 border-t border-white/10 pt-2 mt-1">
            <label className="text-xs font-medium flex items-center gap-2">
              <input
                type="checkbox"
                name="isRecurring"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-3 w-3 rounded border border-white/40 bg-black/40"
              />
              Make this a recurring weekly class
            </label>

            {isRecurring && (
              <div className="mt-1 space-y-2 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    {weekdayConfigs.map((dayCfg) => {
                      const enabled = !!repeatDayEnabled[dayCfg.index];
                      return (
                        <div
                          key={dayCfg.index}
                          className="flex items-center justify-between gap-2"
                        >
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              name="repeatDays"
                              value={dayCfg.index}
                              checked={enabled}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setRepeatDayEnabled((prev) => ({
                                  ...prev,
                                  [dayCfg.index]: checked,
                                }));
                              }}
                              className="h-3 w-3 rounded border border-white/40 bg-black/40"
                            />
                            <span>{dayCfg.full}</span>
                          </label>
                          {/* Per-day time/duration inputs were intentionally removed.
                              All recurring classes reuse the base start time and duration. */}
                        </div>
                      );
                    })}
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
                      required={isRecurring}
                      className="px-3 py-2 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
                    />
                    <p className="text-[11px] text-white/50">
                      Recurring classes will be scheduled on the selected days
                      each week until this date (inclusive).
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-6 flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-600 text-xs font-medium hover:bg-orange-500 transition-colors"
            >
              Save class
            </button>
          </div>
        </form>
      )}

      {viewMode === "day" && (
        <div className="space-y-2">
          {groupedByDate.length === 0 ? (
            <p className="text-xs text-white/60">
              No classes scheduled for this day.
            </p>
          ) : (
            groupedByDate.map(([date, items]) => {
              const d = new Date(date);
              const label = formatDateLabel(d);

              const sorted = [...items].sort((a, b) => {
                const sa = a.startAt ? new Date(a.startAt).getTime() : 0;
                const sb = b.startAt ? new Date(b.startAt).getTime() : 0;
                return sa - sb;
              });

              return (
                <div
                  key={date}
                  className="border border-white/10 rounded-lg overflow-hidden"
                >
                  <div className="px-3 py-2 bg-white/5 text-xs font-semibold">
                    {label}
                  </div>
                  <ul className="divide-y divide-white/10 text-xs">
                    {sorted.map((c) => {
                      const start = c.startAt
                        ? new Date(c.startAt).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "";
                      const end = c.endAt
                        ? new Date(c.endAt).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "";

                      return (
                        <li
                          key={c.id}
                          className="px-3 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-1"
                          onClick={() => setSelectedClass(c)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedClass(c);
                            }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-medium">
                              {start}–{end}
                            </span>
                            <span>{c.name}</span>
                            {c.mainCategory && (
                              <span className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] uppercase tracking-wide">
                                {c.mainCategory.replace("_", " ")}
                              </span>
                            )}
                            {c.subCategory && (
                              <span className="px-1.5 py-0.5 rounded-full bg-white/5 text-[10px] uppercase tracking-wide">
                                {c.subCategory.replace("_", " ")}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/70">
                            <span>{c.locationName}</span>
                            {c.instructorName && (
                              <span>• {c.instructorName}</span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </div>
      )}

      {viewMode === "week" && (
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-white/5 text-[11px] font-semibold">
            {weekGrid.map(({ date }) => {
              const label = formatDateLabel(date);
              return (
                <div key={date.toISOString()} className="px-2 py-1.5">
                  {label}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-7 gap-px bg-white/10 text-xs">
            {weekGrid.map(({ date, items }) => (
              <div
                key={date.toISOString()}
                className="min-h-[120px] bg-black/40 px-1.5 py-1.5 space-y-1"
              >
                {items.length === 0 ? (
                  <p className="text-[10px] text-white/40">No classes</p>
                ) : (
                  items.map((c) => {
                    const start = c.startAt
                      ? new Date(c.startAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "";
                    const end = c.endAt
                      ? new Date(c.endAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "";

                    return (
                      <div
                        key={c.id}
                        className="rounded-md border border-white/15 bg-black/40 px-1.5 py-1 space-y-0.5"
                        onClick={() => setSelectedClass(c)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedClass(c);
                          }
                        }}
                      >
                        <div className="text-[11px] font-medium">
                          {start}–{end}
                        </div>
                        <div className="text-[11px]">{c.name}</div>
                        <div className="flex flex-wrap items-center gap-1 text-[10px] text-white/70">
                          <span>{c.locationName}</span>
                          {c.instructorName && (
                            <span>• {c.instructorName}</span>
                          )}
                          {c.mainCategory && (
                            <span className="px-1 py-0.5 rounded-full bg-white/10 text-[9px] uppercase tracking-wide">
                              {c.mainCategory.replace("_", " ")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === "month" && (
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-white/5 text-[11px] font-semibold">
            {weekdayLabels.map((label) => (
              <div key={label} className="px-2 py-1.5">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-white/10 text-xs">
            {monthGrid.map(({ date, items, inCurrentMonth }) => {
              const dayNumber = date.getDate();

              return (
                <div
                  key={date.toISOString()}
                  className={`min-h-[110px] bg-black/40 px-1.5 py-1.5 space-y-1 ${
                    inCurrentMonth ? "" : "opacity-40"
                  }`}
                >
                  <div className="text-[11px] font-semibold">
                    {dayNumber}
                  </div>
                  {items.slice(0, 3).map((c) => {
                    const start = c.startAt
                      ? new Date(c.startAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "";

                    return (
                      <div
                        key={c.id}
                        className="rounded-md border border-white/15 bg-black/40 px-1.5 py-0.5 space-y-0.5"
                        onClick={() => setSelectedClass(c)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedClass(c);
                          }
                        }}
                      >
                        <div className="text-[10px] font-medium">
                          {start} {c.name}
                        </div>
                        {c.mainCategory && (
                          <div className="text-[9px] uppercase tracking-wide text-white/70">
                            {c.mainCategory.replace("_", " ")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {items.length > 3 && (
                    <div className="text-[10px] text-white/70">
                      +{items.length - 3} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedClass && (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-md border border-white/20 rounded-lg p-4 bg-black/80 backdrop-blur space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">
                {selectedClass.name || "Class details"}
              </h2>
              <p className="text-[11px] text-white/60">
                {selectedClass.startAt
                  ? formatDateLabel(new Date(selectedClass.startAt))
                  : "No date set"}
              </p>
            </div>
            <button
              type="button"
              className="text-[11px] text-white/50 hover:text-white"
              onClick={() => setSelectedClass(null)}
            >
              Close
            </button>
          </div>

          {!isEditing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div>
                <span className="font-semibold text-white/80">Time: </span>
                <span>
                  {selectedClass.startAt
                    ? new Date(
                        selectedClass.startAt,
                      ).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}
                  {" – "}
                  {selectedClass.endAt
                    ? new Date(selectedClass.endAt).toLocaleTimeString(
                        "en-US",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )
                    : "-"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-white/80">Location: </span>
                <span>{selectedClass.locationName || "-"}</span>
              </div>
              <div>
                <span className="font-semibold text-white/80">Instructor: </span>
                <span>
                  {selectedClass.instructorName
                    ? selectedClass.instructorName
                    : "Unassigned"}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div>
                <span className="font-semibold text-white/80">Category: </span>
                <span>
                  {selectedClass.mainCategory
                    ? selectedClass.mainCategory.replace("_", " ")
                    : "-"}
                </span>
              </div>
              <div>
                <span className="font-semibold text-white/80">
                  Sub category:{" "}
                </span>
                <span>
                  {selectedClass.subCategory
                    ? selectedClass.subCategory.replace("_", " ")
                    : "-"}
                </span>
              </div>
            </div>
            </div>
          )}

          {isEditing && (
            <form
              action={updateAction}
              className="space-y-2 text-xs border-t border-white/10 pt-3 mt-1"
            >
              <input type="hidden" name="gymSlug" value={gymSlug} />
              <input type="hidden" name="classId" value={selectedClass.id} />
              <input type="hidden" name="viewMode" value={viewMode} />

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-white/80 text-[11px]">
                  Name
                </label>
                <input
                  name="name"
                  defaultValue={selectedClass.name}
                  className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-white/80 text-[11px]">
                    Location
                  </label>
                  <select
                    name="locationId"
                    defaultValue={
                      locations.find(
                        (l) => l.name === selectedClass.locationName,
                      )?.id ?? ""
                    }
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-white/80 text-[11px]">
                    Instructor
                  </label>
                  <select
                    name="instructorId"
                    defaultValue={
                      instructors.find(
                        (i) => i.name === selectedClass.instructorName,
                      )?.id ?? ""
                    }
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                  >
                    <option value="">Unassigned</option>
                    {instructors.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-white/80 text-[11px]">
                    Date
                  </label>
                  <input
                    type="date"
                    name="date"
                    defaultValue={toLocalDateInput(selectedClass.startAt)}
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-white/80 text-[11px]">
                    Start time
                  </label>
                  <input
                    type="time"
                    name="time"
                    defaultValue={toLocalTimeInput(selectedClass.startAt)}
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-white/80 text-[11px]">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    name="durationMinutes"
                    min={15}
                    step={15}
                    defaultValue={
                      selectedClass.startAt && selectedClass.endAt
                        ? Math.max(
                            15,
                            Math.round(
                              (new Date(selectedClass.endAt).getTime() -
                                new Date(selectedClass.startAt).getTime()) /
                                60000,
                            ),
                          )
                        : 60
                    }
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-white/80 text-[11px]">
                    Capacity
                  </label>
                  <input
                    type="number"
                    name="capacity"
                    min={1}
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-white/80 text-[11px]">
                    Min age
                  </label>
                  <input
                    type="number"
                    name="minAgeYears"
                    min={0}
                    defaultValue={
                      selectedClass.minAgeYears != null
                        ? selectedClass.minAgeYears
                        : ""
                    }
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-white/80 text-[11px]">
                    Max age
                  </label>
                  <input
                    type="number"
                    name="maxAgeYears"
                    min={0}
                    defaultValue={
                      selectedClass.maxAgeYears != null
                        ? selectedClass.maxAgeYears
                        : ""
                    }
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-white/80 text-[11px]">
                    Category
                  </label>
                  <select
                    name="mainCategory"
                    defaultValue={selectedClass.mainCategory ?? ""}
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                  >
                    <option value="">Select</option>
                    <option value="OPEN_MAT">Open Mat</option>
                    <option value="GI">Gi</option>
                    <option value="NO_GI">No Gi</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-white/80 text-[11px]">
                    Sub category
                  </label>
                  <select
                    name="subCategory"
                    defaultValue={selectedClass.subCategory ?? ""}
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                  >
                    <option value="">Select</option>
                    <option value="STAND_UP">Stand-up</option>
                    <option value="FUNDAMENTALS">Fundamentals</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="ADVANCED">Advanced</option>
                    <option value="COMPETITION">Competition</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-white/20 text-xs hover:bg-white/10"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-md bg-orange-600 text-xs font-medium hover:bg-orange-500"
                >
                  Save changes
                </button>
              </div>
            </form>
          )}

          {!isEditing && (
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10 mt-1">
              <button
                type="button"
                className="px-3 py-1.5 rounded-md border border-white/20 text-xs hover:bg-white/10"
                onClick={() => setIsEditing(true)}
              >
                Edit class
              </button>
              <form action={deleteAction}>
                <input type="hidden" name="gymSlug" value={gymSlug} />
                <input type="hidden" name="classId" value={selectedClass.id} />
                <input type="hidden" name="viewMode" value={viewMode} />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-md border border-red-500 text-xs text-red-300 hover:bg-red-500/10"
                >
                  Delete class
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

