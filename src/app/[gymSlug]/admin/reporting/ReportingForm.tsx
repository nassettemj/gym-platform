"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect } from "react";

type Props = {
  gymSlug: string;
  initialStart?: string;
  /** Last graduation date YYYY-MM-DD, for the "Last grad" option. */
  lastGraduationDate?: string | null;
};

export function ReportingForm({
  gymSlug,
  initialStart,
  lastGraduationDate,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const startFromUrl = searchParams.get("start") ?? initialStart ?? "";
  const [startDate, setStartDate] = useState((startFromUrl || lastGraduationDate) ?? "");
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!popoverOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [popoverOpen]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (startDate) params.set("start", startDate);
    router.push(`/${gymSlug}/admin/reporting?${params.toString()}`);
  }

  function handleLastGrad() {
    if (lastGraduationDate) {
      setStartDate(lastGraduationDate);
      setPopoverOpen(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="report-start" className="text-xs font-medium text-white/80">
          Start date
        </label>
        <div className="relative inline-block" ref={popoverRef}>
          <input
            ref={inputRef}
            id="report-start"
            name="start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            onFocus={() => setPopoverOpen(true)}
            className="rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
            aria-describedby={popoverOpen && lastGraduationDate ? "report-last-grad" : undefined}
          />
          {popoverOpen && lastGraduationDate && (
            <div
              id="report-last-grad"
              className="absolute left-0 top-full z-20 mt-1 rounded-lg border border-white/20 bg-zinc-900 py-2 shadow-lg min-w-[10rem]"
            >
              <button
                type="button"
                onClick={handleLastGrad}
                className="w-full text-left px-3 py-1.5 text-[11px] text-orange-400 font-medium hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-orange-500 rounded"
              >
                Last grad
              </button>
            </div>
          )}
        </div>
      </div>
      <button
        type="submit"
        className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium hover:bg-orange-500"
      >
        Generate report
      </button>
    </form>
  );
}
