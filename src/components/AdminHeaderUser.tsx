import Link from "next/link";

const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: "Platform admin",
  GYM_ADMIN: "Gym admin",
  LOCATION_ADMIN: "Location admin",
  STAFF: "Staff",
  INSTRUCTOR: "Instructor",
  MEMBER: "Member",
};

type SessionUser = {
  name?: string | null;
  email?: string | null;
  role?: string;
  memberId?: string | null;
};

export function AdminHeaderUser({
  user,
  gymSlug,
}: {
  user: SessionUser;
  gymSlug: string;
}) {
  const displayName = user.name?.trim() || user.email || "User";
  const roleLabel = user.role
    ? ROLE_LABELS[user.role] ?? user.role.replace(/_/g, " ").toLowerCase()
    : null;
  const memberId = user.memberId;

  return (
    <div className="flex items-center gap-2 text-sm text-white/90">
      {memberId ? (
        <Link
          href={`/${gymSlug}/admin/members/${memberId}`}
          className="font-medium text-white hover:text-orange-400 underline underline-offset-2"
        >
          {displayName}
        </Link>
      ) : (
        <span className="font-medium">{displayName}</span>
      )}
      <span className="text-white/50" aria-hidden>
        ·
      </span>
      <span className="text-white/60">{roleLabel ?? "—"}</span>
    </div>
  );
}
