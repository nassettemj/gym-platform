"use client";

const BELT_COLORS: Record<string, string> = {
  WHITE: "#e5e7eb",
  BLUE: "#3b82f6",
  PURPLE: "#7c3aed",
  BROWN: "#92400e",
  BLACK: "#1f2937",
};

const BELT_LABELS: Record<string, string> = {
  WHITE: "White",
  BLUE: "Blue",
  PURPLE: "Purple",
  BROWN: "Brown",
  BLACK: "Black",
};

type Props = {
  belt: string | null;
  stripes: number | null;
  /** Optional size in px for the belt bar width (default 28) */
  size?: number;
};

function formatLabel(belt: string, stripes: number | null): string {
  const name = BELT_LABELS[belt] ?? belt.replace(/_/g, " ");
  const s = stripes ?? 0;
  return s === 0 ? `${name} belt` : `${name} belt, ${s} stripe${s === 1 ? "" : "s"}`;
}

export function BeltRankIcon({ belt, stripes, size = 28 }: Props) {
  if (belt == null) {
    return (
      <span className="text-white/60 text-xs" title="Unranked">
        Unranked
      </span>
    );
  }

  const color = BELT_COLORS[belt] ?? "#6b7280";
  const stripeCount = stripes != null ? Math.min(4, Math.max(0, stripes)) : 0;
  const label = formatLabel(belt, stripes);

  return (
    <span
      className="inline-flex items-center gap-1"
      title={label}
      aria-label={label}
    >
      <span
        className="inline-flex items-center rounded-sm border border-white/20 shrink-0"
        style={{
          width: size,
          height: Math.max(10, Math.round(size / 3)),
          backgroundColor: color,
        }}
      >
        {stripeCount > 0 && (
          <span className="flex gap-0.5 px-0.5 items-center h-full">
            {Array.from({ length: stripeCount }, (_, i) => (
              <span
                key={i}
                className="w-0.5 rounded-full bg-black/40 flex-1 min-h-[4px]"
                aria-hidden
              />
            ))}
          </span>
        )}
      </span>
    </span>
  );
}
