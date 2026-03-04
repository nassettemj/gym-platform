"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

type MemberRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  memberType: "ADULT" | "CHILD";
  createdAt: string; // ISO string
};

type Props = {
  members: MemberRow[];
};

export function MembersTable({ members }: Props) {
  const params = useParams<{ gymSlug: string }>();
  const gymSlug = params.gymSlug;

  const [search, setSearch] = useState("");
  const [ageFilter, setAgeFilter] = useState<"ALL" | "ADULT" | "CHILD">("ALL");
  const [dateFilterMode, setDateFilterMode] = useState<"none" | "before" | "after">("none");
  const [dateFilterValue, setDateFilterValue] = useState("");

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const fullName = `${m.firstName} ${m.lastName}`.toLowerCase();
      const matchesSearch = search
        ? fullName.includes(search.toLowerCase())
        : true;

      const matchesAge =
        ageFilter === "ALL" ? true : m.memberType === ageFilter;

      let matchesDate = true;
      if (dateFilterMode !== "none" && dateFilterValue) {
        const memberDate = new Date(m.createdAt);
        const filterDate = new Date(dateFilterValue);
        filterDate.setHours(0, 0, 0, 0);

        if (dateFilterMode === "before") {
          matchesDate = memberDate < filterDate;
        } else if (dateFilterMode === "after") {
          matchesDate = memberDate > filterDate;
        }
      }

      return matchesSearch && matchesAge && matchesDate;
    });
  }, [members, search, ageFilter, dateFilterMode, dateFilterValue]);

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
              <th className="px-3 py-2 text-left align-bottom w-1/3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold">Member since</span>
                  <div className="flex gap-1 items-center">
                    <select
                      value={dateFilterMode}
                      onChange={(e) =>
                        setDateFilterMode(
                          e.target.value as "none" | "before" | "after"
                        )
                      }
                      className="px-2 py-1 rounded-md bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs"
                    >
                      <option value="none">Any</option>
                      <option value="before">Before</option>
                      <option value="after">After</option>
                    </select>
                    <input
                      type="date"
                      value={dateFilterValue}
                      onChange={(e) => setDateFilterValue(e.target.value)}
                      className="px-2 py-1 rounded-md bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs"
                    />
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-3 text-xs text-white/60 text-center"
                >
                  No members match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((m) => {
                const created = new Date(m.createdAt).toLocaleDateString();
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
                      {created}
                    </td>
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
