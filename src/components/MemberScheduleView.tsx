"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ClassItem = {
  id: string;
  name: string;
  startAt: string;
  endAt: string;
  locationName: string;
  instructorName: string;
  guestNames: string[];
  topic: string | null;
  mainCategory: string | null;
  subCategory: string | null;
  age: "ALL_AGES" | "ADULT_17_PLUS" | "AGE_4_6" | "AGE_7_10" | "AGE_11_15" | null;
  capacity?: number | null;
  signupCount?: number;
  instructorId?: string | null;
  instructorMemberId?: string | null;
  attendanceConfirmedAt?: string | null;
  attended?: boolean;
};

type ViewMode = "day" | "week" | "month";

type Props = {
  classes: ClassItem[];
  gymSlug: string;
  memberId: string;
  checkedInClassIds: string[];
  signUpAction: (formData: FormData) => void | Promise<void>;
  unsignAction: (formData: FormData) => void | Promise<void>;
  initialViewMode?: ViewMode;
  showHint?: boolean;
};

const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function MemberScheduleView({
  classes,
  gymSlug,
  memberId,
  checkedInClassIds,
  signUpAction,
  unsignAction,
  initialViewMode = "week",
  showHint = true,
}: Props) {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedMainCategory, setSelectedMainCategory] = useState<string>("all");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("all");

  const [optimisticAdded, setOptimisticAdded] = useState<Set<string>>(() => new Set());
  const [optimisticRemoved, setOptimisticRemoved] = useState<Set<string>>(() => new Set());

  const checkedInSet = useMemo(
    () => new Set(checkedInClassIds),
    [checkedInClassIds],
  );

  const effectiveCheckedInSet = useMemo(() => {
    const s = new Set(checkedInSet);
    for (const id of optimisticAdded) s.add(id);
    for (const id of optimisticRemoved) s.delete(id);
    return s;
  }, [checkedInSet, optimisticAdded, optimisticRemoved]);

  useEffect(() => {
    setOptimisticAdded((prev) => {
      const next = new Set(prev);
      for (const id of prev) if (checkedInSet.has(id)) next.delete(id);
      return next;
    });
    setOptimisticRemoved((prev) => {
      const next = new Set(prev);
      for (const id of prev) if (!checkedInSet.has(id)) next.delete(id);
      return next;
    });
  }, [checkedInClassIds]);

  const handleClassClick = useCallback(
    (c: ClassItem) => {
      if (effectiveCheckedInSet.has(c.id)) return;
      setOptimisticAdded((prev) => new Set(prev).add(c.id));
      const formData = new FormData();
      formData.set("gymSlug", gymSlug);
      formData.set("memberId", memberId);
      formData.set("classId", c.id);
      Promise.resolve(signUpAction(formData)).then(() => router.refresh()).catch(() => {
        setOptimisticAdded((prev) => {
          const next = new Set(prev);
          next.delete(c.id);
          return next;
        });
      });
    },
    [effectiveCheckedInSet, gymSlug, memberId, signUpAction, router],
  );

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
    selectedMainCategory,
    selectedSubCategory,
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

    const firstOfMonth = new Date(year, month, 1);
    const startOfCalendar = new Date(firstOfMonth);
    const firstDay = firstOfMonth.getDay();
    const diffToMonday = (firstDay + 6) % 7;
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

  function ClassCard({
    c,
    compact = false,
  }: {
    c: ClassItem;
    compact?: boolean;
  }) {
    const start = formatTime(c.startAt);
    const end = formatTime(c.endAt);
    const isCheckedIn = effectiveCheckedInSet.has(c.id);

    const endAt = c.endAt ? new Date(c.endAt) : null;
    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    const classEnded5hAgo = endAt != null && endAt < fiveHoursAgo;
    const attended = c.attended ?? false;
    const attendanceConfirmedAt = c.attendanceConfirmedAt
      ? new Date(c.attendanceConfirmedAt)
      : null;

    const borderClass =
      attended
        ? "border-green-500/50"
        : classEnded5hAgo && !attended
          ? "border-red-500/50"
          : "border-white/15";
    const bgClass =
      classEnded5hAgo && !attendanceConfirmedAt
        ? "bg-red-950/40"
        : "bg-black/40";

    const onCardClick = (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-checkbox]") || target.closest("[data-attendance-link]")) return;
      handleClassClick(c);
    };

    const signupCount = c.signupCount ?? 0;
    const capacity = c.capacity;
    const attendanceLabel =
      capacity != null ? `${String(signupCount).padStart(2, "0")}/${capacity}` : null;
    const isInstructorOfClass = c.instructorMemberId != null && memberId === c.instructorMemberId;

    return (
      <div
        className={`relative rounded-md border px-1.5 py-1 space-y-0.5 cursor-pointer hover:border-white/30 transition-colors flex items-start gap-1.5 ${
          compact ? "py-0.5" : "py-1"
        } ${borderClass} ${bgClass}`}
        data-class-card="true"
        role="button"
        tabIndex={0}
        onClick={onCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClassClick(c);
          }
        }}
      >
        {!isInstructorOfClass && (
          <span
            data-checkbox
            className={`absolute top-1 right-1 flex items-center justify-center w-4 h-4 rounded border cursor-pointer shrink-0 ${
              attended
                ? "border-green-500/50 text-green-500"
                : isCheckedIn
                  ? "border-green-500/30 text-green-500/70"
                  : "border-white/40 bg-black/40 hover:border-orange-500"
            } ${!attended && isCheckedIn ? "hover:border-red-500/40 hover:bg-red-500/10" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (isCheckedIn) return;
              setOptimisticAdded((prev) => new Set(prev).add(c.id));
              const formData = new FormData();
              formData.set("gymSlug", gymSlug);
              formData.set("memberId", memberId);
              formData.set("classId", c.id);
              Promise.resolve(signUpAction(formData)).then(() => router.refresh()).catch(() => {
                setOptimisticAdded((prev) => {
                  const next = new Set(prev);
                  next.delete(c.id);
                  return next;
                });
              });
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            role="checkbox"
            aria-checked={isCheckedIn}
            aria-label={
              isCheckedIn
                ? "Signed up (click to unsign)"
                : "Sign up for class"
            }
          >
            {isCheckedIn ? (
              <button
                type="button"
                className="flex items-center justify-center w-full h-full cursor-pointer hover:opacity-80"
                aria-label="Unsign from class"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setOptimisticRemoved((prev) => new Set(prev).add(c.id));
                  const formData = new FormData();
                  formData.set("gymSlug", gymSlug);
                  formData.set("memberId", memberId);
                  formData.set("classId", c.id);
                  Promise.resolve(unsignAction(formData)).then(() => router.refresh()).catch(() => {
                    setOptimisticRemoved((prev) => {
                      const next = new Set(prev);
                      next.delete(c.id);
                      return next;
                    });
                  });
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              </button>
            ) : null}
          </span>
        )}
        <div className={`flex-1 min-w-0 ${isInstructorOfClass ? "pr-1" : "pr-6"} ${attendanceLabel != null ? "pb-4" : ""}`}>
          <div className={compact ? "text-[10px] font-medium" : "text-[11px] font-medium"}>{c.name || "Class"}</div>
          <div className={compact ? "text-[9px] text-white/80" : "text-[10px] text-white/80"}>
            {start}
            {end ? `–${end}` : ""}
          </div>
          {(c.mainCategory || c.subCategory) && (
            <div className="flex flex-wrap gap-1 mt-0.5">
              {c.mainCategory && (
                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-white/80">
                  {c.mainCategory.replace(/_/g, " ")}
                </span>
              )}
              {c.subCategory && (
                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-white/10 text-white/80">
                  {c.subCategory.replace(/_/g, " ")}
                </span>
              )}
            </div>
          )}
          {c.instructorName && (
            <div className={compact ? "text-[9px] text-white/70" : "text-[10px] text-white/70"}>{c.instructorName}</div>
          )}
        </div>
        {attendanceLabel != null && (
          <Link
            href={`/${gymSlug}/admin/schedule/${c.id}`}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            data-attendance-link
            className="absolute bottom-1 right-1 text-[9px] text-white/60 hover:text-white/90 hover:underline"
          >
            {attendanceLabel}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
        {showHint && (
          <p className="text-[11px] text-white/60">
            Click a class or checkbox to sign up.
          </p>
        )}
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
            <span className="ml-2 text-[11px] text-white/70">{monthLabel}</span>
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
                    {sorted.map((c) => (
                      <li key={c.id} className="px-3 py-2">
                        <ClassCard c={c} />
                      </li>
                    ))}
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
                className="min-h-[120px] px-1.5 py-1.5 space-y-1 bg-black/40"
              >
                {items.length === 0 ? (
                  <p className="text-[10px] text-white/40">No classes</p>
                ) : (
                  items.map((c) => <ClassCard key={c.id} c={c} />)
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
            {monthGrid.map(({ date, items, inCurrentMonth }) => (
              <div
                key={date.toISOString()}
                className={`min-h-[110px] px-1.5 py-1.5 space-y-1 ${
                  inCurrentMonth ? "" : "opacity-40"
                } bg-black/40`}
              >
                <div className="text-[11px] font-semibold">
                  {date.getDate()}
                </div>
                {items.slice(0, 3).map((c) => (
                  <ClassCard key={c.id} c={c} compact />
                ))}
                {items.length > 3 && (
                  <div className="text-[10px] text-white/70">
                    +{items.length - 3} more
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
