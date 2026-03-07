import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { roleAtLeast } from "@/lib/roles";
import { ReportingForm } from "./ReportingForm";
import { AttendanceByMemberTable } from "./AttendanceByMemberTable";

interface ReportingPageProps {
  params: Promise<{ gymSlug: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(23, 59, 59, 999);
  return out;
}

export default async function ReportingPage({
  params,
  searchParams,
}: ReportingPageProps) {
  const { gymSlug } = await params;

  const session = await auth();
  const user = session?.user as { role?: string; gymId?: string } | undefined;

  if (!user) {
    redirect(`/${gymSlug}/login`);
  }

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true, name: true },
  });

  if (!gym) {
    notFound();
  }

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  if (!roleAtLeast(user.role as any, "INSTRUCTOR")) {
    redirect(`/${gymSlug}/login`);
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const range = typeof resolvedSearchParams.range === "string" ? resolvedSearchParams.range : null;
  const customStart = typeof resolvedSearchParams.start === "string" ? resolvedSearchParams.start : null;
  const attendedFilter = typeof resolvedSearchParams.attended === "string" ? resolvedSearchParams.attended : "all";
  const onlyAttended = attendedFilter === "yes";

  let reportStart: Date | null = null;
  let reportEnd: Date = endOfDay(new Date());
  let lastGraduationDate: Date | null = null;
  let lastGraduationError: string | null = null;

  if (range === "last_graduation") {
    const lastGraduation = await prisma.class.findFirst({
      where: {
        gymId: gym.id,
        mainCategory: "GRADUATION",
        startAt: { lte: new Date() },
      },
      orderBy: { startAt: "desc" },
      select: { startAt: true },
    });
    if (lastGraduation?.startAt) {
      lastGraduationDate = lastGraduation.startAt;
      reportStart = startOfDay(lastGraduation.startAt);
    } else {
      lastGraduationError = "No graduation found; choose a custom start date.";
    }
  } else if (range === "custom" && customStart) {
    const parsed = new Date(`${customStart}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      reportStart = startOfDay(parsed);
    }
  }

  let checkIns: Array<{
    id: string;
    checkedAt: Date;
    attended: boolean;
    member: { id: string; firstName: string; lastName: string; email: string | null };
    class: { id: string; name: string | null; startAt: Date | null; mainCategory: string | null; subCategory: string | null } | null;
  }> = [];

  if (reportStart) {
    const rows = await prisma.checkIn.findMany({
      where: {
        member: { gymId: gym.id },
        checkedAt: { gte: reportStart, lte: reportEnd },
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true, email: true } },
        class: { select: { id: true, name: true, startAt: true, mainCategory: true, subCategory: true } },
      },
      orderBy: { checkedAt: "desc" },
    });
    checkIns = rows;
  }

  // Group by member: count and breakdown by mainCategory and subCategory
  type CategoryBreakdown = { total: number; bySubcategory: Record<string, number> };
  const byMember = new Map<
    string,
    { member: (typeof checkIns)[0]["member"]; count: number; byCategory: Record<string, CategoryBreakdown> }
  >();
  for (const row of checkIns) {
    if (onlyAttended && !row.attended) continue;
    const mainCat = row.class?.mainCategory ?? "Uncategorized";
    const subCat = row.class?.subCategory ?? "Uncategorized";
    const existing = byMember.get(row.member.id);
    if (existing) {
      existing.count += 1;
      if (!existing.byCategory[mainCat]) {
        existing.byCategory[mainCat] = { total: 0, bySubcategory: {} };
      }
      existing.byCategory[mainCat].total += 1;
      existing.byCategory[mainCat].bySubcategory[subCat] =
        (existing.byCategory[mainCat].bySubcategory[subCat] ?? 0) + 1;
    } else {
      byMember.set(row.member.id, {
        member: row.member,
        count: 1,
        byCategory: {
          [mainCat]: { total: 1, bySubcategory: { [subCat]: 1 } },
        },
      });
    }
  }
  let memberSummaries = Array.from(byMember.entries()).map(([, v]) => v);
  memberSummaries.sort((a, b) => b.count - a.count);

  // Enrich with belt, stripes, and latest belt/stripe change for each member
  if (memberSummaries.length > 0 && reportStart) {
    const memberIds = memberSummaries.map((s) => s.member.id);
    const membersWithRank = await prisma.member.findMany({
      where: { id: { in: memberIds }, gymId: gym.id },
      select: {
        id: true,
        belt: true,
        stripes: true,
        beltStripeLogs: {
          orderBy: { changedAt: "desc" },
          take: 1,
          select: { changedAt: true, previousBelt: true, previousStripes: true },
        },
      },
    });
    const rankByMemberId = new Map(
      membersWithRank.map((m) => [
        m.id,
        {
          belt: m.belt,
          stripes: m.stripes,
          lastBeltChange:
            m.beltStripeLogs[0] == null
              ? null
              : {
                  changedAt: m.beltStripeLogs[0].changedAt,
                  previousBelt: m.beltStripeLogs[0].previousBelt,
                  previousStripes: m.beltStripeLogs[0].previousStripes,
                },
        },
      ])
    );
    memberSummaries = memberSummaries.map((s) => {
      const rank = rankByMemberId.get(s.member.id) ?? { belt: null, stripes: null, lastBeltChange: null };
      return {
        ...s,
        belt: rank.belt,
        stripes: rank.stripes,
        lastBeltChange: rank.lastBeltChange,
      };
    });
  } else {
    memberSummaries = memberSummaries.map((s) => ({
      ...s,
      belt: null,
      stripes: null,
      lastBeltChange: null,
    }));
  }

  const mainCategories = Array.from(
    new Set(memberSummaries.flatMap((s) => Object.keys(s.byCategory)))
  ).sort((a, b) => a.replace(/_/g, " ").localeCompare(b.replace(/_/g, " ")));
  const subCategories = Array.from(
    new Set(
      memberSummaries.flatMap((s) =>
        Object.values(s.byCategory).flatMap((b) => Object.keys(b.bySubcategory))
      )
    )
  ).sort((a, b) => a.replace(/_/g, " ").localeCompare(b.replace(/_/g, " ")));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Reporting</h1>

      <section className="border border-white/10 rounded-xl p-4 space-y-4">
        <h2 className="text-sm font-medium text-white/80">Attendance report</h2>
        <ReportingForm
          key={`${range ?? ""}-${customStart ?? ""}-${attendedFilter}`}
          gymSlug={gymSlug}
          initialRange={range ?? undefined}
          initialStart={customStart ?? undefined}
          initialAttended={attendedFilter}
        />
        {lastGraduationError && (
          <p className="text-sm text-amber-400">{lastGraduationError}</p>
        )}
        {reportStart && !lastGraduationError && (
          <p className="text-xs text-white/60">
            Showing check-ins from {reportStart.toLocaleDateString()} to {reportEnd.toLocaleDateString()}
            {lastGraduationDate && " (since last graduation)"}
            {onlyAttended && " · counting attended only"}.
          </p>
        )}
      </section>

      {reportStart && (
        <section className="border border-white/10 rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-medium text-white/80">Attendance by member</h2>
          {memberSummaries.length === 0 ? (
            <p className="text-sm text-white/60">
              No {onlyAttended ? "attended " : ""}check-ins in this period.
            </p>
          ) : (
            <AttendanceByMemberTable
              memberSummaries={memberSummaries}
              mainCategories={mainCategories}
              subCategories={subCategories}
              columnLabel={onlyAttended ? "Classes attended" : "Classes"}
            />
          )}
        </section>
      )}
    </div>
  );
}
