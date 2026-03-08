"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import {
  EVENT_LIST_SNAPSHOT_KEY,
  type EventListSnapshot,
  type MemberSummary,
  getNextRankForEventList,
  BELT_ORDER_FOR_SORT,
} from "../../reporting/AttendanceByMemberTable";
import { BeltRankIcon } from "../../reporting/BeltRankIcon";

function parseSnapshot(raw: string | null): EventListSnapshot | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed = JSON.parse(raw) as EventListSnapshot;
    if (!Array.isArray(parsed.rows) || typeof parsed.memberCheckCounts !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

type EventRow = {
  row: MemberSummary;
  checkCount: number;
  /** Next rank for icon (1 check only). Null for 2+ checks or no next. */
  nextRank: { belt: string; stripes: number } | null;
  stepType: "stripe" | "belt" | null;
};

function beltSortIndex(belt: string | null | undefined): number {
  if (belt == null || belt === "") return 0; // Unranked → treat as White for sort
  const i = BELT_ORDER_FOR_SORT.indexOf(belt as (typeof BELT_ORDER_FOR_SORT)[number]);
  return i < 0 ? 999 : i;
}

export default function EventListPage() {
  const params = useParams();
  const gymSlug = typeof params.gymSlug === "string" ? params.gymSlug : "";
  const [snapshot, setSnapshot] = useState<EventListSnapshot | null | "pending">("pending");

  useEffect(() => {
    const raw = sessionStorage.getItem(EVENT_LIST_SNAPSHOT_KEY);
    setSnapshot(parseSnapshot(raw));
  }, []);

  const { groupTwoPlus, groupStripe, groupBelt } = useMemo(() => {
    if (snapshot === null || snapshot === "pending") {
      return { groupTwoPlus: [], groupStripe: [], groupBelt: [] };
    }
    const { rows, memberCheckCounts } = snapshot;
    const withChecks: EventRow[] = [];
    for (const row of rows) {
      const checkCount = memberCheckCounts[row.member.id] ?? 0;
      if (checkCount < 1) continue;
      if (checkCount >= 2) {
        withChecks.push({ row, checkCount, nextRank: null, stepType: null });
        continue;
      }
      const next = getNextRankForEventList(row.belt, row.stripes);
      if (next) {
        withChecks.push({
          row,
          checkCount: 1,
          nextRank: { belt: next.belt, stripes: next.stripes },
          stepType: next.stepType,
        });
      } else {
        withChecks.push({ row, checkCount: 1, nextRank: null, stepType: null });
      }
    }
    const groupTwoPlus = withChecks.filter((e) => e.checkCount >= 2);
    const groupStripe = withChecks
      .filter((e) => e.checkCount === 1 && e.stepType === "stripe")
      .sort((a, b) => {
        const ai = beltSortIndex(a.row.belt);
        const bi = beltSortIndex(b.row.belt);
        if (ai !== bi) return ai - bi;
        return (a.row.stripes ?? 0) - (b.row.stripes ?? 0);
      });
    const groupBelt = withChecks
      .filter((e) => e.checkCount === 1 && e.stepType === "belt")
      .sort((a, b) => {
        const ai = beltSortIndex(a.row.belt);
        const bi = beltSortIndex(b.row.belt);
        return ai - bi;
      });
    return { groupTwoPlus, groupStripe, groupBelt };
  }, [snapshot]);

  if (snapshot === "pending") {
    return (
      <div className="space-y-6">
        <section className="border border-white/10 rounded-xl p-4">
          <p className="text-sm text-white/60">Loading…</p>
        </section>
      </div>
    );
  }

  if (snapshot === null) {
    return (
      <div className="space-y-6">
        <section className="border border-white/10 rounded-xl p-4 space-y-4">
          <p className="text-sm text-white/60">
            No event list data. Go to the candidates list, set checks on members, then click Create event list.
          </p>
          {gymSlug && (
            <Link
              href={`/${gymSlug}/admin/members/graduation-list`}
              className="text-sm text-orange-400 hover:text-orange-300 underline"
            >
              Back to candidates list
            </Link>
          )}
        </section>
      </div>
    );
  }

  function renderRow(entry: EventRow) {
    const { row, checkCount, nextRank } = entry;
    const name =
      [row.member.firstName, row.member.lastName].filter(Boolean).join(" ") || row.member.email || "—";
    const checks = checkCount === 1 ? " ✓" : checkCount === 2 ? " ✓✓" : "";
    return (
      <tr key={row.member.id} className="border-b border-white/5">
        <td className="px-3 py-2 text-white/90">
          {name}
          {checks && <span className="text-orange-400">{checks}</span>}
        </td>
        <td className="px-3 py-2">
          <BeltRankIcon belt={row.belt ?? null} stripes={row.stripes ?? null} />
        </td>
        <td className="px-3 py-2">
          {nextRank ? (
            <BeltRankIcon belt={nextRank.belt} stripes={nextRank.stripes} />
          ) : (
            <span className="text-white/60 text-xs">—</span>
          )}
        </td>
      </tr>
    );
  }

  const spacer = (
    <tr key="spacer" aria-hidden="true">
      <td colSpan={3} className="py-2 bg-white/5" />
    </tr>
  );

  return (
    <div className="space-y-6">
      <section className="border border-white/10 rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          {gymSlug && (
            <Link
              href={`/${gymSlug}/admin/members/graduation-list`}
              className="text-sm text-orange-400 hover:text-orange-300 underline"
            >
              Back to candidates list
            </Link>
          )}
        </div>
        <div className="overflow-x-auto border border-white/10 rounded-lg">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-3 py-2 text-left font-semibold">Member</th>
                <th className="px-3 py-2 text-left font-semibold">Rank</th>
                <th className="px-3 py-2 text-left font-semibold">Next rank</th>
              </tr>
            </thead>
            <tbody>
              {groupTwoPlus.length > 0 && (
                <>
                  {groupTwoPlus.map(renderRow)}
                  {spacer}
                </>
              )}
              {groupStripe.map(renderRow)}
              {groupStripe.length > 0 && groupBelt.length > 0 && spacer}
              {groupBelt.map(renderRow)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
