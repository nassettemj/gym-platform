import { LoginForm } from "./LoginForm";
import { prisma } from "@/lib/prisma";

export default async function LoginPage() {
  const gyms = await prisma.gym.findMany({
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm border border-white/10 rounded-xl p-6 bg-black/40">
        <h1 className="text-lg font-semibold mb-4">Sign in</h1>
        <LoginForm gyms={gyms} />
      </div>
    </div>
  );
}
