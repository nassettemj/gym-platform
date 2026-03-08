"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import {
  EVENT_LIST_SNAPSHOT_KEY,
  type EventListSnapshot,
  type MemberSummary,
} from "../../reporting/AttendanceByMemberTable";
import { BeltRankIcon } from "../../reporting/BeltRankIcon";
import { buildEventListGroups } from "@/lib/graduationListOrder";

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
  nextRank: { belt: string; stripes: number } | null;
};

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
      return { groupTwoPlus: [] as EventRow[], groupStripe: [] as EventRow[], groupBelt: [] as EventRow[] };
    }
    return buildEventListGroups(
      snapshot.rows,
      snapshot.memberCheckCounts,
    );
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
