"use client";

import { useRef, useState, useEffect } from "react";
import { AttendanceByMemberTable, type MemberSummary, type ColumnId, ALL_COLUMNS } from "./AttendanceByMemberTable";

const DEFAULT_VISIBLE_COLUMNS: Set<ColumnId> = new Set([
  "member",
  "rank",
  "lastChange",
  "weeksOff",
  "longestStreakDaysOff",
  "classes",
]);

type Props = {
  children: React.ReactNode;
  memberSummaries: MemberSummary[];
  mainCategories: string[];
  subCategories: string[];
  columnLabel: string;
  onlyAttended?: boolean;
};

export function ReportTableSection({
  children,
  memberSummaries,
  mainCategories,
  subCategories,
  columnLabel,
  onlyAttended = false,
}: Props) {
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnId>>(DEFAULT_VISIBLE_COLUMNS);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!columnsDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) {
        setColumnsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [columnsDropdownOpen]);

  const toggleColumn = (id: ColumnId) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columnSelectorHeader = (
    <div ref={columnsRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setColumnsDropdownOpen((v) => !v)}
        className="text-left font-semibold underline decoration-dotted underline-offset-1 hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
        title="Add or remove columns"
        aria-label="Column selector"
      >
        +
      </button>
      {columnsDropdownOpen && (
        <div className="absolute right-0 top-full z-20 mt-1 rounded-lg border border-white/20 bg-zinc-900 py-2 shadow-lg max-h-[70vh] overflow-y-auto">
          <ul className="space-y-0.5 px-3">
            {ALL_COLUMNS.map(({ id, label }) => {
              const isDisplayed = visibleColumns.has(id);
              return (
                <li key={id} className="py-0.5">
                  <button
                    type="button"
                    onClick={() => toggleColumn(id)}
                    className={`w-full text-left text-[11px] hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded cursor-pointer ${
                      isDisplayed ? "text-orange-400 font-medium" : "text-white/80"
                    }`}
                    title={isDisplayed ? "Displayed in table (click to hide)" : "Hidden (click to show)"}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {children}
      {memberSummaries.length === 0 ? (
        <p className="text-sm text-white/60">
          No {onlyAttended ? "attended " : ""}check-ins in this period.
        </p>
      ) : (
        <AttendanceByMemberTable
          memberSummaries={memberSummaries}
          mainCategories={mainCategories}
          subCategories={subCategories}
          columnLabel={columnLabel}
          visibleColumns={visibleColumns}
          onToggleColumn={toggleColumn}
          columnSelectorHeader={columnSelectorHeader}
        />
      )}
    </div>
  );
}
