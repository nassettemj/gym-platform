"use client";

import { signOut } from "next-auth/react";

export function LogoutButton({ gymSlug }: { gymSlug: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: `/${gymSlug}/login` })}
      className="inline-flex items-center justify-center px-2 py-1 text-xs rounded-md border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
      aria-label="Sign out"
    >
      Logout
    </button>
  );
}

