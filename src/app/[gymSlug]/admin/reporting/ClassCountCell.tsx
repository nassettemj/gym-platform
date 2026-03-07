"use client";

import { useRef, useState, useEffect } from "react";

export type CategoryBreakdown = { total: number; bySubcategory: Record<string, number> };

type Props = {
  count: number;
  byCategory: Record<string, CategoryBreakdown>;
};

function formatLabel(str: string): string {
  if (str === "Uncategorized") return str;
  return str.replace(/_/g, " ");
}

export function ClassCountCell({ count, byCategory }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedMain, setExpandedMain] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setExpandedMain(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const entries = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);
  const singleMain = entries.length === 1 ? entries[0] : null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (open) setExpandedMain(null);
        }}
        className="text-white/80 underline decoration-dotted underline-offset-1 hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
      >
        {count}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 min-w-[10rem] rounded-lg border border-white/20 bg-zinc-900 py-2 shadow-lg">
          {singleMain ? (
            <ul className="space-y-0.5 px-3">
                {Object.entries(singleMain[1].bySubcategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([subCat, n]) => (
                    <li
                      key={subCat}
                      className="flex justify-between gap-3 text-[11px] text-white/80 py-0.5"
                    >
                      <span>{formatLabel(subCat)}</span>
                      <span className="tabular-nums text-white/60">{n}</span>
                    </li>
                  ))}
            </ul>
          ) : (
            <ul className="space-y-0.5">
                {entries.map(([mainCat, data]) => {
                  const subEntries = Object.entries(data.bySubcategory).sort((a, b) => b[1] - a[1]);
                  const showSub = expandedMain === mainCat;
                  return (
                    <li key={mainCat} className="px-3">
                      <div className="flex items-center justify-between gap-4 py-0.5 text-xs text-white/90">
                        <span>{formatLabel(mainCat)}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedMain((prev) => (prev === mainCat ? null : mainCat));
                          }}
                          className="text-white/70 tabular-nums underline decoration-dotted underline-offset-1 hover:text-white focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
                        >
                          {data.total}
                        </button>
                      </div>
                      {showSub && subEntries.length > 0 && (
                        <ul className="ml-3 mt-0.5 mb-1 border-l border-white/10 pl-2 space-y-0.5">
                          {subEntries.map(([subCat, n]) => (
                            <li
                              key={subCat}
                              className="flex justify-between gap-3 text-[11px] text-white/80 py-0.5"
                            >
                              <span>{formatLabel(subCat)}</span>
                              <span className="tabular-nums text-white/60">{n}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
