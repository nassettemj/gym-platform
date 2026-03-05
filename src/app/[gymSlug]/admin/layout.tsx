import type { ReactNode } from "react";
import { AdminNav } from "@/components/AdminNav";
import { AdminBreadcrumbs } from "@/components/AdminBreadcrumbs";

interface AdminLayoutProps {
  children: ReactNode;
  params: Promise<{
    gymSlug: string;
  }>;
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { gymSlug } = await params;

  return (
    <div className="min-h-screen bg-neutral-900 text-white">
      <header className="border-b border-white/10 bg-black/40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <AdminBreadcrumbs gymSlug={gymSlug} />
          <AdminNav gymSlug={gymSlug} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
