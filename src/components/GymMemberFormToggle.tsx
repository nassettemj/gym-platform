"use client";

import { useState } from "react";
import { GymMemberForm } from "./GymMemberForm";

type Props = {
  gymId: string;
  gymSlug: string;
  adults: { id: string; name: string }[];
  action: (formData: FormData) => void;
};

export function GymMemberFormToggle({ gymId, gymSlug, adults, action }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-600 text-xs font-medium hover:bg-orange-500 transition-colors"
      >
        Add member
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <GymMemberForm
        gymId={gymId}
        gymSlug={gymSlug}
        adults={adults}
        action={action}
      />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-white/60 hover:text-white"
      >
        Cancel
      </button>
    </div>
  );
}
