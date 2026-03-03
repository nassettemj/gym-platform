"use client";

import { useState } from "react";
import Link from "next/link";

export function AdminNav({ gymSlug }: { gymSlug: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/20 bg-black/40 hover:bg-black/60"
        aria-label="Open admin menu"
      >
        <span className="block h-0.5 w-4 bg-white mb-1" />
        <span className="block h-0.5 w-4 bg-white mb-1" />
        <span className="block h-0.5 w-4 bg-white" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-md border border-white/15 bg-black/90 shadow-lg text-sm">
          <Link
            href={`/${gymSlug}/admin/locations`}
            className="block px-3 py-2 hover:bg-white/10"
            onClick={() => setOpen(false)}
          >
            Locations
          </Link>
          <Link
            href={`/${gymSlug}/admin/members`}
            className="block px-3 py-2 hover:bg-white/10"
            onClick={() => setOpen(false)}
          >
            Members
          </Link>
        </div>
      )}
    </div>
  );
}
