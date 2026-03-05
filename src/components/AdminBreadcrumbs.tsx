"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
// @ts-expect-error usePathname is available at runtime in the App Router,
// but current TypeScript configuration does not see its type export.
import { usePathname } from "next/navigation";

interface AdminBreadcrumbsProps {
  gymSlug: string;
}

function humanizeSegment(seg: string): string {
  if (seg === "memberships") return "Plans";
  return seg
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AdminBreadcrumbs({ gymSlug }: AdminBreadcrumbsProps) {
  const pathname = usePathname() ?? "/";
  const [pathWithoutQuery] = pathname.split("?");
  const segments = pathWithoutQuery.split("/").filter(Boolean);

  // segments: [gymSlug, "admin", ...rest]
  const rest = segments.slice(2);

  const isMemberDetail =
    rest.length >= 2 && rest[0] === "members" && rest[rest.length - 1];
  const memberId = isMemberDetail ? rest[rest.length - 1] : null;

  const [memberName, setMemberName] = useState<string | null>(null);

  useEffect(() => {
    if (!memberId || !isMemberDetail) {
      setMemberName(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/members/${memberId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { name?: string };
        if (!cancelled && data?.name) {
          setMemberName(data.name);
        }
      } catch {
        // ignore fetch errors
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [memberId, isMemberDetail]);

  const rootHref = `/${gymSlug}/admin`;
  const crumbs: { href: string; label: string }[] = [
    { href: rootHref, label: "Gym Admin" },
  ];

  let acc = rootHref;
  for (const seg of rest) {
    acc += `/${seg}`;
    const isLastSeg = seg === rest[rest.length - 1];

    let label: string;
    if (isMemberDetail && isLastSeg) {
      // Prefer the fetched member name, but never show the raw memberId.
      label = memberName || "Member";
    } else {
      label = humanizeSegment(seg);
    }

    crumbs.push({
      href: acc,
      label,
    });
  }

  const lastIndex = crumbs.length - 1;

  return (
    <nav aria-label="Breadcrumb" className="text-xs">
      <ol className="flex items-center gap-2">
        {crumbs.map((crumb, index) => {
          const isRoot = index === 0;
          const isLast = index === lastIndex;

          const baseClasses = "truncate";
          const colorClasses = isRoot
            ? "text-orange-500"
            : isLast
            ? "text-blue-400"
            : "text-white/70 hover:text-white";

          const content = (
            <span className={`${baseClasses} ${colorClasses}`}>
              {crumb.label}
            </span>
          );

          return (
            <li key={crumb.href} className="flex items-center gap-2">
              {index > 0 && (
                <span className="text-white/40" aria-hidden="true">
                  /
                </span>
              )}
              {isLast ? (
                <span aria-current="page">{content}</span>
              ) : (
                <Link href={crumb.href}>{content}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

