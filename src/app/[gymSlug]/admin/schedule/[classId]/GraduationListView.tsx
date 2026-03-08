"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BeltRankIcon } from "../../reporting/BeltRankIcon";
import { type MemberSummary } from "../../reporting/AttendanceByMemberTable";
import { buildEventListDisplayRows } from "@/lib/graduationListOrder";
import type { CloseGraduationUpdate } from "./actions";

type SnapshotRow = MemberSummary & {
  member: { id: string; firstName: string; lastName: string; email: string | null };
  belt?: string | null;
  stripes?: number | null;
};

export type SavedSnapshot = {
  data: SnapshotRow[];
  memberCheckCounts?: Record<string, 0 | 1 | 2>;
  nextRankOverrides?: Record<string, { belt: string; stripes: number }>;
  selectedMemberIds?: string[];
};

type DisplayItem =
  | { type: "spacer" }
  | { type: "row"; row: SnapshotRow; checkCount: number; nextRank: { belt: string; stripes: number } | null };

type Props = {
  snapshot: SavedSnapshot;
  gymSlug: string;
  classId: string;
  closeGraduationEvent: (gymSlug: string, classId: string, updates: CloseGraduationUpdate[]) => Promise<{ error?: string }>;
};

export function GraduationListView({ snapshot, gymSlug, classId, closeGraduationEvent }: Props) {
  const router = useRouter();
  const { data: rows, memberCheckCounts = {}, nextRankOverrides = {}, selectedMemberIds = [] } = snapshot;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [eventClosed, setEventClosed] = useState(false);

  const [checkedIds, setCheckedIds] = useState<Set<string>>(() => new Set(selectedMemberIds));

  const displayItems: DisplayItem[] = useMemo(
    () =>
      buildEventListDisplayRows(rows, memberCheckCounts, nextRankOverrides) as DisplayItem[],
    [rows, memberCheckCounts, nextRankOverrides],
  );

  const rowCount = useMemo(
    () => displayItems.filter((x) => x.type === "row").length,
    [displayItems],
  );

  const toggleCheck = (memberId: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const handleCloseEvent = () => {
    setError(null);
    const updates: CloseGraduationUpdate[] = [];
    for (const item of displayItems) {
      if (item.type !== "row" || !item.nextRank || !checkedIds.has(item.row.member.id)) continue;
      updates.push({
        memberId: item.row.member.id,
        belt: item.nextRank.belt,
        stripes: item.nextRank.stripes,
      });
    }
    startTransition(async () => {
      const result = await closeGraduationEvent(gymSlug, classId, updates);
      if (result.error) {
        setError(result.error);
      } else {
        setEventClosed(true);
        router.refresh();
      }
    });
  };

  const closeEventUpdatesCount = useMemo(() => {
    let n = 0;
    for (const item of displayItems) {
      if (item.type === "row" && item.nextRank && checkedIds.has(item.row.member.id)) n++;
    }
    return n;
  }, [displayItems, checkedIds]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xs font-semibold text-white/80 uppercase tracking-wide">
          Graduation list
        </h2>
        {rowCount > 0 &&
          (eventClosed ? (
            <span className="px-3 py-1.5 text-xs font-medium rounded-md bg-white/10 text-white/80 border border-white/20">
              Event closed
            </span>
          ) : (
            <button
              type="button"
              onClick={handleCloseEvent}
              disabled={isPending || closeEventUpdatesCount === 0}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-50 disabled:pointer-events-none"
            >
              {isPending ? "Updating…" : "Close event"}
            </button>
          ))}
      </div>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      {rowCount === 0 ? (
        <p className="text-sm text-white/60">No members with checks in this list.</p>
      ) : (
        <div className="overflow-x-auto border border-white/10 rounded-lg">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-3 py-2 text-left font-semibold">Member</th>
                <th className="px-3 py-2 text-left font-semibold">Rank</th>
                <th className="px-3 py-2 text-left font-semibold">Next rank</th>
                <th className="px-3 py-2 text-left font-semibold w-8"> </th>
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, idx) => {
                if (item.type === "spacer") {
                  return (
                    <tr key={`spacer-${idx}`} aria-hidden="true">
                      <td colSpan={4} className="py-2 bg-white/5" />
                    </tr>
                  );
                }
                const { row, checkCount, nextRank } = item;
                const name =
                  [row.member.firstName, row.member.lastName].filter(Boolean).join(" ") ||
                  row.member.email ||
                  "—";
                const checks = checkCount === 1 ? " ✓" : checkCount === 2 ? " ✓✓" : "";
                const isChecked = checkedIds.has(row.member.id);
                return (
                  <tr key={row.member.id} className="border-b border-white/5">
                    <td className="px-3 py-2 text-white/90">
                      {name}
                      {checks && <span className="text-orange-400">{checks}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <BeltRankIcon belt={row.belt ?? null} stripes={row.stripes ?? null} size={24} />
                    </td>
                    <td className="px-3 py-2">
                      {nextRank ? (
                        <BeltRankIcon belt={nextRank.belt} stripes={nextRank.stripes} size={24} />
                      ) : (
                        <span className="text-white/60">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCheck(row.member.id)}
                          className="rounded border-white/30 bg-white/10 text-orange-500 focus:ring-orange-500"
                          aria-label={`Select ${name}`}
                        />
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
