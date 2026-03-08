"use client";

import { useState } from "react";
import Link from "next/link";
import { roleAtLeast } from "@/lib/roles";
import { restartOnboardingTour } from "@/components/AdminOnboarding";

export function AdminNav({
  gymSlug,
  role,
  memberId,
}: {
  gymSlug: string;
  role?: string;
  memberId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const isAdmin = role === "PLATFORM_ADMIN" || role === "GYM_ADMIN";
  const canSeeMembers =
    role === "PLATFORM_ADMIN" ||
    role === "GYM_ADMIN" ||
    role === "LOCATION_ADMIN" ||
    role === "STAFF";
  const canSeePlans =
    role === "PLATFORM_ADMIN" ||
    role === "GYM_ADMIN" ||
    role === "LOCATION_ADMIN";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 w-9 flex-col items-center justify-center gap-1.5 rounded-md border border-white/20 bg-black/40 hover:bg-black/60"
        aria-label="Open admin menu"
        data-tour="admin-menu"
      >
        <span className="block h-0.5 w-4 rounded-full bg-white" />
        <span className="block h-0.5 w-4 rounded-full bg-white" />
        <span className="block h-0.5 w-4 rounded-full bg-white" />
      </button>
      {open && (
        <div
          className="absolute right-0 z-[100] mt-2 w-44 rounded-md border border-white/15 shadow-lg text-sm"
          style={{ backgroundColor: "#000" }}
        >
          {memberId && (
            <Link
              href={`/${gymSlug}/admin/members/${memberId}`}
              className="block px-3 py-2 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              My Profile
            </Link>
          )}
          {isAdmin && (
            <Link
              href={`/${gymSlug}/admin/locations`}
              className="block px-3 py-2 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              Locations
            </Link>
          )}
          {canSeeMembers && (
            <Link
              href={`/${gymSlug}/admin/members`}
              className="block px-3 py-2 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              Members
            </Link>
          )}
          {canSeePlans && (
            <Link
              href={`/${gymSlug}/admin/plans`}
              className="block px-3 py-2 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              Plans
            </Link>
          )}
          {roleAtLeast(role as any, "LOCATION_ADMIN") && (
            <Link
              href={`/${gymSlug}/admin/schedule`}
              className="block px-3 py-2 hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              Planning
            </Link>
          )}
          <Link
            href={`/${gymSlug}/admin/my-schedule`}
            className="block px-3 py-2 hover:bg-white/10"
            onClick={() => setOpen(false)}
          >
            Schedule
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              restartOnboardingTour();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-white/70 hover:bg-white/10"
          >
            Restart tour
          </button>
        </div>
      )}
    </div>
  );
}
