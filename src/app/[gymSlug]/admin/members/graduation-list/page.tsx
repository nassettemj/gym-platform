"use client";

import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import {
  GRADUATION_LIST_SNAPSHOT_KEY,
  type GraduationListSnapshot,
  type ColumnId,
} from "../../reporting/AttendanceByMemberTable";
import { ReportTableSection } from "../../reporting/ReportTableSection";

type SavedSnapshot = GraduationListSnapshot & {
  memberCheckCounts?: Record<string, 0 | 1 | 2>;
  nextRankOverrides?: Record<string, { belt: string; stripes: number }>;
  selectedMemberIds?: string[];
};

function parseSnapshot(raw: string | null): GraduationListSnapshot | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed = JSON.parse(raw) as GraduationListSnapshot;
    if (
      !Array.isArray(parsed.data) ||
      !Array.isArray(parsed.visibleColumns) ||
      !Array.isArray(parsed.mainCategories) ||
      !Array.isArray(parsed.subCategories) ||
      typeof parsed.columnLabel !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export default function GraduationListPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const classId = searchParams.get("classId");
  const gymSlug = typeof params.gymSlug === "string" ? params.gymSlug : "";
  const [snapshot, setSnapshot] = useState<SavedSnapshot | null | "pending">("pending");

  useEffect(() => {
    if (classId) {
      setSnapshot("pending");
      fetch(`/api/classes/${encodeURIComponent(classId)}/graduation-list`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { snapshot?: SavedSnapshot } | null) => {
          const snap = data?.snapshot;
          if (snap && Array.isArray(snap.data) && Array.isArray(snap.visibleColumns)) {
            setSnapshot(snap as SavedSnapshot);
          } else {
            setSnapshot(null);
          }
        })
        .catch(() => setSnapshot(null));
      return;
    }
    const raw = sessionStorage.getItem(GRADUATION_LIST_SNAPSHOT_KEY);
    setSnapshot(parseSnapshot(raw) as SavedSnapshot | null);
  }, [classId]);

  const initialVisibleColumns = useMemo(() => {
    if (snapshot === null || snapshot === "pending") return undefined;
    return new Set(snapshot.visibleColumns as ColumnId[]);
  }, [snapshot]);

  const initialColumnOrder = useMemo(() => {
    if (snapshot === null || snapshot === "pending") return undefined;
    return (snapshot.columnOrder ?? snapshot.visibleColumns) as ColumnId[];
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
            No candidates list data. Go to Members and click Generate candidates list.
          </p>
          {gymSlug && (
            <Link
              href={`/${gymSlug}/admin/members`}
              className="text-sm text-orange-400 hover:text-orange-300 underline"
            >
              Back to Members
            </Link>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="border border-white/10 rounded-xl p-4 space-y-3">
        <ReportTableSection
          gymSlug={gymSlug}
          showGenerateCandidatesButton={false}
          showCreateEventListButton
          memberSummaries={snapshot.data}
          mainCategories={snapshot.mainCategories}
          subCategories={snapshot.subCategories}
          columnLabel={snapshot.columnLabel}
          initialVisibleColumns={initialVisibleColumns}
          initialColumnOrder={initialColumnOrder}
          initialMemberCheckCounts={"memberCheckCounts" in snapshot ? snapshot.memberCheckCounts : undefined}
          initialNextRankOverrides={"nextRankOverrides" in snapshot ? snapshot.nextRankOverrides : undefined}
          initialGraduationSelectedMemberIds={"selectedMemberIds" in snapshot ? snapshot.selectedMemberIds : undefined}
        />
      </section>
    </div>
  );
}
