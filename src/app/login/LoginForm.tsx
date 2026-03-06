"use client";

import { useState, useEffect, type FormEvent } from "react";
import { signIn } from "next-auth/react";

interface Gym {
  slug: string;
  name: string;
}

interface LoginFormProps {
  gyms: Gym[];
}

export function LoginForm({ gyms }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isLocalhost, setIsLocalhost] = useState(false);

  useEffect(() => {
    setIsLocalhost(
      typeof window !== "undefined" && window.location?.hostname === "localhost"
    );
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    let email = String(formData.get("email") ?? "").trim();
    let password = String(formData.get("password") ?? "").trim();
    const devGymSlug = String(formData.get("devGymSlug") ?? "").trim();
    const devRole = String(formData.get("devRole") ?? "admin").trim();

    // Dev-only: empty form → quick login as selected gym admin, instructor, or member
    if (isLocalhost && !email && !password && devGymSlug) {
      email =
        devRole === "member"
          ? "__dev_member__"
          : devRole === "instructor"
            ? "__dev_instructor__"
            : "__dev_admin__";
      password = "__dev__";
    } else if (isLocalhost && email.toLowerCase() === "sup") {
      password = password || "__dev__";
    }

    if (!email || !password) return;

    const isDevQuickLogin =
      email === "__dev_admin__" ||
      email === "__dev_instructor__" ||
      email === "__dev_member__";

    const res = await signIn("credentials", {
      email,
      password,
      gymSlug: isDevQuickLogin ? devGymSlug : undefined,
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

      {isLocalhost && gyms.length > 0 && (
        <div className="space-y-3 pb-3 border-b border-white/10">
          <p className="text-xs font-medium text-white/70">Quick login (dev)</p>
          <div className="flex gap-2">
            <select
              name="devGymSlug"
              defaultValue=""
              className="flex-1 px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            >
              <option value="">Select gym…</option>
              {gyms.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>
            <select
              name="devRole"
              className="flex-1 px-3 py-2 rounded-md bg-black/60 border border-white/15 focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm"
            >
              <option value="admin">Admin</option>
              <option value="instructor">Instructor</option>
              <option value="member">Member</option>
            </select>
          </div>
          <p className="text-xs text-white/50">
            Select gym + role (admin/instructor/member), leave email/password empty, then Sign in
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-xs font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="Or 'sup' for platform admin"
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
    </form>
  );
}
