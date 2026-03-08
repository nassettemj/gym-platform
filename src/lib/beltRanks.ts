import type { BeltRank } from "@prisma/client";

/** Canonical belt order (white → black) for sorting and "next rank" logic. */
export const BELT_ORDER = ["WHITE", "BLUE", "PURPLE", "BROWN", "BLACK"] as const;

export type BeltOrderKey = (typeof BELT_ORDER)[number];

/** Array of all belt ranks for Prisma (BeltRank enum). */
export const BELT_RANKS: BeltRank[] = [...BELT_ORDER];

export const BELT_LABELS_FOR_NEXT: Record<string, string> = {
  WHITE: "White",
  BLUE: "Blue",
  PURPLE: "Purple",
  BROWN: "Brown",
  BLACK: "Black",
};

export function beltSortIndex(belt: string | null | undefined): number {
  if (belt == null || belt === "") return 0;
  const i = BELT_ORDER.indexOf(belt as BeltOrderKey);
  return i < 0 ? 999 : i;
}

export function getNextRankLabel(belt: string | null | undefined): string {
  if (belt == null || belt === "") return "White";
  const i = BELT_ORDER.indexOf(belt as BeltOrderKey);
  if (i < 0) return "—";
  if (i === BELT_ORDER.length - 1) return "—";
  return BELT_LABELS_FOR_NEXT[BELT_ORDER[i + 1]] ?? "—";
}

/**
 * For event list: 1 check → +1 stripe (max 4) or next belt if at 4 stripes.
 * Returns belt/stripes for icon and stepType for ordering.
 */
export function getNextRankForEventList(
  belt: string | null | undefined,
  stripes: number | null | undefined,
): { belt: string; stripes: number; stepType: "stripe" | "belt" } | null {
  const b = belt == null || belt === "" ? "WHITE" : belt;
  const s = stripes ?? 0;
  const idx = BELT_ORDER.indexOf(b as BeltOrderKey);
  if (idx < 0) return null;
  if (idx === BELT_ORDER.length - 1 && s >= 4) return null;
  if (s < 4) {
    return { belt: b, stripes: s + 1, stepType: "stripe" };
  }
  if (idx >= BELT_ORDER.length - 1) return null;
  const nextBelt = BELT_ORDER[idx + 1];
  return { belt: nextBelt, stripes: 0, stepType: "belt" };
}

/** Alias for compatibility with existing imports. */
export const BELT_ORDER_FOR_SORT = BELT_ORDER;
