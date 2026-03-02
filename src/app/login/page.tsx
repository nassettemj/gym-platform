import { signIn } from "@/auth";

async function login(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!email || !password) return;

  await signIn("credentials", {
    redirectTo: "/platform/gyms",
    email,
    password,
  });
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm border border-white/10 rounded-xl p-6 bg-black/40">
        <h1 className="text-lg font-semibold mb-4">Sign in</h1>
        <form action={login} className="space-y-4">
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
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
