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
};

function formatCategoryLabel(cat: string): string {
  if (cat === "Uncategorized") return cat;
  return cat.replace(/_/g, " ");
}

type Props = {
  memberSummaries: MemberSummary[];
  mainCategories: string[];
  subCategories: string[];
  columnLabel: string;
};

/** Count check-ins for a member where (main in selectedMains OR sub in selectedSubs); each check-in counted once */
function countMatching(
  summary: MemberSummary,
  selectedMains: Set<string>,
  selectedSubs: Set<string>
): { count: number; byCategory: Record<string, CategoryBreakdown>; belt?: string | null; stripes?: number | null; lastBeltChange?: LastBeltChange | null } {
  if (selectedMains.size === 0 && selectedSubs.size === 0) {
    return {
      count: summary.count,
      byCategory: summary.byCategory,
      belt: summary.belt,
      stripes: summary.stripes,
      lastBeltChange: summary.lastBeltChange,
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
  };
}

export function AttendanceByMemberTable({
  memberSummaries,
  mainCategories,
  subCategories,
  columnLabel,
}: Props) {
  const [selectedMains, setSelectedMains] = useState<Set<string>>(new Set());
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());
  const [headerDropdownOpen, setHeaderDropdownOpen] = useState(false);
  const [openLastChangeMemberId, setOpenLastChangeMemberId] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const lastChangePopoverRef = useRef<HTMLDivElement>(null);

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

  const filtered = (() => {
    if (!hasFilter) return memberSummaries;
    return memberSummaries
      .map((s) => {
        const { count, byCategory, belt, stripes, lastBeltChange } = countMatching(
          s,
          selectedMains,
          selectedSubs
        );
        return { member: s.member, count, byCategory, belt, stripes, lastBeltChange };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  })();

  const filterLabel = hasFilter
    ? [
        ...Array.from(selectedMains).map(formatCategoryLabel),
        ...Array.from(selectedSubs).map(formatCategoryLabel),
      ].join(", ")
    : null;

  return (
    <div className="overflow-x-auto border border-white/10 rounded-lg">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="px-3 py-2 text-left font-semibold">Member</th>
            <th className="px-3 py-2 text-left font-semibold">Rank</th>
            <th className="px-3 py-2 text-left font-semibold">Last change</th>
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
                  <div className="absolute left-0 top-full z-20 mt-1 rounded-lg border border-white/20 bg-zinc-900 py-2 shadow-lg">
                    <div className="flex">
                      <ul className="min-w-[8rem] border-r border-white/10 pr-1 space-y-0.5">
                        {mainCategories.map((main) => {
                          const selected = selectedMains.has(main);
                          return (
                            <li key={main}>
                              <button
                                type="button"
                                onClick={() => toggleMain(main)}
                                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-white/10 ${
                                  selected ? "text-orange-400 font-medium" : "text-white/90"
                                }`}
                              >
                                {formatCategoryLabel(main)}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      <ul className="min-w-[8rem] space-y-0.5">
                        {subCategories.map((sub) => {
                          const selected = selectedSubs.has(sub);
                          return (
                            <li key={sub}>
                              <button
                                type="button"
                                onClick={() => toggleSub(sub)}
                                className={`w-full px-3 py-1.5 text-left text-sm hover:bg-white/10 ${
                                  selected ? "text-orange-400 font-medium" : "text-white/90"
                                }`}
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
          </tr>
        </thead>
        <tbody>
          {filtered.map(({ member, count, byCategory, belt, stripes, lastBeltChange }) => {
            const memberName =
              [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email || "—";
            const hasRank = belt != null || stripes != null;
            const showRankIcon = hasRank;
            const lastChangeDateStr =
              lastBeltChange != null
                ? new Date(lastBeltChange.changedAt).toLocaleDateString()
                : null;
            const isLastChangePopoverOpen = openLastChangeMemberId === member.id;
            return (
              <tr key={member.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-3 py-2 text-white/90">{memberName}</td>
                <td className="px-3 py-2 text-white/80">
                  {showRankIcon ? (
                    <BeltRankIcon belt={belt ?? null} stripes={stripes ?? null} />
                  ) : (
                    <span className="text-white/60 text-xs">Unranked</span>
                  )}
                </td>
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
                <td className="px-3 py-2 text-white/80">
                  <ClassCountCell count={count} byCategory={byCategory} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
