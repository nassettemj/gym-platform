import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { roleAtLeast } from "@/lib/roles";
import { ReportingForm } from "./ReportingForm";
import { ReportTableSection } from "./ReportTableSection";

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

/** Count how many times there was a gap of 7+ consecutive days with no training (within report range). */
function countWeeksOff(reportStart: Date, reportEnd: Date, trainingDateStrings: string[]): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const startDay = Math.floor(reportStart.getTime() / dayMs);
  const endDay = Math.floor(reportEnd.getTime() / dayMs);
  if (trainingDateStrings.length === 0) {
    const days = endDay - startDay + 1;
    return days >= 7 ? 1 : 0;
  }
  const sorted = [...trainingDateStrings].sort();
  let gaps = 0;
  const firstDay = Math.floor(new Date(sorted[0] + "T12:00:00.000Z").getTime() / dayMs);
  if (firstDay - startDay >= 7) gaps += 1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const d1 = Math.floor(new Date(sorted[i] + "T12:00:00.000Z").getTime() / dayMs);
    const d2 = Math.floor(new Date(sorted[i + 1] + "T12:00:00.000Z").getTime() / dayMs);
    if (d2 - d1 > 7) gaps += 1;
  }
  const lastDay = Math.floor(new Date(sorted[sorted.length - 1] + "T12:00:00.000Z").getTime() / dayMs);
  if (endDay - lastDay >= 7) gaps += 1;
  return gaps;
}

/** Longest streak of consecutive days with no training (within report range), in days. */
function longestStreakDaysOff(reportStart: Date, reportEnd: Date, trainingDateStrings: string[]): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const startDay = Math.floor(reportStart.getTime() / dayMs);
  const endDay = Math.floor(reportEnd.getTime() / dayMs);
  if (trainingDateStrings.length === 0) {
    return Math.max(0, endDay - startDay + 1);
  }
  const sorted = [...trainingDateStrings].sort();
  let max = 0;
  const firstDay = Math.floor(new Date(sorted[0] + "T12:00:00.000Z").getTime() / dayMs);
  max = Math.max(max, firstDay - startDay);
  for (let i = 0; i < sorted.length - 1; i++) {
    const d1 = Math.floor(new Date(sorted[i] + "T12:00:00.000Z").getTime() / dayMs);
    const d2 = Math.floor(new Date(sorted[i + 1] + "T12:00:00.000Z").getTime() / dayMs);
    max = Math.max(max, d2 - d1 - 1);
  }
  const lastDay = Math.floor(new Date(sorted[sorted.length - 1] + "T12:00:00.000Z").getTime() / dayMs);
  max = Math.max(max, endDay - lastDay);
  return max;
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
  const startParam = typeof resolvedSearchParams.start === "string" ? resolvedSearchParams.start : null;

  const lastGraduation = await prisma.class.findFirst({
    where: {
      gymId: gym.id,
      mainCategory: "GRADUATION",
      startAt: { lte: new Date() },
    },
    orderBy: { startAt: "desc" },
    select: { startAt: true },
  });
  const lastGraduationDate: Date | null = lastGraduation?.startAt ?? null;
  const lastGraduationDateStr = lastGraduationDate
    ? lastGraduationDate.toISOString().slice(0, 10)
    : null;

  let reportStart: Date | null = null;
  const reportEnd = endOfDay(new Date());

  if (startParam) {
    const parsed = new Date(`${startParam}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) {
      reportStart = startOfDay(parsed);
    }
  } else if (lastGraduationDate) {
    reportStart = startOfDay(lastGraduationDate);
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

  // Group by member: count, breakdown by mainCategory and subCategory, and unique training dates (for weeks off)
  type CategoryBreakdown = { total: number; bySubcategory: Record<string, number> };
  const byMember = new Map<
    string,
    {
      member: (typeof checkIns)[0]["member"];
      count: number;
      byCategory: Record<string, CategoryBreakdown>;
      trainingDates: Set<string>;
    }
  >();
  for (const row of checkIns) {
    const dateStr = new Date(row.checkedAt).toISOString().slice(0, 10);
    const mainCat = row.class?.mainCategory ?? "Uncategorized";
    const subCat = row.class?.subCategory ?? "Uncategorized";
    const existing = byMember.get(row.member.id);
    if (existing) {
      existing.count += 1;
      existing.trainingDates.add(dateStr);
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
        trainingDates: new Set([dateStr]),
      });
    }
  }
  let memberSummaries = Array.from(byMember.entries()).map(([, v]) => {
    const { trainingDates, ...rest } = v;
    const dates = Array.from(trainingDates);
    const weeksOff = reportStart != null ? countWeeksOff(reportStart, reportEnd, dates) : 0;
    const maxDaysOff =
      reportStart != null ? longestStreakDaysOff(reportStart, reportEnd, dates) : 0;
    return { ...rest, weeksOff, longestStreakDaysOff: maxDaysOff };
  });
  memberSummaries.sort((a, b) => b.count - a.count);

  // Enrich with belt, stripes, latest belt/stripe change, memberType, subscription status, and user role
  if (memberSummaries.length > 0 && reportStart) {
    const memberIds = memberSummaries.map((s) => s.member.id);
    const [membersWithRank, subscriptions, users] = await Promise.all([
      prisma.member.findMany({
        where: { id: { in: memberIds }, gymId: gym.id },
        select: {
          id: true,
          belt: true,
          stripes: true,
          memberType: true,
          beltStripeLogs: {
            orderBy: { changedAt: "desc" },
            take: 1,
            select: { changedAt: true, previousBelt: true, previousStripes: true },
          },
        },
      }),
      prisma.subscription.findMany({
        where: { memberId: { in: memberIds } },
        orderBy: { endsAt: "desc" },
        select: { memberId: true, status: true },
      }),
      prisma.user.findMany({
        where: { memberId: { in: memberIds } },
        select: { memberId: true, role: true },
      }),
    ]);
    const rankByMemberId = new Map(
      membersWithRank.map((m) => [
        m.id,
        {
          belt: m.belt,
          stripes: m.stripes,
          memberType: m.memberType,
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
    // Latest subscription status per member (first occurrence after orderBy endsAt desc)
    const subStatusByMemberId = new Map<string, string>();
    for (const sub of subscriptions) {
      if (!subStatusByMemberId.has(sub.memberId)) {
        subStatusByMemberId.set(sub.memberId, sub.status);
      }
    }
    const userRoleByMemberId = new Map<string, string>();
    for (const u of users) {
      if (u.memberId) userRoleByMemberId.set(u.memberId, u.role);
    }
    memberSummaries = memberSummaries.map((s) => {
      const rank = rankByMemberId.get(s.member.id) ?? { belt: null, stripes: null, memberType: null, lastBeltChange: null };
      return {
        ...s,
        belt: rank.belt,
        stripes: rank.stripes,
        memberType: rank.memberType,
        lastBeltChange: rank.lastBeltChange,
        subscriptionStatus: subStatusByMemberId.get(s.member.id) ?? null,
        userRole: userRoleByMemberId.get(s.member.id) ?? null,
      };
    });
  } else {
    memberSummaries = memberSummaries.map((s) => ({
      ...s,
      belt: null,
      stripes: null,
      lastBeltChange: null,
      memberType: null,
      subscriptionStatus: null,
      userRole: null,
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

  const isStartLastGraduation =
    reportStart &&
    lastGraduationDate &&
    reportStart.getTime() === startOfDay(lastGraduationDate).getTime();

  return (
    <div className="space-y-6">
      <section className="border border-white/10 rounded-xl p-4 space-y-4">
        <ReportingForm
          key={startParam ?? ""}
          gymSlug={gymSlug}
          initialStart={startParam ?? undefined}
          lastGraduationDate={lastGraduationDateStr}
        />
      </section>

      {reportStart && (
        <section className="border border-white/10 rounded-xl p-4 space-y-3">
          <ReportTableSection
            memberSummaries={memberSummaries}
            mainCategories={mainCategories}
            subCategories={subCategories}
            columnLabel="Classes"
            onlyAttended={false}
          >
            <p className="text-xs text-white/60">
              Report from {reportStart.toLocaleDateString()} to {reportEnd.toLocaleDateString()}
              {isStartLastGraduation && " — start date is the last graduation date"}.
            </p>
          </ReportTableSection>
        </section>
      )}
    </div>
  );
}
