"use client";

import { useRef, useState, useEffect } from "react";
import { ClassCountCell, type CategoryBreakdown } from "./ClassCountCell";
import { BeltRankIcon } from "./BeltRankIcon";

export type LastBeltChange = {
  changedAt: Date | string;
  previousBelt: string | null;
  previousStripes: number | null;
};

export type MemberSummary = {
  member: { id: string; firstName: string; lastName: string; email: string | null };
  count: number;
  byCategory: Record<string, CategoryBreakdown>;
  belt?: string | null;
  stripes?: number | null;
  lastBeltChange?: LastBeltChange | null;
  memberType?: string | null;
  subscriptionStatus?: string | null;
  userRole?: string | null;
  weeksOff?: number;
  longestStreakDaysOff?: number;
};

export type OptionalColumnId = "memberType" | "subscriptionStatus" | "userRole";

export type ColumnId =
  | "member"
  | "rank"
  | "lastChange"
  | "memberType"
  | "subscriptionStatus"
  | "userRole"
  | "weeksOff"
  | "longestStreakDaysOff"
  | "classes";

export const ALL_COLUMNS: { id: ColumnId; label: string }[] = [
  { id: "member", label: "Member" },
  { id: "rank", label: "Rank" },
  { id: "lastChange", label: "Last change" },
  { id: "memberType", label: "Member type" },
  { id: "subscriptionStatus", label: "Subscription status" },
  { id: "userRole", label: "User role" },
  { id: "weeksOff", label: "Weeks off" },
  { id: "longestStreakDaysOff", label: "Longest streak (days off)" },
  { id: "classes", label: "Classes" },
];

export const OPTIONAL_COLUMNS: { id: OptionalColumnId; label: string }[] = [
  { id: "memberType", label: "Member type" },
  { id: "subscriptionStatus", label: "Subscription status" },
  { id: "userRole", label: "User role" },
];

function formatCategoryLabel(cat: string): string {
  if (cat === "Uncategorized") return cat;
  return cat.replace(/_/g, " ");
}

type Props = {
  memberSummaries: MemberSummary[];
  mainCategories: string[];
  subCategories: string[];
  columnLabel: string;
  visibleColumns: Set<ColumnId>;
  onToggleColumn: (id: ColumnId) => void;
  /** Rendered in the last header cell (e.g. column selector "+"). */
  columnSelectorHeader?: React.ReactNode;
};

/** Count check-ins for a member where (main in selectedMains OR sub in selectedSubs); each check-in counted once */
function countMatching(
  summary: MemberSummary,
  selectedMains: Set<string>,
  selectedSubs: Set<string>
): { count: number; byCategory: Record<string, CategoryBreakdown>; belt?: string | null; stripes?: number | null;   lastBeltChange?: LastBeltChange | null; memberType?: string | null; subscriptionStatus?: string | null; userRole?: string | null; weeksOff?: number; longestStreakDaysOff?: number } {
  if (selectedMains.size === 0 && selectedSubs.size === 0) {
    return {
      count: summary.count,
      byCategory: summary.byCategory,
      belt: summary.belt,
      stripes: summary.stripes,
      lastBeltChange: summary.lastBeltChange,
      memberType: summary.memberType,
      subscriptionStatus: summary.subscriptionStatus,
      userRole: summary.userRole,
      weeksOff: summary.weeksOff,
      longestStreakDaysOff: summary.longestStreakDaysOff,
    };
  }
  const byCategory: Record<string, CategoryBreakdown> = {};
  let total = 0;
  for (const [main, breakdown] of Object.entries(summary.byCategory)) {
    const mainSelected = selectedMains.has(main);
    const bySub: Record<string, number> = {};
    let mainTotal = 0;
    for (const [sub, n] of Object.entries(breakdown.bySubcategory)) {
      const subSelected = selectedSubs.has(sub);
      if (mainSelected || subSelected) {
        bySub[sub] = n;
        mainTotal += n;
        total += n;
      }
    }
    if (mainTotal > 0) {
      byCategory[main] = { total: mainTotal, bySubcategory: bySub };
    }
  }
  return {
    count: total,
    byCategory,
    belt: summary.belt,
    stripes: summary.stripes,
    lastBeltChange: summary.lastBeltChange,
    memberType: summary.memberType,
    subscriptionStatus: summary.subscriptionStatus,
    userRole: summary.userRole,
    weeksOff: summary.weeksOff,
    longestStreakDaysOff: summary.longestStreakDaysOff,
  };
}

export function AttendanceByMemberTable({
  memberSummaries,
  mainCategories,
  subCategories,
  columnLabel,
  visibleColumns,
  onToggleColumn,
  columnSelectorHeader,
}: Props) {
  const [selectedMains, setSelectedMains] = useState<Set<string>>(new Set());
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());
  const [headerDropdownOpen, setHeaderDropdownOpen] = useState(false);
  const [openLastChangeMemberId, setOpenLastChangeMemberId] = useState<string | null>(null);
  const [nameSearch, setNameSearch] = useState("");
  const [memberCheckCounts, setMemberCheckCounts] = useState<Record<string, 0 | 1 | 2>>({});
  const headerRef = useRef<HTMLDivElement>(null);
  const lastChangePopoverRef = useRef<HTMLDivElement>(null);

  function handleRowClick(memberId: string, e: React.MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("button, [role=\"button\"], a, input, select")) return;
    setMemberCheckCounts((prev) => {
      const current = prev[memberId] ?? 0;
      const next: 0 | 1 | 2 = current === 0 ? 1 : current === 1 ? 2 : 0;
      return { ...prev, [memberId]: next };
    });
  }

  useEffect(() => {
    if (!headerDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setHeaderDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [headerDropdownOpen]);

  useEffect(() => {
    if (openLastChangeMemberId == null) return;
    function handleClickOutside(e: MouseEvent) {
      if (lastChangePopoverRef.current && !lastChangePopoverRef.current.contains(e.target as Node)) {
        setOpenLastChangeMemberId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openLastChangeMemberId]);

  const toggleMain = (main: string) => {
    setSelectedMains((prev) => {
      const next = new Set(prev);
      if (next.has(main)) next.delete(main);
      else next.add(main);
      return next;
    });
  };

  const toggleSub = (sub: string) => {
    setSelectedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(sub)) next.delete(sub);
      else next.add(sub);
      return next;
    });
  };

  const hasFilter = selectedMains.size > 0 || selectedSubs.size > 0;

  const categoryFiltered = (() => {
    if (!hasFilter) return memberSummaries;
    return memberSummaries
      .map((s) => {
        const { count, byCategory, belt, stripes, lastBeltChange, memberType, subscriptionStatus, userRole, weeksOff, longestStreakDaysOff } = countMatching(
          s,
          selectedMains,
          selectedSubs
        );
        return { member: s.member, count, byCategory, belt, stripes, lastBeltChange, memberType, subscriptionStatus, userRole, weeksOff, longestStreakDaysOff };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  })();

  const searchLower = nameSearch.trim().toLowerCase();
  const filtered =
    searchLower === ""
      ? categoryFiltered
      : categoryFiltered.filter((row) => {
          const name =
            [row.member.firstName, row.member.lastName].filter(Boolean).join(" ") ||
            row.member.email ||
            "";
          return name.toLowerCase().includes(searchLower) || (row.member.email ?? "").toLowerCase().includes(searchLower);
        });

  const filterLabel = hasFilter
    ? [
        ...Array.from(selectedMains).map(formatCategoryLabel),
        ...Array.from(selectedSubs).map(formatCategoryLabel),
      ].join(", ")
    : null;

  const USER_ROLE_LABELS: Record<string, string> = {
    PLATFORM_ADMIN: "Platform admin",
    GYM_ADMIN: "Gym admin",
    LOCATION_ADMIN: "Location admin",
    STAFF: "Staff",
    INSTRUCTOR: "Instructor",
    MEMBER: "Member",
  };

  function formatOptionalValue(value: string | null | undefined, columnId: OptionalColumnId): string {
    if (value == null || value === "") return "—";
    if (columnId === "memberType") return value === "ADULT" ? "Adult" : value === "CHILD" ? "Child" : value;
    if (columnId === "subscriptionStatus") return value.replace(/_/g, " ");
    if (columnId === "userRole") return USER_ROLE_LABELS[value] ?? value.replace(/_/g, " ");
    return value;
  }

  return (
    <div className="overflow-x-auto border border-white/10 rounded-lg">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            {visibleColumns.has("member") && (
              <th className="px-3 py-2 text-left font-semibold">
                <input
                  type="search"
                  placeholder="Search name..."
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  className="w-full min-w-[8rem] max-w-[12rem] rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  aria-label="Search by member name"
                />
              </th>
            )}
            {visibleColumns.has("rank") && (
              <th className="px-3 py-2 text-left font-semibold">Rank</th>
            )}
            {visibleColumns.has("lastChange") && (
              <th className="px-3 py-2 text-left font-semibold">Last change</th>
            )}
            {visibleColumns.has("memberType") && (
              <th className="px-3 py-2 text-left font-semibold">Member type</th>
            )}
            {visibleColumns.has("subscriptionStatus") && (
              <th className="px-3 py-2 text-left font-semibold">Subscription status</th>
            )}
            {visibleColumns.has("userRole") && (
              <th className="px-3 py-2 text-left font-semibold">User role</th>
            )}
            {visibleColumns.has("weeksOff") && (
              <th className="px-3 py-2 text-left font-semibold">Weeks off</th>
            )}
            {visibleColumns.has("longestStreakDaysOff") && (
              <th className="px-3 py-2 text-left font-semibold">Longest streak (days off)</th>
            )}
            {visibleColumns.has("classes") && (
              <th className="px-3 py-2 text-left font-semibold">
                <div ref={headerRef} className="relative inline-block">
                  <button
                    type="button"
                    onClick={() => setHeaderDropdownOpen((v) => !v)}
                    className="text-left font-semibold underline decoration-dotted underline-offset-1 hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
                  >
                    {columnLabel}
                    {filterLabel !== null && (
                      <span className="text-white/60 font-normal">
                        {" "}({filterLabel})
                      </span>
                    )}
                  </button>
                  {headerDropdownOpen && (
                    <div className="absolute left-0 top-full z-20 mt-1 rounded-lg border border-white/20 bg-zinc-900 py-2 shadow-lg max-h-[70vh] overflow-y-auto">
                      <div className="flex">
                        <ul className="min-w-[8rem] border-r border-white/10 pr-1 space-y-0.5 px-3">
                          {mainCategories.map((main) => {
                            const selected = selectedMains.has(main);
                            return (
                              <li key={main} className="py-0.5">
                                <button
                                  type="button"
                                  onClick={() => toggleMain(main)}
                                  className={`w-full text-left text-[11px] hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded cursor-pointer ${
                                    selected ? "text-orange-400 font-medium" : "text-white/80"
                                  }`}
                                  title={selected ? "Selected (click to clear filter)" : "Click to filter by this category"}
                                >
                                  {formatCategoryLabel(main)}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                        <ul className="min-w-[8rem] space-y-0.5 px-3">
                          {subCategories.map((sub) => {
                            const selected = selectedSubs.has(sub);
                            return (
                              <li key={sub} className="py-0.5">
                                <button
                                  type="button"
                                  onClick={() => toggleSub(sub)}
                                  className={`w-full text-left text-[11px] hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded cursor-pointer ${
                                    selected ? "text-orange-400 font-medium" : "text-white/80"
                                  }`}
                                  title={selected ? "Selected (click to clear filter)" : "Click to filter by this category"}
                                >
                                  {formatCategoryLabel(sub)}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </th>
            )}
            {columnSelectorHeader != null && (
              <th className="px-2 py-2 text-right w-0">{columnSelectorHeader}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {filtered.map(({ member, count, byCategory, belt, stripes, lastBeltChange, memberType, subscriptionStatus, userRole, weeksOff, longestStreakDaysOff }) => {
            const memberName =
              [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email || "—";
            const hasRank = belt != null || stripes != null;
            const showRankIcon = hasRank;
            const lastChangeDateStr =
              lastBeltChange != null
                ? new Date(lastBeltChange.changedAt).toLocaleDateString()
                : null;
            const isLastChangePopoverOpen = openLastChangeMemberId === member.id;
            const checkCount = memberCheckCounts[member.id] ?? 0;
            const checks = checkCount === 1 ? " ✓" : checkCount === 2 ? " ✓✓" : "";
            return (
              <tr
                key={member.id}
                className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                onClick={(e) => handleRowClick(member.id, e)}
                aria-label={checkCount === 0 ? "Member row, no checks" : checkCount === 1 ? "Member row, 1 check" : "Member row, 2 checks"}
              >
                {visibleColumns.has("member") && (
                  <td className="px-3 py-2 text-white/90">
                    {memberName}
                    {checks && <span className="text-orange-400">{checks}</span>}
                  </td>
                )}
                {visibleColumns.has("rank") && (
                  <td className="px-3 py-2 text-white/80">
                    {showRankIcon ? (
                      <BeltRankIcon belt={belt ?? null} stripes={stripes ?? null} />
                    ) : (
                      <span className="text-white/60 text-xs">Unranked</span>
                    )}
                  </td>
                )}
                {visibleColumns.has("lastChange") && (
                  <td className="px-3 py-2 text-white/80">
                    <div
                      ref={isLastChangePopoverOpen ? lastChangePopoverRef : undefined}
                      className="relative inline-block"
                    >
                      {lastChangeDateStr != null ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenLastChangeMemberId((id) => (id === member.id ? null : member.id))
                            }
                            className="text-white/80 underline decoration-dotted underline-offset-1 hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded text-xs"
                          >
                            {lastChangeDateStr}
                          </button>
                          {isLastChangePopoverOpen && lastBeltChange && (
                            <div className="absolute left-0 top-full z-10 mt-1 rounded-lg border border-white/20 bg-zinc-900 px-3 py-2 shadow-lg">
                              <div className="text-[10px] font-medium text-white/60 uppercase tracking-wide mb-1">
                                Previous rank
                              </div>
                              <BeltRankIcon
                                belt={lastBeltChange.previousBelt}
                                stripes={lastBeltChange.previousStripes}
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-white/50 text-xs">—</span>
                      )}
                    </div>
                  </td>
                )}
                {visibleColumns.has("memberType") && (
                  <td className="px-3 py-2 text-white/80 text-xs">
                    {formatOptionalValue(memberType ?? null, "memberType")}
                  </td>
                )}
                {visibleColumns.has("subscriptionStatus") && (
                  <td className="px-3 py-2 text-white/80 text-xs">
                    {formatOptionalValue(subscriptionStatus ?? null, "subscriptionStatus")}
                  </td>
                )}
                {visibleColumns.has("userRole") && (
                  <td className="px-3 py-2 text-white/80 text-xs">
                    {formatOptionalValue(userRole ?? null, "userRole")}
                  </td>
                )}
                {visibleColumns.has("weeksOff") && (
                  <td className="px-3 py-2 text-white/80 tabular-nums">
                    {weeksOff ?? 0}
                  </td>
                )}
                {visibleColumns.has("longestStreakDaysOff") && (
                  <td className="px-3 py-2 text-white/80 tabular-nums">
                    {longestStreakDaysOff ?? 0}
                  </td>
                )}
                {visibleColumns.has("classes") && (
                  <td className="px-3 py-2 text-white/80">
                    <ClassCountCell count={count} byCategory={byCategory} />
                  </td>
                )}
                {columnSelectorHeader != null && <td className="w-0" />}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
