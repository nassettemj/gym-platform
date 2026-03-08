"use client";

import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ClassCountCell, type CategoryBreakdown } from "./ClassCountCell";
import { BeltRankIcon } from "./BeltRankIcon";

export const GRADUATION_LIST_SNAPSHOT_KEY = "graduationListSnapshot";
export const EVENT_LIST_SNAPSHOT_KEY = "eventListSnapshot";

export type EventListSnapshot = {
  rows: MemberSummary[];
  memberCheckCounts: Record<string, 0 | 1 | 2>;
};

export type GraduationListSnapshot = {
  data: MemberSummary[];
  visibleColumns: ColumnId[];
  columnOrder?: ColumnId[];
  mainCategories: string[];
  subCategories: string[];
  columnLabel: string;
};

function serializeRowForSnapshot(row: MemberSummary): MemberSummary {
  const lastBeltChange =
    row.lastBeltChange != null
      ? {
          ...row.lastBeltChange,
          changedAt:
            row.lastBeltChange.changedAt instanceof Date
              ? row.lastBeltChange.changedAt.toISOString()
              : row.lastBeltChange.changedAt,
        }
      : null;
  const memberSince =
    row.memberSince instanceof Date ? row.memberSince.toISOString() : row.memberSince;
  return { ...row, lastBeltChange: lastBeltChange ?? undefined, memberSince };
}

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
  /** Member account creation date (join gym date). */
  memberSince?: Date | string | null;
};

export type OptionalColumnId = "memberType" | "subscriptionStatus" | "userRole";

export type ColumnId =
  | "member"
  | "rank"
  | "nextRank"
  | "memberSince"
  | "lastChange"
  | "memberType"
  | "subscriptionStatus"
  | "userRole"
  | "weeksOff"
  | "longestStreakDaysOff"
  | "classes";

import {
  getNextRankLabel,
  getNextRankForEventList,
  BELT_ORDER_FOR_SORT,
  BELT_LABELS_FOR_NEXT,
} from "@/lib/beltRanks";
import { buildEventListDisplayRows } from "@/lib/graduationListOrder";

export { getNextRankForEventList, BELT_ORDER_FOR_SORT };

export const ALL_COLUMNS: { id: ColumnId; label: string }[] = [
  { id: "member", label: "Member" },
  { id: "rank", label: "Rank" },
  { id: "nextRank", label: "Next rank" },
  { id: "memberSince", label: "Member since" },
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

const BELT_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "Unranked", label: "Unranked" },
  { value: "WHITE", label: "White" },
  { value: "BLUE", label: "Blue" },
  { value: "PURPLE", label: "Purple" },
  { value: "BROWN", label: "Brown" },
  { value: "BLACK", label: "Black" },
];

type Props = {
  memberSummaries: MemberSummary[];
  mainCategories: string[];
  subCategories: string[];
  columnLabel: string;
  visibleColumns: Set<ColumnId>;
  /** Order of visible columns (used for display and drag reorder). If omitted, uses ALL_COLUMNS order. */
  columnOrder?: ColumnId[];
  onToggleColumn: (id: ColumnId) => void;
  /** Called when user drags a column from fromIndex to toIndex. */
  onColumnReorder?: (fromIndex: number, toIndex: number) => void;
  /** Rendered in the last header cell (e.g. column selector "+"). */
  columnSelectorHeader?: React.ReactNode;
  /** When set, show "Generate candidates list" button above the table (e.g. members page; hidden on graduation list). */
  gymSlug?: string;
  /** When true, show "Generate candidates list" button. Set false on graduation list page. */
  showGenerateCandidatesButton?: boolean;
  /** When true, show "Create event list" button (graduation/candidates list page). */
  showCreateEventListButton?: boolean;
  /** When true, hide search input and Classes filter dropdown (plain headers). */
  readOnly?: boolean;
  /** When true, row click navigates to member profile instead of cycling check counts. Use on /admin/members page. */
  rowClickNavigatesToProfile?: boolean;
  /** Initial check counts when loading a saved graduation list (event list state). */
  initialMemberCheckCounts?: Record<string, 0 | 1 | 2>;
  /** Initial next rank overrides when loading a saved graduation list. */
  initialNextRankOverrides?: Record<string, { belt: string; stripes: number }>;
  /** Initial selected member ids (checkboxes) when loading a saved graduation list. */
  initialGraduationSelectedMemberIds?: string[];
};

/** Count check-ins for a member where (main in selectedMains OR sub in selectedSubs); each check-in counted once */
function countMatching(
  summary: MemberSummary,
  selectedMains: Set<string>,
  selectedSubs: Set<string>
): { count: number; byCategory: Record<string, CategoryBreakdown>; belt?: string | null; stripes?: number | null; lastBeltChange?: LastBeltChange | null; memberType?: string | null; subscriptionStatus?: string | null; userRole?: string | null; weeksOff?: number; longestStreakDaysOff?: number; memberSince?: Date | string | null } {
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
      memberSince: summary.memberSince,
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
    memberSince: summary.memberSince,
  };
}

export function AttendanceByMemberTable({
  memberSummaries,
  mainCategories,
  subCategories,
  columnLabel,
  visibleColumns,
  columnOrder: columnOrderProp,
  onToggleColumn,
  onColumnReorder,
  columnSelectorHeader,
  gymSlug,
  showGenerateCandidatesButton = true,
  showCreateEventListButton = false,
  readOnly = false,
  rowClickNavigatesToProfile = false,
  initialMemberCheckCounts,
  initialNextRankOverrides,
  initialGraduationSelectedMemberIds,
}: Props) {
  const orderedColumns = useMemo(() => {
    if (columnOrderProp && columnOrderProp.length > 0) {
      const filtered = columnOrderProp.filter((id) => visibleColumns.has(id));
      return filtered;
    }
    return ALL_COLUMNS.map((c) => c.id).filter((id) => visibleColumns.has(id));
  }, [visibleColumns, columnOrderProp]);
  const router = useRouter();
  const [selectedMains, setSelectedMains] = useState<Set<string>>(new Set());
  const [selectedSubs, setSelectedSubs] = useState<Set<string>>(new Set());
  const [minAttendanceThreshold, setMinAttendanceThreshold] = useState<number>(0);
  const [selectedBelts, setSelectedBelts] = useState<Set<string>>(new Set());
  const [selectedMemberTypes, setSelectedMemberTypes] = useState<Set<string>>(new Set());
  const [selectedSubscriptionStatuses, setSelectedSubscriptionStatuses] = useState<Set<string>>(new Set());
  const [selectedUserRoles, setSelectedUserRoles] = useState<Set<string>>(new Set());
  const [headerDropdownOpen, setHeaderDropdownOpen] = useState(false);
  const [rankDropdownOpen, setRankDropdownOpen] = useState(false);
  const [memberTypeDropdownOpen, setMemberTypeDropdownOpen] = useState(false);
  const [subscriptionDropdownOpen, setSubscriptionDropdownOpen] = useState(false);
  const [userRoleDropdownOpen, setUserRoleDropdownOpen] = useState(false);
  const [openLastChangeMemberId, setOpenLastChangeMemberId] = useState<string | null>(null);
  const [openNextRankMemberId, setOpenNextRankMemberId] = useState<string | null>(null);
  const [nameSearch, setNameSearch] = useState("");
  const [memberCheckCounts, setMemberCheckCounts] = useState<Record<string, 0 | 1 | 2>>(
    () => initialMemberCheckCounts ?? {}
  );
  const hasSavedEventListState =
    (initialMemberCheckCounts && Object.keys(initialMemberCheckCounts).length > 0) ||
    (initialGraduationSelectedMemberIds && initialGraduationSelectedMemberIds.length > 0);
  const [eventListMode, setEventListMode] = useState(!!hasSavedEventListState);
  const [graduationSelectedMemberIds, setGraduationSelectedMemberIds] = useState<Set<string>>(
    () => new Set(initialGraduationSelectedMemberIds ?? [])
  );
  const [nextRankOverrides, setNextRankOverrides] = useState<Record<string, { belt: string; stripes: number }>>(
    () => initialNextRankOverrides ?? {}
  );
  const [showGraduationPanel, setShowGraduationPanel] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const rankHeaderRef = useRef<HTMLDivElement>(null);
  const memberTypeHeaderRef = useRef<HTMLDivElement>(null);
  const subscriptionHeaderRef = useRef<HTMLDivElement>(null);
  const userRoleHeaderRef = useRef<HTMLDivElement>(null);
  const lastChangePopoverRef = useRef<HTMLDivElement>(null);
  const nextRankPopoverRef = useRef<HTMLDivElement>(null);
  const portalPanelRef = useRef<HTMLDivElement>(null);

  type FilterDropdownKey = "classes" | "rank" | "memberType" | "subscription" | "userRole";
  const [filterPortal, setFilterPortal] = useState<{
    key: FilterDropdownKey;
    rect: { bottom: number; left: number };
  } | null>(null);

  function handleGenerateGraduationList() {
    if (!gymSlug) return;
    const snapshot: GraduationListSnapshot = {
      data: filtered.map(serializeRowForSnapshot),
      visibleColumns: Array.from(visibleColumns),
      columnOrder: orderedColumns,
      mainCategories,
      subCategories,
      columnLabel,
    };
    sessionStorage.setItem(GRADUATION_LIST_SNAPSHOT_KEY, JSON.stringify(snapshot));
    router.push(`/${gymSlug}/admin/members/graduation-list`);
  }

  function handleCreateEventList() {
    setEventListMode(true);
  }
  function handleShowAllMembers() {
    setEventListMode(false);
  }

  async function handleAssociateWithClass(classId: string): Promise<void> {
    if (!gymSlug) return;
    const snapshot = {
      data: memberSummaries.map(serializeRowForSnapshot),
      visibleColumns: Array.from(visibleColumns),
      columnOrder: orderedColumns,
      mainCategories,
      subCategories,
      columnLabel,
      memberCheckCounts: { ...memberCheckCounts },
      nextRankOverrides: { ...nextRankOverrides },
      selectedMemberIds: Array.from(graduationSelectedMemberIds),
    };
    const res = await fetch(`/api/gyms/${encodeURIComponent(gymSlug)}/graduation-lists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, snapshot }),
    });
    if (!res.ok) return;
    setShowGraduationPanel(false);
  }

  function handleRowClick(memberId: string, e: React.MouseEvent<HTMLTableRowElement>) {
    const target = e.target as HTMLElement;
    if (target.closest("button, [role=\"button\"], a, input, select")) return;
    if (rowClickNavigatesToProfile && gymSlug) {
      router.push(`/${gymSlug}/admin/members/${memberId}`);
      return;
    }
    setMemberCheckCounts((prev) => {
      const current = prev[memberId] ?? 0;
      const next: 0 | 1 | 2 = current === 0 ? 1 : current === 1 ? 2 : 0;
      return { ...prev, [memberId]: next };
    });
  }

  const toggleSet = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    value: string
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const filterTriggerRefs: Record<FilterDropdownKey, React.RefObject<HTMLDivElement | null>> = {
    classes: headerRef,
    rank: rankHeaderRef,
    memberType: memberTypeHeaderRef,
    subscription: subscriptionHeaderRef,
    userRole: userRoleHeaderRef,
  };

  useEffect(() => {
    const open =
      headerDropdownOpen || rankDropdownOpen || memberTypeDropdownOpen ||
      subscriptionDropdownOpen || userRoleDropdownOpen;
    if (!open) {
      setFilterPortal(null);
      return;
    }
    const key: FilterDropdownKey = headerDropdownOpen
      ? "classes"
      : rankDropdownOpen
        ? "rank"
        : memberTypeDropdownOpen
          ? "memberType"
          : subscriptionDropdownOpen
            ? "subscription"
            : "userRole";
    const ref = filterTriggerRefs[key];
    const rect = ref?.current?.getBoundingClientRect();
    if (rect) setFilterPortal({ key, rect: { bottom: rect.bottom, left: rect.left } });
  }, [headerDropdownOpen, rankDropdownOpen, memberTypeDropdownOpen, subscriptionDropdownOpen, userRoleDropdownOpen]);

  useEffect(() => {
    if (!filterPortal) return;
    const ref = filterTriggerRefs[filterPortal.key];
    const update = () => {
      const rect = ref?.current?.getBoundingClientRect();
      if (rect) setFilterPortal((p) => (p ? { ...p, rect: { bottom: rect.bottom, left: rect.left } } : null));
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [filterPortal?.key]);

  const closeFilterIfOutside = useCallback((key: FilterDropdownKey, e: MouseEvent) => {
    const target = e.target as Node;
    const triggerRef = filterTriggerRefs[key];
    if (triggerRef?.current?.contains(target)) return;
    if (portalPanelRef.current?.contains(target)) return;
    if (key === "classes") setHeaderDropdownOpen(false);
    else if (key === "rank") setRankDropdownOpen(false);
    else if (key === "memberType") setMemberTypeDropdownOpen(false);
    else if (key === "subscription") setSubscriptionDropdownOpen(false);
    else setUserRoleDropdownOpen(false);
  }, []);

  useEffect(() => {
    if (!headerDropdownOpen) return;
    const handler = (e: MouseEvent) => closeFilterIfOutside("classes", e);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [headerDropdownOpen, closeFilterIfOutside]);

  useEffect(() => {
    if (!rankDropdownOpen) return;
    const handler = (e: MouseEvent) => closeFilterIfOutside("rank", e);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [rankDropdownOpen, closeFilterIfOutside]);

  useEffect(() => {
    if (!memberTypeDropdownOpen) return;
    const handler = (e: MouseEvent) => closeFilterIfOutside("memberType", e);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [memberTypeDropdownOpen, closeFilterIfOutside]);

  useEffect(() => {
    if (!subscriptionDropdownOpen) return;
    const handler = (e: MouseEvent) => closeFilterIfOutside("subscription", e);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [subscriptionDropdownOpen, closeFilterIfOutside]);

  useEffect(() => {
    if (!userRoleDropdownOpen) return;
    const handler = (e: MouseEvent) => closeFilterIfOutside("userRole", e);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userRoleDropdownOpen, closeFilterIfOutside]);

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

  useEffect(() => {
    if (!openNextRankMemberId) return;
    function handleClickOutside(e: MouseEvent) {
      if (nextRankPopoverRef.current && !nextRankPopoverRef.current.contains(e.target as Node)) {
        setOpenNextRankMemberId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openNextRankMemberId]);

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
        const { count, byCategory, belt, stripes, lastBeltChange, memberType, subscriptionStatus, userRole, weeksOff, longestStreakDaysOff, memberSince } = countMatching(
          s,
          selectedMains,
          selectedSubs
        );
        return { member: s.member, count, byCategory, belt, stripes, lastBeltChange, memberType, subscriptionStatus, userRole, weeksOff, longestStreakDaysOff, memberSince };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  })();

  const thresholdFiltered = categoryFiltered.filter((r) => r.count >= minAttendanceThreshold);

  const beltFiltered =
    selectedBelts.size === 0
      ? thresholdFiltered
      : thresholdFiltered.filter((row) => {
          const beltKey = row.belt == null || row.belt === "" ? "Unranked" : row.belt;
          return selectedBelts.has(beltKey);
        });

  const memberTypeFiltered =
    selectedMemberTypes.size === 0
      ? beltFiltered
      : beltFiltered.filter(
          (row) => row.memberType != null && selectedMemberTypes.has(row.memberType)
        );

  const subscriptionFiltered =
    selectedSubscriptionStatuses.size === 0
      ? memberTypeFiltered
      : memberTypeFiltered.filter(
          (row) =>
            row.subscriptionStatus != null &&
            selectedSubscriptionStatuses.has(row.subscriptionStatus)
        );

  const roleFiltered =
    selectedUserRoles.size === 0
      ? subscriptionFiltered
      : subscriptionFiltered.filter(
          (row) => row.userRole != null && selectedUserRoles.has(row.userRole)
        );

  const searchLower = nameSearch.trim().toLowerCase();
  const filtered =
    searchLower === ""
      ? roleFiltered
      : roleFiltered.filter((row) => {
          const name =
            [row.member.firstName, row.member.lastName].filter(Boolean).join(" ") ||
            row.member.email ||
            "";
          return name.toLowerCase().includes(searchLower) || (row.member.email ?? "").toLowerCase().includes(searchLower);
        });

  type EventListDisplayItem =
    | { type: "spacer" }
    | {
        type: "row";
        row: (typeof filtered)[number];
        checkCount: number;
        nextRank: { belt: string; stripes: number } | null;
      };

  const eventListDisplayRows = useMemo(
    () =>
      buildEventListDisplayRows(
        filtered,
        memberCheckCounts,
        nextRankOverrides ?? undefined,
      ) as EventListDisplayItem[],
    [filtered, memberCheckCounts, nextRankOverrides],
  );

  const displayColumns = useMemo(() => {
    if (!eventListMode) return orderedColumns;
    return ["member", "rank", "nextRank"] as ColumnId[];
  }, [eventListMode, orderedColumns]);

  const displayRows: EventListDisplayItem[] = eventListMode
    ? eventListDisplayRows
    : filtered.map((row) => ({
        type: "row" as const,
        row,
        checkCount: memberCheckCounts[row.member.id] ?? 0,
        nextRank: null,
      }));

  const filterLabel = hasFilter
    ? [
        ...Array.from(selectedMains).map(formatCategoryLabel),
        ...Array.from(selectedSubs).map(formatCategoryLabel),
      ].join(", ")
    : null;

  const minAttendanceLabel =
    minAttendanceThreshold > 0 ? `min ${minAttendanceThreshold}` : null;

  const memberTypeOptions = useMemo(() => {
    const set = new Set<string>();
    memberSummaries.forEach((s) => {
      if (s.memberType != null && s.memberType !== "") set.add(s.memberType);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [memberSummaries]);

  const subscriptionStatusOptions = useMemo(() => {
    const set = new Set<string>();
    memberSummaries.forEach((s) => {
      if (s.subscriptionStatus != null && s.subscriptionStatus !== "")
        set.add(s.subscriptionStatus);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [memberSummaries]);

  const userRoleOptions = useMemo(() => {
    const set = new Set<string>();
    memberSummaries.forEach((s) => {
      if (s.userRole != null && s.userRole !== "") set.add(s.userRole);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [memberSummaries]);

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

  const rankFilterLabel =
    selectedBelts.size > 0
      ? Array.from(selectedBelts)
          .map((b) => BELT_FILTER_OPTIONS.find((o) => o.value === b)?.label ?? b)
          .join(", ")
      : null;
  const memberTypeFilterLabel =
    selectedMemberTypes.size > 0
      ? Array.from(selectedMemberTypes)
          .map((v) => (v === "ADULT" ? "Adult" : v === "CHILD" ? "Child" : v))
          .join(", ")
      : null;
  const subscriptionFilterLabel =
    selectedSubscriptionStatuses.size > 0
      ? Array.from(selectedSubscriptionStatuses)
          .map((v) => v.replace(/_/g, " "))
          .join(", ")
      : null;
  const userRoleFilterLabel =
    selectedUserRoles.size > 0
      ? Array.from(selectedUserRoles)
          .map((v) => USER_ROLE_LABELS[v] ?? v.replace(/_/g, " "))
          .join(", ")
      : null;

  const filterDropdownPanelClass =
    "absolute left-0 top-full z-20 mt-1 rounded-lg border border-white/20 bg-zinc-900 py-2 shadow-lg overflow-y-auto min-w-[8rem] max-h-[70vh]";

  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);

  function renderHeaderContent(columnId: ColumnId): React.ReactNode {
    switch (columnId) {
      case "member":
        return readOnly ? (
          "Member"
        ) : (
          <input
            type="search"
            placeholder="Search name..."
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className="w-full min-w-[8rem] max-w-[12rem] rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white placeholder:text-white/50 focus:outline-none focus:ring-1 focus:ring-orange-500"
            aria-label="Search by member name"
          />
        );
      case "rank":
        return readOnly ? (
          "Rank"
        ) : (
          <div ref={rankHeaderRef} className="relative inline-block">
            <button
              type="button"
              onClick={() => setRankDropdownOpen((v) => !v)}
              className="text-left font-semibold underline decoration-dotted underline-offset-1 hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
            >
              Rank
              {rankFilterLabel !== null && (
                <span className="text-white/60 font-normal"> ({rankFilterLabel})</span>
              )}
            </button>
          </div>
        );
      case "nextRank":
        return "Next rank";
      case "memberSince":
        return "Member since";
      case "lastChange":
        return "Last change";
      case "memberType":
        return readOnly ? (
          "Member type"
        ) : (
          <div ref={memberTypeHeaderRef} className="relative inline-block">
            <button
              type="button"
              onClick={() => setMemberTypeDropdownOpen((v) => !v)}
              className="text-left font-semibold underline decoration-dotted underline-offset-1 hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
            >
              Member type
              {memberTypeFilterLabel !== null && (
                <span className="text-white/60 font-normal"> ({memberTypeFilterLabel})</span>
              )}
            </button>
          </div>
        );
      case "subscriptionStatus":
        return readOnly ? (
          "Subscription status"
        ) : (
          <div ref={subscriptionHeaderRef} className="relative inline-block">
            <button
              type="button"
              onClick={() => setSubscriptionDropdownOpen((v) => !v)}
              className="text-left font-semibold underline decoration-dotted underline-offset-1 hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
            >
              Subscription status
              {subscriptionFilterLabel !== null && (
                <span className="text-white/60 font-normal"> ({subscriptionFilterLabel})</span>
              )}
            </button>
          </div>
        );
      case "userRole":
        return readOnly ? (
          "User role"
        ) : (
          <div ref={userRoleHeaderRef} className="relative inline-block">
            <button
              type="button"
              onClick={() => setUserRoleDropdownOpen((v) => !v)}
              className="text-left font-semibold underline decoration-dotted underline-offset-1 hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
            >
              User role
              {userRoleFilterLabel !== null && (
                <span className="text-white/60 font-normal"> ({userRoleFilterLabel})</span>
              )}
            </button>
          </div>
        );
      case "weeksOff":
        return "Weeks off";
      case "longestStreakDaysOff":
        return "Longest streak (days off)";
      case "classes":
        return readOnly ? (
          columnLabel
        ) : (
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
              {minAttendanceLabel !== null && (
                <span className="text-white/60 font-normal">
                  {" "}({minAttendanceLabel})
                </span>
              )}
            </button>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <>
      {(gymSlug != null && showGenerateCandidatesButton) || (showCreateEventListButton && gymSlug != null) ? (
        <div className={`mb-3 flex ${eventListMode ? "flex-row items-start gap-4" : "flex-wrap gap-2"}`}>
          <div className="flex flex-wrap gap-2 shrink-0">
            {gymSlug != null && showGenerateCandidatesButton && (
              <button
                type="button"
                onClick={handleGenerateGraduationList}
                className="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
              >
                Generate candidates list
              </button>
            )}
            {showCreateEventListButton && gymSlug != null && (
              eventListMode ? (
                <>
                  <button
                    type="button"
                    onClick={handleShowAllMembers}
                    className="rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white border border-white/20 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                  >
                    Show all members
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGraduationPanel(true)}
                    className="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                  >
                    Save graduation
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateEventList}
                  className="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                >
                  Create event list
                </button>
              )
            )}
          </div>
          {eventListMode && showGraduationPanel && gymSlug && (
            <UpcomingGraduationsPanel
              gymSlug={gymSlug}
              onClose={() => setShowGraduationPanel(false)}
              onSelectEvent={handleAssociateWithClass}
            />
          )}
        </div>
      ) : null}
      <div className="overflow-x-auto border border-white/10 rounded-lg">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              {displayColumns.map((columnId, index) => (
                <th
                  key={columnId}
                  className={`px-3 py-2 text-left font-semibold ${draggedColumnIndex === index ? "opacity-50" : ""}`}
                  draggable={!!onColumnReorder && !readOnly && !eventListMode}
                  onDragStart={(e) => {
                    if (!onColumnReorder) return;
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(index));
                    setDraggedColumnIndex(index);
                  }}
                  onDragEnd={() => setDraggedColumnIndex(null)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.types.includes("text/plain")) e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDraggedColumnIndex(null);
                    if (!onColumnReorder) return;
                    const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                    if (Number.isNaN(fromIndex) || fromIndex === index) return;
                    onColumnReorder(fromIndex, index);
                  }}
                >
                  {renderHeaderContent(columnId)}
                </th>
              ))}
              {columnSelectorHeader != null && !eventListMode && (
                <th className="px-2 py-2 text-right w-0">{columnSelectorHeader}</th>
              )}
              {eventListMode && (
                <th className="px-3 py-2 text-left font-semibold">Checkboxes</th>
              )}
            </tr>
          </thead>
        <tbody>
          {displayRows.map((item, rowIndex) => {
            if (item.type === "spacer") {
              return (
                <tr key={`spacer-${rowIndex}`} aria-hidden="true">
                  <td
                    colSpan={
                      displayColumns.length +
                      (columnSelectorHeader != null && !eventListMode ? 1 : 0) +
                      (eventListMode ? 1 : 0)
                    }
                    className="py-2 bg-white/5"
                  />
                </tr>
              );
            }
            const { row, checkCount, nextRank } = item;
            const { member, count, byCategory, belt, stripes, lastBeltChange, memberType, subscriptionStatus, userRole, weeksOff, longestStreakDaysOff, memberSince } = row;
            const memberName =
              [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email || "—";
            const hasRank = belt != null || stripes != null;
            const showRankIcon = hasRank;
            const lastChangeDateStr =
              lastBeltChange != null
                ? new Date(lastBeltChange.changedAt).toLocaleDateString()
                : null;
            const isLastChangePopoverOpen = openLastChangeMemberId === member.id;
            const checks = checkCount === 1 ? " ✓" : checkCount === 2 ? " ✓✓" : "";

            function renderCell(columnId: ColumnId): React.ReactNode {
              const baseTdClass = "px-3 py-2 text-white/80";
              switch (columnId) {
                case "member":
                  return (
                    <td className="px-3 py-2 text-white/90" key="member">
                      {memberName}
                      {checks && <span className="text-orange-400">{checks}</span>}
                    </td>
                  );
                case "rank":
                  return (
                    <td className={baseTdClass} key="rank">
                      {showRankIcon ? (
                        <BeltRankIcon belt={belt ?? null} stripes={stripes ?? null} />
                      ) : (
                        <span className="text-white/60 text-xs">Unranked</span>
                      )}
                    </td>
                  );
                case "nextRank":
                  return (
                    <td
                      className={baseTdClass}
                      key="nextRank"
                      onClick={(e) => eventListMode && checkCount >= 2 && e.stopPropagation()}
                    >
                      {eventListMode ? (
                        (() => {
                          const override = checkCount >= 2 ? nextRankOverrides[member.id] ?? null : null;
                          const effectiveNextRank = checkCount >= 2 ? override : nextRank;
                          const isNextRankPopoverOpen = openNextRankMemberId === member.id;
                          const showNextRankMenu = checkCount >= 2;
                          return (
                            <div
                              ref={isNextRankPopoverOpen ? nextRankPopoverRef : undefined}
                              className="relative inline-block"
                            >
                              {showNextRankMenu ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenNextRankMemberId((id) => (id === member.id ? null : member.id))
                                  }
                                  className="text-left hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded inline-flex items-center min-h-[1.5rem]"
                                  aria-label={effectiveNextRank ? "Change next rank" : "Select next rank"}
                                >
                                  {effectiveNextRank ? (
                                    <BeltRankIcon belt={effectiveNextRank.belt} stripes={effectiveNextRank.stripes} />
                                  ) : (
                                    <span className="text-white/60 text-xs">—</span>
                                  )}
                                </button>
                              ) : (
                                effectiveNextRank ? (
                                  <BeltRankIcon belt={effectiveNextRank.belt} stripes={effectiveNextRank.stripes} />
                                ) : (
                                  <span className="text-white/60 text-xs">—</span>
                                )
                              )}
                              {isNextRankPopoverOpen && showNextRankMenu && (
                                <div className="absolute left-0 top-full z-10 mt-1 rounded-lg border border-white/20 bg-zinc-900 px-3 py-2 shadow-lg flex flex-col gap-2 min-w-[140px]">
                                  <div className="text-[10px] font-medium text-white/60 uppercase tracking-wide">
                                    Next rank
                                  </div>
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-[10px] text-white/70">Belt</span>
                                    <select
                                      value={nextRankOverrides[member.id]?.belt ?? "WHITE"}
                                      onChange={(e) => {
                                        const belt = e.target.value as string;
                                        setNextRankOverrides((prev) => ({
                                          ...prev,
                                          [member.id]: {
                                            belt,
                                            stripes: prev[member.id]?.stripes ?? 0,
                                          },
                                        }));
                                      }}
                                      className="rounded border border-white/20 bg-black/40 px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    >
                                      {BELT_ORDER_FOR_SORT.map((b) => (
                                        <option key={b} value={b}>
                                          {BELT_LABELS_FOR_NEXT[b]}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="flex flex-col gap-0.5">
                                    <span className="text-[10px] text-white/70">Stripes</span>
                                    <select
                                      value={nextRankOverrides[member.id]?.stripes ?? 0}
                                      onChange={(e) => {
                                        const stripes = parseInt(e.target.value, 10);
                                        setNextRankOverrides((prev) => ({
                                          ...prev,
                                          [member.id]: {
                                            belt: prev[member.id]?.belt ?? "WHITE",
                                            stripes,
                                          },
                                        }));
                                      }}
                                      className="rounded border border-white/20 bg-black/40 px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
                                    >
                                      {[0, 1, 2, 3, 4].map((n) => (
                                        <option key={n} value={n}>
                                          {n}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        getNextRankLabel(belt)
                      )}
                    </td>
                  );
                case "memberSince":
                  return (
                    <td className={`${baseTdClass} text-xs`} key="memberSince">
                      {memberSince != null ? new Date(memberSince).toLocaleDateString() : "—"}
                    </td>
                  );
                case "lastChange":
                  return (
                    <td className={baseTdClass} key="lastChange">
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
                  );
                case "memberType":
                  return (
                    <td className={`${baseTdClass} text-xs`} key="memberType">
                      {formatOptionalValue(memberType ?? null, "memberType")}
                    </td>
                  );
                case "subscriptionStatus":
                  return (
                    <td className={`${baseTdClass} text-xs`} key="subscriptionStatus">
                      {formatOptionalValue(subscriptionStatus ?? null, "subscriptionStatus")}
                    </td>
                  );
                case "userRole":
                  return (
                    <td className={`${baseTdClass} text-xs`} key="userRole">
                      {formatOptionalValue(userRole ?? null, "userRole")}
                    </td>
                  );
                case "weeksOff":
                  return (
                    <td className={`${baseTdClass} tabular-nums`} key="weeksOff">
                      {weeksOff ?? 0}
                    </td>
                  );
                case "longestStreakDaysOff":
                  return (
                    <td className={`${baseTdClass} tabular-nums`} key="longestStreakDaysOff">
                      {longestStreakDaysOff ?? 0}
                    </td>
                  );
                case "classes":
                  return (
                    <td className={baseTdClass} key="classes">
                      <ClassCountCell count={count} byCategory={byCategory} />
                    </td>
                  );
                default:
                  return null;
              }
            }

            return (
              <tr
                key={member.id}
                className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                onClick={(e) => handleRowClick(member.id, e)}
                aria-label={rowClickNavigatesToProfile ? `Member row, go to profile` : checkCount === 0 ? "Member row, no checks" : checkCount === 1 ? "Member row, 1 check" : "Member row, 2 checks"}
              >
                {displayColumns.map((columnId) => renderCell(columnId))}
                {columnSelectorHeader != null && !eventListMode && <td className="w-0" />}
                {eventListMode && (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={graduationSelectedMemberIds.has(member.id)}
                        onChange={() => {
                          setGraduationSelectedMemberIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(member.id)) next.delete(member.id);
                            else next.add(member.id);
                            return next;
                          });
                        }}
                        className="rounded border-white/30 bg-white/10 text-orange-500 focus:ring-orange-500"
                        aria-label={`Select ${memberName} for graduation`}
                      />
                    </label>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    {typeof document !== "undefined" &&
      filterPortal &&
      createPortal(
        <div
          ref={portalPanelRef}
          className={filterDropdownPanelClass}
          style={{
            position: "fixed",
            top: filterPortal.rect.bottom + 4,
            left: filterPortal.rect.left,
            zIndex: 50,
          }}
        >
          {filterPortal.key === "classes" && (
            <>
              <div className="px-3 pb-2 border-b border-white/10 mb-2 flex items-center gap-2">
                <label htmlFor="min-attendance-portal" className="text-[11px] text-white/80 whitespace-nowrap">
                  Min attendance
                </label>
                <input
                  id="min-attendance-portal"
                  type="number"
                  min={0}
                  value={minAttendanceThreshold === 0 ? "" : minAttendanceThreshold}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setMinAttendanceThreshold(0);
                      return;
                    }
                    const n = parseInt(raw, 10);
                    if (Number.isNaN(n) || n < 0) {
                      setMinAttendanceThreshold(0);
                      return;
                    }
                    setMinAttendanceThreshold(n);
                  }}
                  className="w-16 rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  aria-label="Minimum attendance (0 = no minimum)"
                />
              </div>
              <div className="flex">
                <ul className="min-w-[8rem] border-r border-white/10 pr-1 space-y-0.5 px-3">
                  {mainCategories.map((main) => {
                    const selected = selectedMains.has(main);
                    return (
                      <li key={main} className="py-0.5">
                        <button
                          type="button"
                          onClick={() => toggleMain(main)}
                          className={`w-full text-left text-[11px] hover:text-white focus:outline-none rounded cursor-pointer ${
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
                          className={`w-full text-left text-[11px] hover:text-white focus:outline-none rounded cursor-pointer ${
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
            </>
          )}
          {filterPortal.key === "rank" && (
            <ul className="space-y-0.5 px-3">
              {BELT_FILTER_OPTIONS.map(({ value, label }) => {
                const selected = selectedBelts.has(value);
                return (
                  <li key={value} className="py-0.5">
                    <button
                      type="button"
                      onClick={() => toggleSet(setSelectedBelts, value)}
                      className={`w-full text-left text-[11px] hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded cursor-pointer ${
                        selected ? "text-orange-400 font-medium" : "text-white/80"
                      }`}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {filterPortal.key === "memberType" && (
            <ul className="space-y-0.5 px-3">
              {memberTypeOptions.map((value) => {
                const selected = selectedMemberTypes.has(value);
                const label = value === "ADULT" ? "Adult" : value === "CHILD" ? "Child" : value;
                return (
                  <li key={value} className="py-0.5">
                    <button
                      type="button"
                      onClick={() => toggleSet(setSelectedMemberTypes, value)}
                      className={`w-full text-left text-[11px] hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded cursor-pointer ${
                        selected ? "text-orange-400 font-medium" : "text-white/80"
                      }`}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {filterPortal.key === "subscription" && (
            <ul className="space-y-0.5 px-3">
              {subscriptionStatusOptions.map((value) => {
                const selected = selectedSubscriptionStatuses.has(value);
                const label = value.replace(/_/g, " ");
                return (
                  <li key={value} className="py-0.5">
                    <button
                      type="button"
                      onClick={() => toggleSet(setSelectedSubscriptionStatuses, value)}
                      className={`w-full text-left text-[11px] hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded cursor-pointer ${
                        selected ? "text-orange-400 font-medium" : "text-white/80"
                      }`}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {filterPortal.key === "userRole" && (
            <ul className="space-y-0.5 px-3">
              {userRoleOptions.map((value) => {
                const selected = selectedUserRoles.has(value);
                const label = USER_ROLE_LABELS[value] ?? value.replace(/_/g, " ");
                return (
                  <li key={value} className="py-0.5">
                    <button
                      type="button"
                      onClick={() => toggleSet(setSelectedUserRoles, value)}
                      className={`w-full text-left text-[11px] hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded cursor-pointer ${
                        selected ? "text-orange-400 font-medium" : "text-white/80"
                      }`}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

type UpcomingGraduationItem = {
  id: string;
  name: string | null;
  startAt: string;
  locationName?: string | null;
};

function UpcomingGraduationsPanel({
  gymSlug,
  onClose,
  onSelectEvent,
}: {
  gymSlug: string;
  onClose: () => void;
  onSelectEvent: (classId: string) => void | Promise<void>;
}) {
  const [items, setItems] = useState<UpcomingGraduationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/gyms/${encodeURIComponent(gymSlug)}/upcoming-graduations`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((data: { items: UpcomingGraduationItem[] }) => {
        if (!cancelled) setItems(data.items ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gymSlug]);

  return (
    <section className="border border-white/10 rounded-xl p-4 space-y-3 min-w-[280px] max-w-[360px] shrink-0">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">Upcoming graduation events</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-white/60 hover:text-white text-xs underline focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
        >
          Close
        </button>
      </div>
      {loading && <p className="text-sm text-white/60">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-white/60">No upcoming graduation events.</p>
      )}
      {!loading && !error && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  setSavingId(item.id);
                  Promise.resolve(onSelectEvent(item.id)).finally(() => setSavingId(null));
                }}
                disabled={savingId !== null}
                className="w-full text-left flex flex-wrap items-baseline gap-2 text-sm text-white/90 hover:text-white hover:bg-white/10 rounded px-2 py-1.5 -mx-2 -my-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
              >
                <span className="font-medium">{item.name ?? "Graduation"}</span>
                <span className="text-white/60 text-xs">
                  {new Date(item.startAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                {item.locationName && (
                  <span className="text-white/50 text-xs">{item.locationName}</span>
                )}
                {savingId === item.id && (
                  <span className="text-[10px] text-white/50 ml-1">Saving…</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
