"use client";

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm border border-red-500/30 rounded-xl p-6 bg-black/40">
        <h1 className="text-lg font-semibold mb-2 text-red-200">Something went wrong</h1>
        <p className="text-sm text-white/70 mb-4">
          {error?.message ?? "An error occurred on the login page."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="w-full inline-flex items-center justify-center px-4 py-2 rounded-md bg-orange-600 text-xs font-medium hover:bg-orange-500"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
