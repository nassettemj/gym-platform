"use client";

import { useState } from "react";

type ProfileChangeLog = {
  id: string;
  fieldName: string;
  previousValue: string | null;
  newValue: string | null;
  changedAt: string | Date;
  changedByUser: { name: string | null } | null;
};

type Props = {
  gymName: string;
  memberName: string;
  logs: ProfileChangeLog[];
};

export function MemberHeaderWithHistory({
  gymName,
  memberName,
  logs,
}: Props) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setShowHistory((v) => !v)}
        className="text-left text-xl font-semibold hover:text-orange-300"
      >
        {gymName} · {memberName}
      </button>

      {showHistory && (
        <section className="border border-white/10 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-white/80">
            Profile change history
          </h2>
          {logs.length === 0 ? (
            <p className="text-xs text-white/60">
              No profile changes recorded.
            </p>
          ) : (
            <ul className="space-y-2 text-xs">
              {logs.map((log) => {
                const when = new Date(log.changedAt).toLocaleString();
                const by = log.changedByUser?.name ?? "—";
                const fieldLabel =
                  log.fieldName === "birthDate"
                    ? "Date of birth"
                    : log.fieldName.charAt(0).toUpperCase() +
                      log.fieldName.slice(1);
                return (
                  <li
                    key={log.id}
                    className="border border-white/10 rounded-md px-3 py-2 bg-black/40"
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-white/90">
                        {fieldLabel}
                      </span>
                      <span className="text-white/60">{when}</span>
                    </div>
                    <div className="mt-1 text-white/80">
                      {log.previousValue ?? "—"} → {log.newValue ?? "—"}
                    </div>
                    <div className="mt-1 text-[11px] text-white/60">
                      Changed by {by}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

