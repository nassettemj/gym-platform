"use client";

import { useState } from "react";

const GUESTS_VALUE = "__guests__";

type InstructorOption = {
  id: string;
  name: string;
};

type Props = {
  instructors: InstructorOption[];
  defaultValue?: string;
  defaultGuestNames?: string[];
  defaultTopic?: string;
  /** Size variant for styling */
  size?: "sm" | "md";
  /** Optional id for the select (e.g. for label htmlFor) */
  selectId?: string;
};

export function InstructorGuestSelector({
  instructors,
  defaultValue = "",
  defaultGuestNames = [],
  defaultTopic = "",
  size = "md",
  selectId,
}: Props) {
  const [instructorValue, setInstructorValue] = useState(defaultValue);
  const [guestNames, setGuestNames] = useState<string[]>(
    defaultGuestNames.length > 0 ? defaultGuestNames : [""],
  );

  const isGuests = instructorValue === GUESTS_VALUE;

  const inputClass =
    size === "sm"
      ? "px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
      : "px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm";
  const selectClass =
    size === "sm"
      ? "px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs"
      : "px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm";

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={selectId}
        className={size === "sm" ? "font-semibold text-white/80 text-[11px]" : "text-xs font-medium"}
      >
        Instructor
      </label>
      <select
        id={selectId}
        name="instructorId"
        value={instructorValue}
        onChange={(e) => {
          const v = e.target.value;
          setInstructorValue(v);
          if (v === GUESTS_VALUE && guestNames.length === 0) {
            setGuestNames([""]);
          }
        }}
        className={selectClass}
      >
        <option value="">Unassigned</option>
        <option value={GUESTS_VALUE}>Guests</option>
        {instructors.map((inst) => (
          <option key={inst.id} value={inst.id}>
            {inst.name}
          </option>
        ))}
      </select>

      {isGuests && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-col gap-1">
            <label className={size === "sm" ? "font-semibold text-white/80 text-[11px]" : "text-xs font-medium"}>
              Topic
            </label>
            <input
              type="text"
              name="topic"
              defaultValue={defaultTopic}
              placeholder="Topic (optional)"
              className={inputClass}
              style={{ width: "100%" }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={size === "sm" ? "font-semibold text-white/80 text-[11px]" : "text-xs font-medium"}>
              Guest name(s)
            </label>
            <div className="space-y-2">
            {guestNames.map((name, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  name="guestNames"
                  value={name}
                  onChange={(e) => {
                    const next = [...guestNames];
                    next[i] = e.target.value;
                    setGuestNames(next);
                  }}
                  placeholder="Guest name"
                  required={isGuests && i === 0}
                  className={inputClass}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={() => setGuestNames([...guestNames, ""])}
                  className="flex-shrink-0 w-8 h-8 rounded-md border border-white/30 bg-white/10 hover:bg-white/20 flex items-center justify-center text-[16px] font-medium"
                  title="Add another guest"
                >
                  +
                </button>
              </div>
            ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
