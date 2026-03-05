"use client";

import Link from "next/link";
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

  const rootHref = `/${gymSlug}/admin`;
  const crumbs: { href: string; label: string }[] = [
    { href: rootHref, label: "Gym Admin" },
  ];

  let acc = rootHref;
  for (const seg of rest) {
    acc += `/${seg}`;
    crumbs.push({
      href: acc,
      label: humanizeSegment(seg),
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

