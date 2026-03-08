"use client";

import { useRef, useState, useEffect } from "react";
import { AttendanceByMemberTable, type MemberSummary, type ColumnId, ALL_COLUMNS } from "./AttendanceByMemberTable";

const DEFAULT_VISIBLE_COLUMNS: Set<ColumnId> = new Set([
  "member",
  "rank",
  "memberSince",
  "lastChange",
  "weeksOff",
  "longestStreakDaysOff",
  "classes",
]);

const DEFAULT_COLUMN_ORDER: ColumnId[] = [
  "member",
  "rank",
  "memberSince",
  "lastChange",
  "weeksOff",
  "longestStreakDaysOff",
  "classes",
];

/** Column ids to show in the + menu. When omitted, all columns (including Next rank) are available. */
export const MEMBERS_PAGE_COLUMNS: ColumnId[] = ALL_COLUMNS.map((c) => c.id).filter(
  (id) => id !== "nextRank"
);

type Props = {
  children?: React.ReactNode;
  gymSlug?: string;
  memberSummaries: MemberSummary[];
  mainCategories: string[];
  subCategories: string[];
  columnLabel: string;
  onlyAttended?: boolean;
  /** When provided (e.g. graduation list), initializes visible columns and order from snapshot. */
  initialVisibleColumns?: Set<ColumnId>;
  initialColumnOrder?: ColumnId[];
  /** When provided (e.g. members page), only these columns appear in the + menu. Omit to allow all columns including Next rank. */
  availableColumns?: ColumnId[];
  /** When false, hide "Generate candidates list" button (e.g. on graduation list page). Default true when gymSlug is set. */
  showGenerateCandidatesButton?: boolean;
  /** When true, show "Create event list" button (e.g. on candidates/graduation list page). */
  showCreateEventListButton?: boolean;
  /** When true, row click goes to member profile (e.g. on /admin/members page). */
  rowClickNavigatesToProfile?: boolean;
  /** When loading a saved graduation list by class, pass through to table. */
  initialMemberCheckCounts?: Record<string, 0 | 1 | 2>;
  initialNextRankOverrides?: Record<string, { belt: string; stripes: number }>;
  initialGraduationSelectedMemberIds?: string[];
};

export function ReportTableSection({
  children,
  gymSlug,
  memberSummaries,
  mainCategories,
  subCategories,
  columnLabel,
  onlyAttended = false,
  initialVisibleColumns,
  initialColumnOrder,
  availableColumns,
  showGenerateCandidatesButton = true,
  showCreateEventListButton = false,
  rowClickNavigatesToProfile = false,
  initialMemberCheckCounts,
  initialNextRankOverrides,
  initialGraduationSelectedMemberIds,
}: Props) {
  const columnsForMenu = availableColumns
    ? ALL_COLUMNS.filter((c) => availableColumns.includes(c.id))
    : ALL_COLUMNS;
  const [columnsDropdownOpen, setColumnsDropdownOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnId>>(
    initialVisibleColumns ?? DEFAULT_VISIBLE_COLUMNS
  );
  const [columnOrder, setColumnOrder] = useState<ColumnId[]>(
    initialColumnOrder ?? DEFAULT_COLUMN_ORDER
  );
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
      if (next.has(id)) {
        next.delete(id);
        setColumnOrder((order) => order.filter((x) => x !== id));
      } else {
        next.add(id);
        setColumnOrder((order) =>
          order.includes(id) ? order : [...order, id]
        );
      }
      return next;
    });
  };

  const handleColumnReorder = (fromIndex: number, toIndex: number) => {
    setColumnOrder((prev) => {
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
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
            {columnsForMenu.map(({ id, label }) => {
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
          gymSlug={gymSlug}
          showGenerateCandidatesButton={showGenerateCandidatesButton}
          showCreateEventListButton={showCreateEventListButton}
          rowClickNavigatesToProfile={rowClickNavigatesToProfile}
          memberSummaries={memberSummaries}
          mainCategories={mainCategories}
          subCategories={subCategories}
          columnLabel={columnLabel}
          visibleColumns={visibleColumns}
          columnOrder={columnOrder}
          onToggleColumn={toggleColumn}
          onColumnReorder={handleColumnReorder}
          columnSelectorHeader={columnSelectorHeader}
          initialMemberCheckCounts={initialMemberCheckCounts}
          initialNextRankOverrides={initialNextRankOverrides}
          initialGraduationSelectedMemberIds={initialGraduationSelectedMemberIds}
        />
      )}
    </div>
  );
}
