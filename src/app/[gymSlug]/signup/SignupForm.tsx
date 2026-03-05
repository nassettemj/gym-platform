"use client";

import { useActionState } from "react";
import Link from "next/link";
import { register } from "./actions";

interface SignupFormProps {
  gymSlug: string;
}

export function SignupForm({ gymSlug }: SignupFormProps) {
  const [state, formAction] = useActionState(
    register,
    null as { error?: string } | null,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {state.error}
        </p>
      )}
      <input type="hidden" name="gymSlug" value={gymSlug} />
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-xs font-medium">
          Name (optional)
        </label>
        <input
          id="name"
          name="name"
          type="text"
          className="px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-xs font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-xs font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          className="px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
        />
      </div>
      <button
        type="submit"
        className="w-full inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-600 text-xs font-medium hover:bg-orange-500 transition-colors"
      >
        Create account
      </button>
      <p className="text-xs text-white/60 text-center">
        Already have an account?{" "}
        <Link
          href={`/${gymSlug}/login`}
          className="text-orange-400 hover:text-orange-300 underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}

