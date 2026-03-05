import { SignupForm } from "./SignupForm";

interface GymSignupPageProps {
  params: Promise<{
    gymSlug: string;
  }>;
}

export default async function GymSignupPage({ params }: GymSignupPageProps) {
  const { gymSlug } = await params;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm border border-white/10 rounded-xl p-6 bg-black/40">
        <h1 className="text-lg font-semibold mb-4">Sign up</h1>
        <SignupForm gymSlug={gymSlug} />
      </div>
    </div>
  );
}

