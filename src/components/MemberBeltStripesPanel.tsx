"use client";

import { useState } from "react";
import { BeltRankIcon } from "@/app/[gymSlug]/admin/reporting/BeltRankIcon";

const BELT_OPTIONS = [
  { value: "", label: "Unranked" },
  { value: "WHITE", label: "White" },
  { value: "BLUE", label: "Blue" },
  { value: "PURPLE", label: "Purple" },
  { value: "BROWN", label: "Brown" },
  { value: "BLACK", label: "Black" },
] as const;

type Props = {
  memberId: string;
  gymSlug: string;
  belt: string | null;
  stripes: number | null;
  canEdit: boolean;
  updateAction: (formData: FormData) => void;
};

export function MemberBeltStripesPanel({
  memberId,
  gymSlug,
  belt,
  stripes,
  canEdit,
  updateAction,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("gymSlug", gymSlug);
    formData.set("memberId", memberId);
    updateAction(formData);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 text-sm"
      >
        <input type="hidden" name="gymSlug" value={gymSlug} />
        <input type="hidden" name="memberId" value={memberId} />
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-white/60 uppercase">Belt</span>
          <select
            name="belt"
            defaultValue={belt ?? ""}
            className="rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-orange-500 min-w-[120px]"
          >
            {BELT_OPTIONS.map(({ value, label }) => (
              <option key={value || "unranked"} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-white/60 uppercase">Stripes</span>
          <select
            name="stripes"
            defaultValue={stripes ?? 0}
            className="rounded-md border border-white/20 bg-black/40 px-2 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-orange-500 min-w-[72px]"
          >
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className="rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-500"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded-md border border-white/20 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  const iconSize = 96;

  return (
    <div className="text-sm text-white/80">
      {canEdit ? (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center rounded-md p-1 -m-1 hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:ring-inset text-left"
          title="Click to edit rank"
        >
          <BeltRankIcon belt={belt} stripes={stripes} size={iconSize} />
        </button>
      ) : (
        <BeltRankIcon belt={belt} stripes={stripes} size={iconSize} />
      )}
    </div>
  );
}
