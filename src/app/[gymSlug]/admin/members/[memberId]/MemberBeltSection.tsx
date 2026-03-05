"use client";

import { useState } from "react";
import type { BeltRank } from "@prisma/client";

type BeltStripeLog = {
  id: string;
  changedAt: string | Date;
  previousBelt: BeltRank | null;
  newBelt: BeltRank | null;
  previousStripes: number | null;
  newStripes: number | null;
  changedByUser: { name: string | null } | null;
};

type Props = {
  belt: BeltRank | null;
  stripes: number | null;
  logs: BeltStripeLog[];
  gymSlug: string;
  memberId: string;
  updateAction: (formData: FormData) => void;
  beltError?: string | null;
};

const BELT_OPTIONS: readonly BeltRank[] = [
  "WHITE",
  "BLUE",
  "PURPLE",
  "BROWN",
  "BLACK",
];

const STRIPE_OPTIONS = [0, 1, 2, 3, 4] as const;

export function MemberBeltSection({
  belt,
  stripes,
  logs,
  gymSlug,
  memberId,
  updateAction,
  beltError,
}: Props) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <section className="border border-white/10 rounded-xl p-4 space-y-3">
      <button
        type="button"
        onClick={() => setShowHistory((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <h2 className="text-sm font-medium text-white/80">Belt & stripes</h2>
        <span className="text-[11px] text-white/60">
          {showHistory ? "Hide history" : "Show history"}
        </span>
      </button>

      {beltError && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {beltError}
        </p>
      )}

      <form action={updateAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="gymSlug" value={gymSlug} />
        <input type="hidden" name="memberId" value={memberId} />
        <div className="flex flex-col gap-1">
          <label htmlFor="belt" className="text-xs font-medium text-white/80">
            Belt
          </label>
          <select
            id="belt"
            name="belt"
            className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
            defaultValue={belt ?? ""}
          >
            <option value="">—</option>
            {BELT_OPTIONS.map((b) => (
              <option key={b} value={b}>
                {b.charAt(0) + b.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="stripes"
            className="text-xs font-medium text-white/80"
          >
            Stripes
          </label>
          <select
            id="stripes"
            name="stripes"
            className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
            defaultValue={stripes != null ? String(stripes) : ""}
          >
            <option value="">—</option>
            {STRIPE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center px-3 py-2 rounded-md bg-orange-600 text-[11px] font-medium hover:bg-orange-500"
        >
          Update
        </button>
      </form>

      {showHistory && (
        <section className="space-y-3">
          <h3 className="text-xs font-medium text-white/70">
            Belt & stripes history
          </h3>
          {logs.length === 0 ? (
            <p className="text-xs text-white/60">
              No belt or stripe changes recorded.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {logs.map((log) => {
                const when = new Date(log.changedAt).toLocaleString();
                const by = log.changedByUser?.name ?? "—";

                const beltChanged = log.previousBelt !== log.newBelt;
                const stripesChanged =
                  log.previousStripes !== log.newStripes;

                const beltPart = beltChanged
                  ? `Belt: ${log.previousBelt ?? "—"} → ${log.newBelt ?? "—"}`
                  : null;
                const stripePart = stripesChanged
                  ? `Stripes: ${
                      log.previousStripes ?? "—"
                    } → ${log.newStripes ?? "—"}`
                  : null;

                const summary = [beltPart, stripePart]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <li
                    key={log.id}
                    className="border border-white/10 rounded-md px-3 py-2 bg-black/40"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="text-white/90">{when}</span>
                      <span className="text-white/60">by {by}</span>
                    </div>
                    {summary && (
                      <div className="mt-1 text-white/80">{summary}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </section>
  );
}

