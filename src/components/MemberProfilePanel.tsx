"use client";

import { useState } from "react";

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  birthDate: Date | null;
  belt: string | null;
  stripes: number | null;
  status: string;
};

type Props = {
  member: Member;
  gymSlug: string;
  updateAction: (formData: FormData) => void;
  updateBeltStripesAction?: (formData: FormData) => void;
  beltStripeLogs?: {
    id: string;
    changedAt: string | Date;
    previousBelt: string | null;
    newBelt: string | null;
    previousStripes: number | null;
    newStripes: number | null;
    changedByUser: { name: string | null } | null;
  }[];
  beltError?: string | null;
};

type EditingField =
  | "name"
  | "email"
  | "phone"
  | "birthDate"
  | "belt"
  | null;

export function MemberProfilePanel({
  member,
  gymSlug,
  updateAction,
  updateBeltStripesAction,
  beltStripeLogs,
  beltError,
}: Props) {
  const [editingField, setEditingField] = useState<EditingField>(null);
  const [showBeltHistory, setShowBeltHistory] = useState(false);

  const birthDateStr = member.birthDate
    ? new Date(member.birthDate).toISOString().slice(0, 10)
    : "";

  const fullName = `${member.firstName} ${member.lastName}`.trim();

  return (
    <div className="space-y-2 text-sm">
      {/* Status (read-only) */}
      <div className="flex items-center justify-between">
        <p className="text-white/80">
          <span className="font-semibold">Status:</span>{" "}
          <span className="uppercase">{member.status}</span>
        </p>
      </div>

      {/* Name */}
      <div className="flex items-center justify-between gap-3">
        {editingField === "name" ? (
          <form
            action={updateAction}
            className="flex flex-wrap items-center gap-2 flex-1"
          >
            <input type="hidden" name="gymSlug" value={gymSlug} />
            <input type="hidden" name="memberId" value={member.id} />
            <div className="flex flex-col gap-1 flex-1 min-w-[8rem]">
              <label className="text-xs font-medium text-white/80">
                First name
              </label>
              <input
                name="firstName"
                defaultValue={member.firstName}
                className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-[8rem]">
              <label className="text-xs font-medium text-white/80">
                Last name
              </label>
              <input
                name="lastName"
                defaultValue={member.lastName}
                className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingField(null)}
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
          <>
            <p className="text-white/80">
              <span className="font-semibold">Name:</span> {fullName}
            </p>
            <button
              type="button"
              onClick={() => setEditingField("name")}
              className="text-xs text-white/70 hover:text-white"
              aria-label="Edit name"
            >
              ✎
            </button>
          </>
        )}
      </div>

      {/* Date of birth */}
      <div className="flex items-center justify-between gap-3">
        {editingField === "birthDate" ? (
          <form
            action={updateAction}
            className="flex items-center gap-2 flex-1"
          >
            <input type="hidden" name="gymSlug" value={gymSlug} />
            <input type="hidden" name="memberId" value={member.id} />
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-medium text-white/80">
                Date of birth
              </label>
              <input
                name="birthDate"
                type="date"
                defaultValue={birthDateStr}
                className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => setEditingField(null)}
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
          <>
            <p className="text-white/80">
              <span className="font-semibold">DoB:</span>{" "}
              {member.birthDate
                ? new Date(member.birthDate).toLocaleDateString()
                : "—"}
            </p>
            <button
              type="button"
              onClick={() => setEditingField("birthDate")}
              className="text-xs text-white/70 hover:text-white"
              aria-label="Edit date of birth"
            >
              ✎
            </button>
          </>
        )}
      </div>

      {/* Belt & Stripes */}
      <div className="flex items-center justify-between gap-3">
        {editingField === "belt" && updateBeltStripesAction ? (
          <form
            action={updateBeltStripesAction}
            className="flex flex-wrap items-center gap-2 flex-1"
          >
            <input type="hidden" name="gymSlug" value={gymSlug} />
            <input type="hidden" name="memberId" value={member.id} />
            <div className="flex flex-col gap-1 min-w-[8rem]">
              <label className="text-xs font-medium text-white/80">
                Belt
              </label>
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
              <label className="text-xs font-medium text-white/80">
                Stripes
              </label>
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
                onClick={() => setEditingField(null)}
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
          <>
            <button
              type="button"
              onClick={() => setShowBeltHistory((v) => !v)}
              className="text-left text-white/80 flex-1"
            >
              <span className="font-semibold">Belt &amp; Stripes:</span>{" "}
              {member.belt ?? "—"}
              {member.stripes != null ? ` · ${member.stripes} stripes` : ""}
            </button>
            {updateBeltStripesAction && (
              <button
                type="button"
                onClick={() => setEditingField("belt")}
                className="text-xs text-white/70 hover:text-white"
                aria-label="Edit belt and stripes"
              >
                ✎
              </button>
            )}
          </>
        )}
      </div>

      {beltError && (
        <p className="mt-1 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {beltError}
        </p>
      )}

      {showBeltHistory && beltStripeLogs && (
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
        </div>
      )}

      {/* Phone */}
      <div className="flex items-center justify-between gap-3">
        {editingField === "phone" ? (
          <form
            action={updateAction}
            className="flex items-center gap-2 flex-1"
          >
            <input type="hidden" name="gymSlug" value={gymSlug} />
            <input type="hidden" name="memberId" value={member.id} />
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-medium text-white/80">
                Phone
              </label>
              <input
                name="phone"
                defaultValue={member.phone ?? ""}
                className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => setEditingField(null)}
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
          <>
            <p className="text-white/80 flex items-center gap-1">
              <span aria-hidden="true">📞</span>
              {member.phone ?? "—"}
            </p>
            <button
              type="button"
              onClick={() => setEditingField("phone")}
              className="text-xs text-white/70 hover:text-white"
              aria-label="Edit phone"
            >
              ✎
            </button>
          </>
        )}
      </div>

      {/* Email */}
      <div className="flex items-center justify-between gap-3">
        {editingField === "email" ? (
          <form
            action={updateAction}
            className="flex items-center gap-2 flex-1"
          >
            <input type="hidden" name="gymSlug" value={gymSlug} />
            <input type="hidden" name="memberId" value={member.id} />
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-medium text-white/80">
                Email
              </label>
              <input
                name="email"
                defaultValue={member.email ?? ""}
                type="email"
                className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div className="flex items-center gap-2 pt-4">
              <button
                type="button"
                onClick={() => setEditingField(null)}
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
          <>
            <p className="text-white/80 flex items-center gap-1">
              <span aria-hidden="true">✉️</span>
              {member.email ?? "—"}
            </p>
            <button
              type="button"
              onClick={() => setEditingField("email")}
              className="text-xs text-white/70 hover:text-white"
              aria-label="Edit email"
            >
              ✎
            </button>
          </>
        )}
      </div>
    </div>
  );
}
