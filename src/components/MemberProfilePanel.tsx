"use client";

import { useState } from "react";

type Member = {
  id: string;
  email: string | null;
  phone: string | null;
  birthDate: Date | null;
  status: string;
};

type Props = {
  member: Member;
  gymSlug: string;
  updateAction: (formData: FormData) => void;
};

export function MemberProfilePanel({
  member,
  gymSlug,
  updateAction,
}: Props) {
  const [isEditing, setIsEditing] = useState(false);

  const birthDateStr = member.birthDate
    ? new Date(member.birthDate).toISOString().slice(0, 10)
    : "";

  if (isEditing) {
    return (
      <form
        action={updateAction}
        className="space-y-2 text-sm"
      >
        <input type="hidden" name="gymSlug" value={gymSlug} />
        <input type="hidden" name="memberId" value={member.id} />

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-white/80">Email</label>
          <input
            name="email"
            defaultValue={member.email ?? ""}
            type="email"
            className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-white/80">Phone</label>
          <input
            name="phone"
            defaultValue={member.phone ?? ""}
            className="px-2 py-1 rounded-md bg-black/40 border border-white/20 text-xs focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="flex flex-col gap-1">
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

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-3 py-1.5 rounded-md border border-white/20 text-xs hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-md bg-orange-600 text-xs font-medium hover:bg-orange-500"
          >
            Save
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-1 text-sm">
      <p className="text-white/80">
        <span className="font-semibold">Status:</span>{" "}
        <span className="uppercase">{member.status}</span>
      </p>
      {member.email != null && member.email !== "" && (
        <p className="text-white/80">
          <span className="font-semibold">Email:</span> {member.email}
        </p>
      )}
      {member.phone != null && member.phone !== "" && (
        <p className="text-white/80">
          <span className="font-semibold">Phone:</span> {member.phone}
        </p>
      )}
      {member.birthDate && (
        <p className="text-white/80">
          <span className="font-semibold">Date of birth:</span>{" "}
          {new Date(member.birthDate).toLocaleDateString()}
        </p>
      )}

      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="mt-2 inline-flex items-center px-3 py-1.5 rounded-md border border-white/20 text-xs hover:bg-white/10"
      >
        Edit
      </button>
    </div>
  );
}
