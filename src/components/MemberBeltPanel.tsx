"use client";

import { useState } from "react";

type MemberBelt = {
  id: string;
  belt: string | null;
  stripes: number | null;
};

type BeltLog = {
  id: string;
  changedAt: string | Date;
  previousBelt: string | null;
  newBelt: string | null;
  previousStripes: number | null;
  newStripes: number | null;
  changedByUser: { name: string | null } | null;
};

type Props = {
  member: MemberBelt;
  gymSlug: string;
  updateBeltStripesAction?: (formData: FormData) => void;
  beltStripeLogs?: BeltLog[];
  beltError?: string | null;
  /** When true, show edit control (platform or gym admin only). */
  canEdit?: boolean;
};

export function MemberBeltPanel({
  member,
  gymSlug,
  updateBeltStripesAction,
  beltStripeLogs,
  beltError,
  canEdit,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="space-y-2 text-sm">
      {editing && updateBeltStripesAction && canEdit ? (
        <form
          action={updateBeltStripesAction}
          className="flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="gymSlug" value={gymSlug} />
          <input type="hidden" name="memberId" value={member.id} />
          <div className="flex flex-col gap-1 min-w-[8rem]">
            <label className="text-xs font-medium text-white/80">Belt</label>
            <select
              name="belt"
              defaultValue={member.belt ?? ""}
              className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="">—</option>
              <option value="WHITE">White</option>
              <option value="BLUE">Blue</option>
              <option value="PURPLE">Purple</option>
              <option value="BROWN">Brown</option>
              <option value="BLACK">Black</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-[6rem]">
            <label className="text-xs font-medium text-white/80">Stripes</label>
            <select
              name="stripes"
              defaultValue={
                member.stripes != null ? String(member.stripes) : ""
              }
              className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="">—</option>
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-4">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-2 py-1.5 rounded-md border border-white/20 text-[11px] hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-2 py-1.5 rounded-md bg-orange-600 text-[11px] font-medium hover:bg-orange-500"
            >
              Save
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-left text-white/80 flex-1"
          >
            <span className="font-semibold">Belt &amp; Stripes:</span>{" "}
            {member.belt ?? "—"}
            {member.stripes != null ? ` · ${member.stripes} stripes` : ""}
          </button>
          {canEdit && updateBeltStripesAction && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-white/70 hover:text-white"
              aria-label="Edit belt and stripes"
            >
              ✎
            </button>
          )}
        </div>
      )}

      {beltError && (
        <p className="mt-1 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {beltError}
        </p>
      )}

      {showHistory && beltStripeLogs && (
        <div className="mt-2 space-y-2 text-xs">
          <h3 className="text-xs font-medium text-white/70">
            Belt &amp; stripes history
          </h3>
          {beltStripeLogs.length === 0 ? (
            <p className="text-xs text-white/60">
              No belt or stripe changes recorded.
            </p>
          ) : (
            <ul className="space-y-2">
              {beltStripeLogs.map((log) => {
                const when = new Date(log.changedAt).toLocaleString();
                const by = log.changedByUser?.name ?? "—";
                const beltChanged = log.previousBelt !== log.newBelt;
                const stripesChanged =
                  log.previousStripes !== log.newStripes;
                const beltPart = beltChanged
                  ? `Belt: ${log.previousBelt ?? "—"} → ${log.newBelt ?? "—"}`
                  : null;
                const stripePart = stripesChanged
                  ? `Stripes: ${log.previousStripes ?? "—"} → ${log.newStripes ?? "—"}`
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
        </div>
      )}
    </div>
  );
}
