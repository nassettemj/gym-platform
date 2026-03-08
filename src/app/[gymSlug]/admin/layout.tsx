import type { ReactNode } from "react";
import { auth } from "@/auth";
import { AdminNav } from "@/components/AdminNav";
import { AdminBreadcrumbs } from "@/components/AdminBreadcrumbs";
import { AdminHeaderUser } from "@/components/AdminHeaderUser";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminOnboarding } from "@/components/AdminOnboarding";

interface AdminLayoutProps {
  children: ReactNode;
  params: Promise<{
    gymSlug: string;
  }>;
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { gymSlug } = await params;
  const session = await auth();
  const user = session?.user as { name?: string | null; email?: string | null; role?: string; memberId?: string | null } | undefined;

  return (
    <AdminOnboarding gymSlug={gymSlug} userRole={user?.role}>
      <div className="min-h-screen bg-neutral-900 text-white">
        <header className="border-b border-white/10 bg-black/40">
          <div className="mx-auto flex max-w-5xl items-center px-4 py-3">
            <div className="flex-1">
              {user?.role !== "MEMBER" && <AdminBreadcrumbs gymSlug={gymSlug} />}
            </div>
            <div className="flex items-center gap-4">
              {user && (
                <AdminHeaderUser
                  user={user}
                  gymSlug={gymSlug}
                />
              )}
              {user && <LogoutButton gymSlug={gymSlug} />}
              <AdminNav gymSlug={gymSlug} role={user?.role} memberId={user?.memberId} />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6" data-tour="admin-main">
          {children}
        </main>
      </div>
    </AdminOnboarding>
  );
}
