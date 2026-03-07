"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  gymSlug: string;
  initialRange?: string;
  initialStart?: string;
  initialAttended?: string;
};

export function ReportingForm({
  gymSlug,
  initialRange,
  initialStart,
  initialAttended,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const range = (form.elements.namedItem("range") as RadioNodeList | null)?.value;
    const start = (form.elements.namedItem("start") as HTMLInputElement | null)?.value;
    const attended = (form.elements.namedItem("attended") as RadioNodeList | null)?.value;
    const params = new URLSearchParams();
    if (range) params.set("range", range);
    if (range === "custom" && start) params.set("start", start);
    if (attended && attended !== "all") params.set("attended", attended);
    router.push(`/${gymSlug}/admin/reporting?${params.toString()}`);
  }

  const range = searchParams.get("range") ?? initialRange ?? "";
  const start = searchParams.get("start") ?? initialStart ?? "";
  const attended = searchParams.get("attended") ?? initialAttended ?? "all";

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-white/80">Date range</span>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="range"
              value="last_graduation"
              defaultChecked={range === "last_graduation"}
              className="rounded border-white/20"
            />
            Last graduation
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="range"
              value="custom"
              defaultChecked={range === "custom"}
              className="rounded border-white/20"
            />
            Custom start date
          </label>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="report-start" className="text-xs font-medium text-white/80">
          Start date
        </label>
        <input
          id="report-start"
          name="start"
          type="date"
          defaultValue={start}
          disabled={range === "last_graduation"}
          className="rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-white/80">Count</span>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="attended"
              value="all"
              defaultChecked={attended === "all"}
              className="rounded border-white/20"
            />
            All check-ins
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="attended"
              value="yes"
              defaultChecked={attended === "yes"}
              className="rounded border-white/20"
            />
            Attended only
          </label>
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
