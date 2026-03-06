"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: "Platform admin",
  GYM_ADMIN: "Gym admin",
  LOCATION_ADMIN: "Location admin",
  STAFF: "Staff",
  INSTRUCTOR: "Instructor",
  MEMBER: "Member",
};

const ROLE_ORDER = [
  "MEMBER",
  "INSTRUCTOR",
  "STAFF",
  "LOCATION_ADMIN",
  "GYM_ADMIN",
  "PLATFORM_ADMIN",
] as const;

type MemberRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  memberType: "ADULT" | "CHILD";
  createdAt: string; // ISO string (kept for potential future use)
  userId: string | null;
  userRole:
    | "PLATFORM_ADMIN"
    | "GYM_ADMIN"
    | "LOCATION_ADMIN"
    | "STAFF"
    | "INSTRUCTOR"
    | "MEMBER"
    | null;
  status: string;
  planName: string | null;
};

type Props = {
  members: MemberRow[];
  currentUserRole?: string;
};

export function MembersTable({
  members,
  currentUserRole,
}: Props) {
  const params = useParams<{ gymSlug: string }>();
  const gymSlug = params.gymSlug;

  const [search, setSearch] = useState("");
  const [ageFilter, setAgeFilter] = useState<"ALL" | "ADULT" | "CHILD">("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">(
    "ALL",
  );
  const [planFilter, setPlanFilter] = useState<string>("ALL");

  const canSeeRoleColumn =
    currentUserRole === "STAFF" ||
    currentUserRole === "LOCATION_ADMIN" ||
    currentUserRole === "GYM_ADMIN" ||
    currentUserRole === "PLATFORM_ADMIN";

  const canEditRoles =
    false;

  const emptyStateColSpan = canSeeRoleColumn ? 5 : 4;

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const fullName = `${m.firstName} ${m.lastName}`.toLowerCase();
      const matchesSearch = search
        ? fullName.includes(search.toLowerCase())
        : true;

      const matchesAge =
        ageFilter === "ALL" ? true : m.memberType === ageFilter;

      const matchesStatus =
        statusFilter === "ALL" ? true : m.status === statusFilter;

      const matchesPlan =
        planFilter === "ALL"
          ? true
          : planFilter === "NONE"
          ? m.planName === null
          : m.planName === planFilter;

      return matchesSearch && matchesAge && matchesStatus && matchesPlan;
    });
  }, [members, search, ageFilter, statusFilter, planFilter]);

  const availablePlanOptions = useMemo(() => {
    const names = new Set<string>();
    for (const m of members) {
      if (m.planName) {
        names.add(m.planName);
      }
    }
    return Array.from(names).sort();
  }, [members]);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto border border-white/10 rounded-xl">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-3 py-2 text-left align-bottom w-1/2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold">Name</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name…"
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs"
                  />
                </div>
              </th>
              <th className="px-3 py-2 text-left align-bottom w-24">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold">Age</span>
                  <select
                    value={ageFilter}
                    onChange={(e) =>
                      setAgeFilter(e.target.value as "ALL" | "ADULT" | "CHILD")
                    }
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs"
                  >
                    <option value="ALL">All</option>
                    <option value="ADULT">Adult</option>
                    <option value="CHILD">Child</option>
                  </select>
                </div>
              </th>
              <th className="px-3 py-2 text-left align-bottom w-28">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold">Status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(
                        e.target.value as "ALL" | "ACTIVE" | "INACTIVE",
                      )
                    }
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs"
                  >
                    <option value="ALL">All</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </th>
              <th className="px-3 py-2 text-left align-bottom w-40">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold">Plan</span>
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    className="px-2 py-1 rounded-md bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs"
                  >
                    <option value="ALL">All</option>
                    <option value="NONE">No plan</option>
                    {availablePlanOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </th>
              {canSeeRoleColumn && (
                <th className="px-3 py-2 text-left align-bottom w-40">
                  <span className="text-xs font-semibold">Role</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={emptyStateColSpan}
                  className="px-3 py-3 text-xs text-white/60 text-center"
                >
                  No members match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((m) => {
                return (
                  <tr
                    key={m.id}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="px-3 py-2 align-top">
                      <Link
                        href={`/${gymSlug}/admin/members/${m.id}`}
                        className="text-left text-sm font-medium text-orange-300 hover:text-orange-200"
                      >
                        {m.firstName} {m.lastName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-white/80">
                      {m.memberType === "ADULT" ? "Adult" : "Child"}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-white/80">
                      {m.status === "ACTIVE" ? "Active" : "Inactive"}
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-white/80">
                      {m.planName ?? "—"}
                    </td>
                    {canSeeRoleColumn && (
                      <td className="px-3 py-2 align-top text-xs text-white/80">
                        <span className="text-white/80">
                          {m.userRole ? ROLE_LABELS[m.userRole] : "—"}
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
