"use client";

import { Fragment, useMemo, useState } from "react";

export type ClassHistoryRow = {
  id: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  locationName: string | null;
  instructorName: string | null;
  mainCategory: string | null;
  subCategory: string | null;
  age: string | null;
  discipline: string | null;
  topic: string | null;
  capacity: number | null;
  signedUpAt: string;
  status: "Signed up" | "Present" | "Absent";
};

const STATUS_OPTIONS: Array<ClassHistoryRow["status"]> = [
  "Signed up",
  "Present",
  "Absent",
];

function formatDate(isoDate: string): string {
  if (!isoDate) return "—";
  try {
    const d = new Date(isoDate + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoDate;
  }
}

function formatCategory(value: string | null): string {
  if (!value) return "—";
  return value.replace(/_/g, " ");
}

type Props = {
  rows: ClassHistoryRow[];
};

export function MemberClassHistoryTable({ rows }: Props) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [mainCategoryFilter, setMainCategoryFilter] = useState<string>("ALL");
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>("ALL");
  const [ageFilter, setAgeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [locationFilter, setLocationFilter] = useState<string>("ALL");
  const [instructorFilter, setInstructorFilter] = useState<string>("ALL");

  const mainCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.mainCategory) set.add(r.mainCategory);
    }
    return Array.from(set).sort();
  }, [rows]);
  const subCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.subCategory) set.add(r.subCategory);
    }
    return Array.from(set).sort();
  }, [rows]);
  const ageOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.age) set.add(r.age);
    }
    return Array.from(set).sort();
  }, [rows]);
  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.locationName) set.add(r.locationName);
    }
    return Array.from(set).sort();
  }, [rows]);
  const instructorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.instructorName) set.add(r.instructorName);
    }
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (mainCategoryFilter !== "ALL" && r.mainCategory !== mainCategoryFilter)
        return false;
      if (subCategoryFilter !== "ALL" && r.subCategory !== subCategoryFilter)
        return false;
      if (ageFilter !== "ALL" && r.age !== ageFilter) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (locationFilter !== "ALL" && r.locationName !== locationFilter)
        return false;
      if (instructorFilter !== "ALL" && r.instructorName !== instructorFilter)
        return false;
      return true;
    });
  }, [
    rows,
    mainCategoryFilter,
    subCategoryFilter,
    ageFilter,
    statusFilter,
    locationFilter,
    instructorFilter,
  ]);

  if (rows.length === 0) {
    return (
      <p className="text-xs text-white/60">No classes signed up yet.</p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto border border-white/10 rounded-xl">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-2 py-1.5 text-left align-bottom font-semibold whitespace-nowrap">
                Date
              </th>
              <th className="px-2 py-1.5 text-left align-bottom font-semibold whitespace-nowrap">
                Start
              </th>
              <th className="px-2 py-1.5 text-left align-bottom">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold">Status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2 py-1 rounded bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs max-w-[90px]"
                  >
                    <option value="ALL">All</option>
                    {STATUS_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </th>
              <th className="px-2 py-1.5 text-left align-bottom">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold">Main cat.</span>
                  <select
                    value={mainCategoryFilter}
                    onChange={(e) => setMainCategoryFilter(e.target.value)}
                    className="px-2 py-1 rounded bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs max-w-[100px]"
                  >
                    <option value="ALL">All</option>
                    {mainCategoryOptions.map((v) => (
                      <option key={v} value={v}>
                        {formatCategory(v)}
                      </option>
                    ))}
                  </select>
                </div>
              </th>
              <th className="px-2 py-1.5 text-left align-bottom">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold">Sub cat.</span>
                  <select
                    value={subCategoryFilter}
                    onChange={(e) => setSubCategoryFilter(e.target.value)}
                    className="px-2 py-1 rounded bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs max-w-[100px]"
                  >
                    <option value="ALL">All</option>
                    {subCategoryOptions.map((v) => (
                      <option key={v} value={v}>
                        {formatCategory(v)}
                      </option>
                    ))}
                  </select>
                </div>
              </th>
              <th className="px-2 py-1.5 text-left align-bottom">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold">Instructor</span>
                  <select
                    value={instructorFilter}
                    onChange={(e) => setInstructorFilter(e.target.value)}
                    className="px-2 py-1 rounded bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs max-w-[120px]"
                  >
                    <option value="ALL">All</option>
                    {instructorOptions.map((v) => (
                      <option key={v} value={v}>
                        {v.length > 18 ? v.slice(0, 17) + "…" : v}
                      </option>
                    ))}
                  </select>
                </div>
              </th>
              <th className="px-2 py-1.5 text-left align-bottom">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold">Age</span>
                  <select
                    value={ageFilter}
                    onChange={(e) => setAgeFilter(e.target.value)}
                    className="px-2 py-1 rounded bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs max-w-[90px]"
                  >
                    <option value="ALL">All</option>
                    {ageOptions.map((v) => (
                      <option key={v} value={v}>
                        {formatCategory(v)}
                      </option>
                    ))}
                  </select>
                </div>
              </th>
              <th className="px-2 py-1.5 text-left align-bottom">
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold">Location</span>
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="px-2 py-1 rounded bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs max-w-[120px]"
                  >
                    <option value="ALL">All</option>
                    {locationOptions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-3 text-white/60 text-center"
                >
                  No classes match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <Fragment key={r.id}>
                  <tr
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td
                      className="px-2 py-1.5 text-white/80 whitespace-nowrap cursor-pointer hover:text-orange-400"
                      onClick={() =>
                        setExpandedRowId((id) => (id === r.id ? null : r.id))
                      }
                    >
                      {formatDate(r.date)}
                    </td>
                    <td className="px-2 py-1.5 text-white/80 whitespace-nowrap">
                      {r.startTime || "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={
                          r.status === "Present"
                            ? "text-green-500"
                            : r.status === "Absent"
                              ? "text-red-500"
                              : "text-white/80"
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-white/80">
                      {formatCategory(r.mainCategory)}
                    </td>
                    <td className="px-2 py-1.5 text-white/80">
                      {formatCategory(r.subCategory)}
                    </td>
                    <td className="px-2 py-1.5 text-white/80">
                      {r.instructorName ?? "—"}
                    </td>
                    <td className="px-2 py-1.5 text-white/80">
                      {formatCategory(r.age)}
                    </td>
                    <td className="px-2 py-1.5 text-white/80">
                      {r.locationName ?? "—"}
                    </td>
                  </tr>
                  {expandedRowId === r.id && (
                    <tr key={`${r.id}-panel`}>
                      <td
                        colSpan={8}
                        className="px-3 py-3 bg-white/5 border-b border-white/10"
                        onClick={() => setExpandedRowId(null)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) =>
                          e.key === "Enter" && setExpandedRowId(null)
                        }
                      >
                        <div className="text-xs space-y-1.5 cursor-pointer">
                          <div>
                            <span className="text-white/60">Class: </span>
                            {r.className || "—"}
                          </div>
                          <div>
                            <span className="text-white/60">Date: </span>
                            {formatDate(r.date)}
                          </div>
                          <div>
                            <span className="text-white/60">Time: </span>
                            {r.startTime || "—"}
                            {r.endTime ? ` – ${r.endTime}` : ""}
                          </div>
                          <div>
                            <span className="text-white/60">Status: </span>
                            {r.status}
                          </div>
                          <div>
                            <span className="text-white/60">Location: </span>
                            {r.locationName ?? "—"}
                          </div>
                          <div>
                            <span className="text-white/60">Instructor: </span>
                            {r.instructorName ?? "—"}
                          </div>
                          <div>
                            <span className="text-white/60">Main category: </span>
                            {formatCategory(r.mainCategory)}
                          </div>
                          <div>
                            <span className="text-white/60">Sub category: </span>
                            {formatCategory(r.subCategory)}
                          </div>
                          <div>
                            <span className="text-white/60">Age: </span>
                            {formatCategory(r.age)}
                          </div>
                          {r.discipline != null && r.discipline !== "" && (
                            <div>
                              <span className="text-white/60">Discipline: </span>
                              {formatCategory(r.discipline)}
                            </div>
                          )}
                          {r.topic != null && r.topic !== "" && (
                            <div>
                              <span className="text-white/60">Topic: </span>
                              {formatCategory(r.topic)}
                            </div>
                          )}
                          {r.signedUpAt && (
                            <div>
                              <span className="text-white/60">Signed up at: </span>
                              {formatDate(r.signedUpAt)}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
