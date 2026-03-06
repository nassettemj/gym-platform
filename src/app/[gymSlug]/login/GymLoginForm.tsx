"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

interface GymLoginFormProps {
  gymSlug: string;
}

export function GymLoginForm({ gymSlug }: GymLoginFormProps) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    let email = String(formData.get("email") ?? "").trim();
    let password = String(formData.get("password") ?? "").trim();

    // Dev-only: empty form → random member of this gym
    const devAllowed =
      typeof window !== "undefined" &&
      (window.location?.hostname === "localhost" ||
        process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true");
    if (devAllowed && !email && !password) {
      email = "__dev_random_member__";
      password = "__dev__";
    }

    if (!email || !password) return;

    const res = await signIn("credentials", {
      email,
      password,
      gymSlug,
      redirect: false,
      callbackUrl: "/post-login",
    });

    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }

    if (res?.url) {
      window.location.href = res.url;
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-xs font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="Empty + Login = random member (dev)"
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
          placeholder="Password"
          className="px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
        />
      </div>
      <button
        type="submit"
        className="w-full inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-600 text-xs font-medium hover:bg-orange-500 transition-colors"
      >
        Sign in
      </button>
      <p className="text-xs text-white/60 text-center">
        Don&apos;t have an account yet?{" "}
        <Link
          href={`/${gymSlug}/signup`}
          className="text-orange-400 hover:text-orange-300 underline"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}


