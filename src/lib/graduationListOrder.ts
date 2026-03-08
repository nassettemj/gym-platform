import { getNextRankForEventList, beltSortIndex } from "./beltRanks";

export type EventListDisplayItem<T> =
  | { type: "spacer" }
  | { type: "row"; row: T; checkCount: number; nextRank: { belt: string; stripes: number } | null };

/** Minimal row shape required for ordering (member id, belt, stripes). */
export type EventListRowLike = {
  member: { id: string };
  belt?: string | null;
  stripes?: number | null;
};

/**
 * Build ordered display list for event/graduation list: 2+ checks first, then spacer,
 * then 1-check stripe (sorted by belt then stripes), then spacer, then 1-check belt (sorted by belt).
 */
export function buildEventListDisplayRows<T extends EventListRowLike>(
  rows: T[],
  memberCheckCounts: Record<string, 0 | 1 | 2>,
  nextRankOverrides?: Record<string, { belt: string; stripes: number }>,
): EventListDisplayItem<T>[] {
  const withChecks = rows.filter((row) => (memberCheckCounts[row.member.id] ?? 0) >= 1);
  const rowsWithMeta: {
    row: T;
    checkCount: number;
    nextRank: { belt: string; stripes: number } | null;
    stepType: "stripe" | "belt" | null;
  }[] = [];

  for (const row of withChecks) {
    const checkCount = memberCheckCounts[row.member.id] ?? 0;
    if (checkCount >= 2) {
      const override = nextRankOverrides?.[row.member.id] ?? null;
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

  const out: EventListDisplayItem<T>[] = [];
  for (const e of groupTwoPlus)
    out.push({ type: "row", row: e.row, checkCount: e.checkCount, nextRank: e.nextRank });
  if (groupTwoPlus.length > 0) out.push({ type: "spacer" });
  for (const e of groupStripe)
    out.push({ type: "row", row: e.row, checkCount: e.checkCount, nextRank: e.nextRank });
  if (groupStripe.length > 0 && groupBelt.length > 0) out.push({ type: "spacer" });
  for (const e of groupBelt)
    out.push({ type: "row", row: e.row, checkCount: e.checkCount, nextRank: e.nextRank });
  return out;
}

export type EventListGroupItem<T> = {
  row: T;
  checkCount: number;
  nextRank: { belt: string; stripes: number } | null;
};

/**
 * Build the three groups (2+ checks, 1-check stripe, 1-check belt) for rendering in separate sections.
 */
export function buildEventListGroups<T extends EventListRowLike>(
  rows: T[],
  memberCheckCounts: Record<string, 0 | 1 | 2>,
  nextRankOverrides?: Record<string, { belt: string; stripes: number }>,
): {
  groupTwoPlus: EventListGroupItem<T>[];
  groupStripe: EventListGroupItem<T>[];
  groupBelt: EventListGroupItem<T>[];
} {
  const withChecks = rows.filter((row) => (memberCheckCounts[row.member.id] ?? 0) >= 1);
  const rowsWithMeta: {
    row: T;
    checkCount: number;
    nextRank: { belt: string; stripes: number } | null;
    stepType: "stripe" | "belt" | null;
  }[] = [];

  for (const row of withChecks) {
    const checkCount = memberCheckCounts[row.member.id] ?? 0;
    if (checkCount >= 2) {
      const override = nextRankOverrides?.[row.member.id] ?? null;
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

  const groupTwoPlus = rowsWithMeta
    .filter((e) => e.checkCount >= 2)
    .map((e) => ({ row: e.row, checkCount: e.checkCount, nextRank: e.nextRank }));
  const groupStripe = rowsWithMeta
    .filter((e) => e.checkCount === 1 && e.stepType === "stripe")
    .sort((a, b) => {
      const ai = beltSortIndex(a.row.belt);
      const bi = beltSortIndex(b.row.belt);
      if (ai !== bi) return ai - bi;
      return (a.row.stripes ?? 0) - (b.row.stripes ?? 0);
    })
    .map((e) => ({ row: e.row, checkCount: e.checkCount, nextRank: e.nextRank }));
  const groupBelt = rowsWithMeta
    .filter((e) => e.checkCount === 1 && e.stepType === "belt")
    .sort((a, b) => {
      const ai = beltSortIndex(a.row.belt);
      const bi = beltSortIndex(b.row.belt);
      return ai - bi;
    })
    .map((e) => ({ row: e.row, checkCount: e.checkCount, nextRank: e.nextRank }));

  return { groupTwoPlus, groupStripe, groupBelt };
}
