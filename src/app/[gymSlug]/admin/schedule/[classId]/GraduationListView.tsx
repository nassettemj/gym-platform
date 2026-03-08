"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BeltRankIcon } from "../../reporting/BeltRankIcon";
import {
  getNextRankForEventList,
  BELT_ORDER_FOR_SORT,
  type MemberSummary,
} from "../../reporting/AttendanceByMemberTable";
import type { CloseGraduationUpdate } from "./actions";

type SnapshotRow = MemberSummary & {
  member: { id: string; firstName: string; lastName: string; email: string | null };
  belt?: string | null;
  stripes?: number | null;
};

type SavedSnapshot = {
  data: SnapshotRow[];
  memberCheckCounts?: Record<string, 0 | 1 | 2>;
  nextRankOverrides?: Record<string, { belt: string; stripes: number }>;
  selectedMemberIds?: string[];
};

type DisplayItem =
  | { type: "spacer" }
  | { type: "row"; row: SnapshotRow; checkCount: number; nextRank: { belt: string; stripes: number } | null };

function beltSortIndex(belt: string | null | undefined): number {
  if (belt == null || belt === "") return 0;
  const i = BELT_ORDER_FOR_SORT.indexOf(belt as (typeof BELT_ORDER_FOR_SORT)[number]);
  return i < 0 ? 999 : i;
}

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

  const displayItems: DisplayItem[] = useMemo(() => {
    const withChecks = rows.filter((row) => (memberCheckCounts[row.member.id] ?? 0) >= 1);
    const rowsWithMeta: {
      row: SnapshotRow;
      checkCount: number;
      nextRank: { belt: string; stripes: number } | null;
      stepType: "stripe" | "belt" | null;
    }[] = [];
    for (const row of withChecks) {
      const checkCount = memberCheckCounts[row.member.id] ?? 0;
      if (checkCount >= 2) {
        const override = nextRankOverrides[row.member.id] ?? null;
        rowsWithMeta.push({ row, checkCount, nextRank: override, stepType: null });
        continue;
      }
      const next = getNextRankForEventList(row.belt, row.stripes);
      if (next) {
        rowsWithMeta.push({
          row,
          checkCount,
          nextRank: { belt: next.belt, stripes: next.stripes },
          stepType: next.stepType,
        });
      } else {
        rowsWithMeta.push({ row, checkCount, nextRank: null, stepType: null });
      }
    }
    const groupTwoPlus = rowsWithMeta.filter((e) => e.checkCount >= 2);
    const groupStripe = rowsWithMeta
      .filter((e) => e.checkCount === 1 && e.stepType === "stripe")
      .sort((a, b) => {
        const ai = beltSortIndex(a.row.belt);
        const bi = beltSortIndex(b.row.belt);
        if (ai !== bi) return ai - bi;
        return (a.row.stripes ?? 0) - (b.row.stripes ?? 0);
      });
    const groupBelt = rowsWithMeta
      .filter((e) => e.checkCount === 1 && e.stepType === "belt")
      .sort((a, b) => {
        const ai = beltSortIndex(a.row.belt);
        const bi = beltSortIndex(b.row.belt);
        return ai - bi;
      });
    const out: DisplayItem[] = [];
    for (const e of groupTwoPlus)
      out.push({ type: "row", row: e.row, checkCount: e.checkCount, nextRank: e.nextRank });
    if (groupTwoPlus.length > 0) out.push({ type: "spacer" });
    for (const e of groupStripe)
      out.push({ type: "row", row: e.row, checkCount: e.checkCount, nextRank: e.nextRank });
    if (groupStripe.length > 0 && groupBelt.length > 0) out.push({ type: "spacer" });
    for (const e of groupBelt)
      out.push({ type: "row", row: e.row, checkCount: e.checkCount, nextRank: e.nextRank });
    return out;
  }, [rows, memberCheckCounts, nextRankOverrides]);

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
        {displayItems.filter((x) => x.type === "row").length > 0 &&
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
      {displayItems.filter((x) => x.type === "row").length === 0 ? (
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
