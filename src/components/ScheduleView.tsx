"use client";

import Link from "next/link";
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
  bulkUpdateAction: (formData: FormData) => void;
  initialViewMode?: ViewMode;
  bulkCreateOnDatesAction: (formData: FormData) => void;
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
  bulkUpdateAction,
  initialViewMode,
  bulkCreateOnDatesAction,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(
    initialViewMode ?? "week",
  );
  const [selectedLocationId, setSelectedLocationId] =
    useState<string>("all");
  const [selectedInstructor, setSelectedInstructor] = useState<string>("all");
  const [selectedMainCategory, setSelectedMainCategory] =
    useState<string>("all");
  const [selectedSubCategory, setSelectedSubCategory] =
    useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Multi-selection state for bulk actions
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [lastFocusedClassId, setLastFocusedClassId] = useState<string | null>(
    null,
  );
  const hasSelection = selectedClassIds.size > 0;

  // Multi-day selection for bulk create
  const [selectedDayKeys, setSelectedDayKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const hasDaySelection = selectedDayKeys.size > 0;
  const [isMultiCreateOpen, setIsMultiCreateOpen] = useState(false);
  const [multiCreateTime, setMultiCreateTime] = useState("");

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isRecurring, setIsRecurring] = useState(false);
  const [repeatDayEnabled, setRepeatDayEnabled] = useState<Record<number, boolean>>(
    {},
  );
  const [baseDateValue, setBaseDateValue] = useState("");

  const toggleClassSelection = (id: string) => {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setIsSelectionMode(true);
  };

  const clearSelection = () => {
    setSelectedClassIds(() => new Set());
    setIsSelectionMode(false);
    setLastFocusedClassId(null);
    setSelectedClass(null);
    setIsEditing(false);
  };

  const selectRange = (
    fromId: string,
    toId: string,
    orderedIds: string[],
  ) => {
    if (!fromId || !toId || orderedIds.length === 0) return;
    const startIndex = orderedIds.indexOf(fromId);
    const endIndex = orderedIds.indexOf(toId);
    if (startIndex === -1 || endIndex === -1) return;

    const [from, to] =
      startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];

    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      for (let i = from; i <= to; i++) {
        next.add(orderedIds[i]);
      }
      return next;
    });
    setIsSelectionMode(true);
  };

  type BulkFormState = {
    changeInstructor: boolean;
    instructorMode: "set" | "clear";
    instructorId: string;
    changeMainCategory: boolean;
    mainCategoryMode: "set" | "clear";
    mainCategoryValue:
      | ""
      | "OPEN_MAT"
      | "GI"
      | "NO_GI"
      | "EVENT"
      | "SEMINAR"
      | "GRADUATION";
    changeSubCategory: boolean;
    subCategoryMode: "set" | "clear";
    subCategoryValue:
      | ""
      | "STAND_UP"
      | "FUNDAMENTALS"
      | "INTERMEDIATE"
      | "ADVANCED"
      | "COMPETITION";
  };

  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [bulkState, setBulkState] = useState<BulkFormState>({
    changeInstructor: false,
    instructorMode: "set",
    instructorId: "",
    changeMainCategory: false,
    mainCategoryMode: "set",
    mainCategoryValue: "",
    changeSubCategory: false,
    subCategoryMode: "set",
    subCategoryValue: "",
  });

  const buildBulkPayload = () => {
    const classIds = Array.from(selectedClassIds);
    const payload: any = { classIds, operation: "update" };

    if (bulkState.changeInstructor) {
      if (bulkState.instructorMode === "clear") {
        payload.instructor = { kind: "clear" };
      } else {
        payload.instructor = {
          kind: "set",
          instructorId: bulkState.instructorId || undefined,
        };
      }
    }

    if (bulkState.changeMainCategory) {
      payload.mainCategory = {
        kind: bulkState.mainCategoryMode,
        value:
          bulkState.mainCategoryMode === "set"
            ? (bulkState.mainCategoryValue || undefined)
            : undefined,
      };
    }

    if (bulkState.changeSubCategory) {
      payload.subCategory = {
        kind: bulkState.subCategoryMode,
        value:
          bulkState.subCategoryMode === "set"
            ? (bulkState.subCategoryValue || undefined)
            : undefined,
      };
    }

    return payload;
  };

  const toggleDaySelection = (dayKey: string) => {
    setSelectedDayKeys((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) {
        next.delete(dayKey);
      } else {
        next.add(dayKey);
      }
      return next;
    });
  };

  const handleClassClick = (
    event: any,
    classItem: ClassItem,
    orderedIds: string[],
  ) => {
    const isMeta = event?.metaKey || event?.ctrlKey;
    const isShift = event?.shiftKey;

    if (isMeta || isShift) {
      event?.preventDefault?.();
      event?.stopPropagation?.();

      if (isShift && lastFocusedClassId && lastFocusedClassId !== classItem.id) {
        selectRange(lastFocusedClassId, classItem.id, orderedIds);
      } else {
        toggleClassSelection(classItem.id);
      }

      setLastFocusedClassId(classItem.id);
      return;
    }

    if (hasSelection) {
      clearSelection();
    }

    setSelectedClass(classItem);
    setIsEditing(false);
    setLastFocusedClassId(classItem.id);
  };

  // Simple long-press detection for touch/mobile
  const longPressTimeoutRef = typeof window !== "undefined"
    ? (window as any).longPressTimeoutRef ?? { current: null }
    : { current: null };

  const startLongPress = (classItem: ClassItem) => {
    if (longPressTimeoutRef.current) return;
    longPressTimeoutRef.current = setTimeout(() => {
      setIsSelectionMode(true);
      toggleClassSelection(classItem.id);
      setLastFocusedClassId(classItem.id);
      longPressTimeoutRef.current = null;
    }, 500);
  };

  const clearLongPress = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

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
    endOfWeek.setHours(23, 59, 59, 999);

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
    endOfMonth.setHours(23, 59, 59, 999);

    const result = classes.filter((c) => {
      if (!c.startAt) return false;
      const start = new Date(c.startAt);

      if (viewMode === "day") {
        if (start < startOfDay || start > endOfDay) return false;
      } else if (viewMode === "week") {
        if (start < startOfWeek || start > endOfWeek) return false;
      } else {
        if (start < startOfMonth || start > endOfMonth) return false;
      }

      // Instructor filter: all / none / specific
      if (selectedInstructor === "none") {
        if (c.instructorName) {
          return false;
        }
      } else if (selectedInstructor !== "all") {
        const selectedInst = instructors.find(
          (i) => i.id === selectedInstructor,
        );
        if (!selectedInst || c.instructorName !== selectedInst.name) {
          return false;
        }
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

      // Location filter: all / specific location
      if (selectedLocationId !== "all") {
        const selectedLoc = locations.find(
          (loc) => loc.id === selectedLocationId,
        );
        if (!selectedLoc || c.locationName !== selectedLoc.name) {
          return false;
        }
      }
      return true;
    });
    return result;
  }, [
    classes,
    currentDate,
    viewMode,
    selectedInstructor,
    selectedMainCategory,
    selectedSubCategory,
    selectedLocationId,
    instructors,
    locations,
  ]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, ClassItem[]> = {};
    for (const c of filteredClasses) {
      if (!c.startAt) continue;
      const d = new Date(c.startAt);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const key = `${year}-${month}-${day}`;
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
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const dayOfMonth = String(d.getDate()).padStart(2, "0");
      const key = `${year}-${month}-${dayOfMonth}`;
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

    // Start the calendar on the Monday of the week that contains the 1st
    const firstOfMonth = new Date(year, month, 1);
    const startOfCalendar = new Date(firstOfMonth);
    const firstDay = firstOfMonth.getDay(); // 0 (Sun) - 6 (Sat), local time
    const diffToMonday = (firstDay + 6) % 7; // 0 if Monday, 1 if Tue, ..., 6 if Sun
    startOfCalendar.setDate(startOfCalendar.getDate() - diffToMonday);

    const cells: { date: Date; items: ClassItem[]; inCurrentMonth: boolean }[] =
      [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(startOfCalendar);
      d.setDate(startOfCalendar.getDate() + i);
      const yearCell = d.getFullYear();
      const monthCell = String(d.getMonth() + 1).padStart(2, "0");
      const dayCell = String(d.getDate()).padStart(2, "0");
      const key = `${yearCell}-${monthCell}-${dayCell}`;
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
          value={selectedLocationId}
          onChange={(e) => setSelectedLocationId(e.target.value)}
          className="px-2 py-1 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500"
        >
          <option value="all">All locations</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>

          <select
            value={selectedInstructor}
            onChange={(e) => setSelectedInstructor(e.target.value)}
            className="px-2 py-1 rounded-md bg-black/40 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500"
          >
            <option value="all">All instructors</option>
          <option value="none">None</option>
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
            <option value="EVENT">Event</option>
            <option value="SEMINAR">Seminar</option>
            <option value="GRADUATION">Graduation</option>
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

      </div>

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
                      const orderedIds = sorted.map((item) => item.id);
      const start = c.startAt
        ? new Date(c.startAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "";
      const end = c.endAt
        ? new Date(c.endAt).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
        : "";

                      return (
                        <li
                          key={c.id}
                          className={`px-3 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-1 ${
                            selectedClassIds.has(c.id)
                              ? "ring-2 ring-orange-500 ring-offset-1 ring-offset-black/60"
                              : ""
                          }`}
                          onPointerDown={() => startLongPress(c)}
                          onPointerUp={(e) => {
                            const wasSelection = isSelectionMode;
                            clearLongPress();
                            if (wasSelection) {
                              handleClassClick(e, c, orderedIds);
                            } else {
                              // Fallback to normal click behavior
                              handleClassClick(e, c, orderedIds);
                            }
                          }}
                          onPointerLeave={clearLongPress}
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
                            {c.name && c.name !== "Class" && (
                              <span>{c.name}</span>
                            )}
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
            {weekGrid.map(({ date, items }) => {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, "0");
              const dayOfMonth = String(date.getDate()).padStart(2, "0");
              const dayKey = `${year}-${month}-${dayOfMonth}`;
              const isDaySelected = selectedDayKeys.has(dayKey);

              return (
                <div
                  key={date.toISOString()}
                  className={`min-h-[120px] px-1.5 py-1.5 space-y-1 cursor-pointer ${
                    isDaySelected
                      ? "bg-orange-900/40 ring-2 ring-orange-500"
                      : "bg-black/40"
                  }`}
                  onClick={(e) => {
                    const target = e.target as HTMLElement | null;
                    if (target && target.closest("[data-class-card='true']")) {
                      return;
                    }
                    toggleDaySelection(dayKey);
                  }}
                >
                {items.length === 0 ? (
                  <p className="text-[10px] text-white/40">No classes</p>
                ) : (
                  items.map((c) => {
                    const orderedIds = items.map((item) => item.id);
                    const start = c.startAt
                      ? new Date(c.startAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : "";
                    const end = c.endAt
                      ? new Date(c.endAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : "";

                    return (
                      <div
                        key={c.id}
                        className={`rounded-md border bg-black/40 px-1.5 py-1 space-y-0.5 ${
                          selectedClassIds.has(c.id)
                            ? "border-orange-500 ring-2 ring-orange-500"
                            : "border-white/15"
                        }`}
                        data-class-card="true"
                        onPointerDown={() => startLongPress(c)}
                        onPointerUp={(e) => {
                          const wasSelection = isSelectionMode;
                          clearLongPress();
                          handleClassClick(e, c, orderedIds);
                        }}
                        onPointerLeave={clearLongPress}
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
                        {c.name && c.name !== "Class" && (
                          <div className="text-[11px]">{c.name}</div>
                        )}
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
              );
            })}
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
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, "0");
              const dayOfMonth = String(date.getDate()).padStart(2, "0");
              const dayKey = `${year}-${month}-${dayOfMonth}`;
              const isDaySelected = selectedDayKeys.has(dayKey);

              return (
                <div
                  key={date.toISOString()}
                  className={`min-h-[110px] px-1.5 py-1.5 space-y-1 cursor-pointer ${
                    inCurrentMonth ? "" : "opacity-40"
                  } ${
                    isDaySelected
                      ? "bg-orange-900/40 ring-2 ring-orange-500"
                      : "bg-black/40"
                  }`}
                  onClick={(e) => {
                    const target = e.target as HTMLElement | null;
                    if (target && target.closest("[data-class-card='true']")) {
                      return;
                    }
                    toggleDaySelection(dayKey);
                  }}
                >
                  <div className="text-[11px] font-semibold">
                    {dayNumber}
                  </div>
                  {items.slice(0, 3).map((c) => {
                    const orderedIds = items.map((item) => item.id);
                    const start = c.startAt
                      ? new Date(c.startAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : "";
                    const end = c.endAt
                      ? new Date(c.endAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })
                      : "";

                    return (
                      <div
                        key={c.id}
                        className={`rounded-md border bg-black/40 px-1.5 py-0.5 space-y-0.5 ${
                          selectedClassIds.has(c.id)
                            ? "border-orange-500 ring-2 ring-orange-500"
                            : "border-white/15"
                        }`}
                        data-class-card="true"
                        onPointerDown={() => startLongPress(c)}
                        onPointerUp={(e) => {
                          const wasSelection = isSelectionMode;
                          clearLongPress();
                          handleClassClick(e, c, orderedIds);
                        }}
                        onPointerLeave={clearLongPress}
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
                          {start}
                          {end ? `–${end}` : ""}
                        </div>
                        <div className="text-[10px] text-white/80">
                          {c.locationName}
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

      {selectedClass && !hasSelection && (
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
                        hour12: false,
                      })
                    : "-"}
                  {" – "}
                  {selectedClass.endAt
                    ? new Date(selectedClass.endAt).toLocaleTimeString(
                        "en-US",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
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
                  required
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
                  required
                  >
                    <option value="">Select</option>
                    <option value="OPEN_MAT">Open Mat</option>
                    <option value="GI">Gi</option>
                    <option value="NO_GI">No Gi</option>
                    <option value="EVENT">Event</option>
                    <option value="SEMINAR">Seminar</option>
                    <option value="GRADUATION">Graduation</option>
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
      {hasSelection && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-black/80 border-t border-white/20 px-4 py-2 flex items-center justify-between text-xs">
          <span className="text-white/80">
            {selectedClassIds.size} classes selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded-md border border-white/20 hover:bg-white/10"
              onClick={clearSelection}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-md border border-red-500 text-red-300 hover:bg-red-500/10 font-medium"
              onClick={() => {
                setIsBulkDeleteOpen(true);
                setDeleteConfirm("");
              }}
            >
              Delete selected
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-500 font-medium"
              onClick={() => setIsBulkOpen(true)}
            >
              Edit selected
            </button>
          </div>
        </div>
      )}
      {hasDaySelection && !hasSelection && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-black/80 border-t border-white/20 px-4 py-2 flex items-center justify-between text-xs">
          <span className="text-white/80">
            {selectedDayKeys.size}{" "}
            {selectedDayKeys.size === 1 ? "day selected" : "days selected"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded-md border border-white/20 hover:bg-white/10"
              onClick={() => setSelectedDayKeys(new Set())}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-500 font-medium"
              onClick={() => setIsMultiCreateOpen(true)}
            >
              Create class on selected days
            </button>
          </div>
        </div>
      )}
      {isBulkOpen && hasSelection && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="w-full max-w-md rounded-xl border border-white/15 bg-neutral-900 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Bulk edit classes</h2>
              <button
                type="button"
                className="text-[11px] text-white/60 hover:text-white"
                onClick={() => setIsBulkOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="text-[11px] text-white/60">
              You are editing {selectedClassIds.size} classes.
            </p>
            <form action={bulkUpdateAction} className="space-y-3 text-xs">
              <input type="hidden" name="gymSlug" value={gymSlug} />
              <input
                type="hidden"
                name="bulkPayload"
                value={JSON.stringify(buildBulkPayload())}
              />

              {/* Instructor section */}
              <div className="space-y-2 border border-white/10 rounded-lg p-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-white/80">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-white/30 bg-black/40"
                    checked={bulkState.changeInstructor}
                    onChange={(e) =>
                      setBulkState((s) => ({
                        ...s,
                        changeInstructor: e.target.checked,
                      }))
                    }
                  />
                  <span>Change instructor</span>
                </label>
                {bulkState.changeInstructor && (
                  <div className="pl-5 space-y-2 text-xs">
                    <div className="flex flex-col gap-1">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          className="h-3 w-3"
                          checked={bulkState.instructorMode === "set"}
                          onChange={() =>
                            setBulkState((s) => ({
                              ...s,
                              instructorMode: "set",
                            }))
                          }
                        />
                        <span>Set instructor</span>
                      </label>
                      <select
                        className="mt-1 px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                        value={bulkState.instructorId}
                        onChange={(e) =>
                          setBulkState((s) => ({
                            ...s,
                            instructorId: e.target.value,
                          }))
                        }
                        disabled={bulkState.instructorMode !== "set"}
                      >
                        <option value="">Unassigned</option>
                        {instructors.map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            {inst.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        className="h-3 w-3"
                        checked={bulkState.instructorMode === "clear"}
                        onChange={() =>
                          setBulkState((s) => ({
                            ...s,
                            instructorMode: "clear",
                          }))
                        }
                      />
                      <span>Clear instructor (set to unassigned)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Main category section */}
              <div className="space-y-2 border border-white/10 rounded-lg p-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-white/80">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-white/30 bg-black/40"
                    checked={bulkState.changeMainCategory}
                    onChange={(e) =>
                      setBulkState((s) => ({
                        ...s,
                        changeMainCategory: e.target.checked,
                      }))
                    }
                  />
                  <span>Change main category</span>
                </label>
                {bulkState.changeMainCategory && (
                  <div className="pl-5 space-y-2 text-xs">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        className="h-3 w-3"
                        checked={bulkState.mainCategoryMode === "set"}
                        onChange={() =>
                          setBulkState((s) => ({
                            ...s,
                            mainCategoryMode: "set",
                          }))
                        }
                      />
                      <span>Set category to</span>
                    </label>
                    <select
                      className="ml-5 px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                      value={bulkState.mainCategoryValue}
                      onChange={(e) =>
                        setBulkState((s) => ({
                          ...s,
                          mainCategoryValue: e.target.value as any,
                        }))
                      }
                      disabled={bulkState.mainCategoryMode !== "set"}
                    >
                      <option value="">Select</option>
                      <option value="OPEN_MAT">Open Mat</option>
                      <option value="GI">Gi</option>
                      <option value="NO_GI">No Gi</option>
                      <option value="EVENT">Event</option>
                      <option value="SEMINAR">Seminar</option>
                      <option value="GRADUATION">Graduation</option>
                    </select>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        className="h-3 w-3"
                        checked={bulkState.mainCategoryMode === "clear"}
                        onChange={() =>
                          setBulkState((s) => ({
                            ...s,
                            mainCategoryMode: "clear",
                          }))
                        }
                      />
                      <span>Clear category</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Sub category section */}
              <div className="space-y-2 border border-white/10 rounded-lg p-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-white/80">
                  <input
                    type="checkbox"
                    className="h-3 w-3 rounded border-white/30 bg-black/40"
                    checked={bulkState.changeSubCategory}
                    onChange={(e) =>
                      setBulkState((s) => ({
                        ...s,
                        changeSubCategory: e.target.checked,
                      }))
                    }
                  />
                  <span>Change sub category</span>
                </label>
                {bulkState.changeSubCategory && (
                  <div className="pl-5 space-y-2 text-xs">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        className="h-3 w-3"
                        checked={bulkState.subCategoryMode === "set"}
                        onChange={() =>
                          setBulkState((s) => ({
                            ...s,
                            subCategoryMode: "set",
                          }))
                        }
                      />
                      <span>Set sub category to</span>
                    </label>
                    <select
                      className="ml-5 px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                      value={bulkState.subCategoryValue}
                      onChange={(e) =>
                        setBulkState((s) => ({
                          ...s,
                          subCategoryValue: e.target.value as any,
                        }))
                      }
                      disabled={bulkState.subCategoryMode !== "set"}
                    >
                      <option value="">Select</option>
                      <option value="STAND_UP">Stand-up</option>
                      <option value="FUNDAMENTALS">Fundamentals</option>
                      <option value="INTERMEDIATE">Intermediate</option>
                      <option value="ADVANCED">Advanced</option>
                      <option value="COMPETITION">Competition</option>
                    </select>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        className="h-3 w-3"
                        checked={bulkState.subCategoryMode === "clear"}
                        onChange={() =>
                          setBulkState((s) => ({
                            ...s,
                            subCategoryMode: "clear",
                          }))
                        }
                      />
                      <span>Clear sub category</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-2 text-xs">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-white/20 hover:bg-white/10"
                  onClick={() => setIsBulkOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-500 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={
                    !(
                      bulkState.changeInstructor ||
                      bulkState.changeMainCategory ||
                      bulkState.changeSubCategory
                    ) || selectedClassIds.size === 0
                  }
                >
                  Apply to {selectedClassIds.size} classes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isBulkDeleteOpen && hasSelection && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="w-full max-w-md rounded-xl border border-red-500/40 bg-neutral-900 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-red-300">
                Delete classes
              </h2>
              <button
                type="button"
                className="text-[11px] text-white/60 hover:text-white"
                onClick={() => {
                  setIsBulkDeleteOpen(false);
                  setDeleteConfirm("");
                }}
              >
                Close
              </button>
            </div>
            <p className="text-[11px] text-white/70">
              You are about to permanently delete{" "}
              <span className="font-semibold">{selectedClassIds.size}</span>{" "}
              classes. This action cannot be undone.
            </p>
            <p className="text-[11px] text-red-300">
              Type <span className="font-mono">delete</span> to confirm.
            </p>
            <form action={bulkUpdateAction} className="space-y-3 text-xs">
              <input type="hidden" name="gymSlug" value={gymSlug} />
              <input
                type="hidden"
                name="bulkPayload"
                value={JSON.stringify({
                  classIds: Array.from(selectedClassIds),
                  operation: "delete" as const,
                })}
              />
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="w-full px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                placeholder="Type delete to confirm"
              />
              <div className="flex items-center justify-between pt-2 border-t border-white/10 mt-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-white/20 hover:bg-white/10"
                  onClick={() => {
                    setIsBulkDeleteOpen(false);
                    setDeleteConfirm("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-500 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={deleteConfirm !== "delete" || selectedClassIds.size === 0}
                >
                  Delete {selectedClassIds.size} classes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isMultiCreateOpen && hasDaySelection && !hasSelection && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center">
          <div className="w-full max-w-md rounded-xl border border-white/15 bg-neutral-900 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Create class on days</h2>
              <button
                type="button"
                className="text-[11px] text-white/60 hover:text-white"
                onClick={() => setIsMultiCreateOpen(false)}
              >
                Close
              </button>
            </div>
            <p className="text-[11px] text-white/60">
              You are creating the same class on{" "}
              <span className="font-semibold">{selectedDayKeys.size}</span>{" "}
              selected{" "}
              {selectedDayKeys.size === 1 ? "day" : "days"}.
            </p>
            <form
              action={bulkCreateOnDatesAction}
              className="space-y-3 text-xs border-t border-white/10 pt-3 mt-1"
            >
              <input type="hidden" name="gymSlug" value={gymSlug} />
              <input
                type="hidden"
                name="datesJson"
                value={JSON.stringify(Array.from(selectedDayKeys))}
              />

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-white/80 text-[11px]">
                  Name
                </label>
                <input
                  name="name"
                  className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                  placeholder="Class name"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-white/80 text-[11px]">
                    Location
                  </label>
                  <select
                    name="locationId"
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                    required
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
                    Start time
                  </label>
                  <input
                    type="text"
                    name="time"
                    placeholder="HHMM"
                    inputMode="numeric"
                    value={multiCreateTime}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "").slice(0, 4);
                      if (raw.length <= 2) {
                        setMultiCreateTime(raw);
                      } else {
                        const hh = raw.slice(0, 2);
                        const mm = raw.slice(2);
                        setMultiCreateTime(`${hh}:${mm}`);
                      }
                    }}
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-white/80 text-[11px]">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    name="durationMinutes"
                    min={15}
                    step={15}
                    defaultValue={60}
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-white/80 text-[11px]">
                    Capacity
                  </label>
                  <input
                    type="number"
                    name="capacity"
                    min={1}
                    defaultValue={45}
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                  required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-white/80 text-[11px]">
                    Category
                  </label>
                  <select
                    name="mainCategory"
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                  required
                  >
                    <option value="">Select</option>
                    <option value="OPEN_MAT">Open Mat</option>
                    <option value="GI">Gi</option>
                    <option value="NO_GI">No Gi</option>
                    <option value="EVENT">Event</option>
                    <option value="SEMINAR">Seminar</option>
                    <option value="GRADUATION">Graduation</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-white/80 text-[11px]">
                    Sub category
                  </label>
                  <select
                    name="subCategory"
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
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-white/80 text-[11px]">
                    Min / Max age
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      name="minAgeYears"
                      min={0}
                      className="w-1/2 px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                      placeholder="Min"
                    />
                    <input
                      type="number"
                      name="maxAgeYears"
                      min={0}
                      className="w-1/2 px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
                      placeholder="Max"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-2 text-xs">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-md border border-white/20 hover:bg-white/10"
                  onClick={() => setIsMultiCreateOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-500 font-medium"
                >
                  Create on {selectedDayKeys.size}{" "}
                  {selectedDayKeys.size === 1 ? "day" : "days"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

