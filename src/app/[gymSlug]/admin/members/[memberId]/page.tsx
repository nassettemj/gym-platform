import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { MemberProfilePanel } from "@/components/MemberProfilePanel";
import { MemberClassHistoryTable } from "@/components/MemberClassHistoryTable";
import { MemberPlanChooser } from "@/components/MemberPlanChooser";
import { MemberBeltStripesPanel } from "@/components/MemberBeltStripesPanel";
import { requireGymAccess } from "@/lib/gymAuth";
import { roleAtLeast } from "@/lib/roles";
import { PageTour, PageTourRestart, type PageTourStep } from "@/components/PageTour";
import {
  updateMemberProfile,
  updateMemberUserRole,
  updateMemberBeltStripes,
  createCheckIn,
  bulkCreateCheckIns,
  deleteCheckIn,
  addSubscription,
  cancelSubscription,
  pickPlanForMember,
  deleteMember,
} from "./actions";

const MEMBER_PROFILE_TOUR_STEPS: PageTourStep[] = [
  {
    element: "body",
    popover: {
      title: "Member profile",
      description:
        "This page shows one member's profile: contact info, belt & stripes, subscription, and class history. Staff can edit; members see their own profile.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="member-profile"]',
    popover: {
      title: "Profile",
      description:
        "Name, email, phone, and birth date. You can update the member's role (e.g. Staff, Instructor) or delete the member from here. Below you may see Belt & stripes, Plan, and Class history depending on permissions.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: "body",
    popover: {
      title: "Done",
      description: "You can replay this tour anytime using the link above.",
      side: "top",
      align: "center",
    },
  },
];

interface MemberDetailPageProps {
  params: Promise<{
    gymSlug: string;
    memberId: string;
  }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function MemberDetailPage({
  params,
  searchParams,
}: MemberDetailPageProps) {
  const { gymSlug, memberId } = await params;

  const { gym, user } = await requireGymAccess(gymSlug);
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const profileError =
    typeof resolvedSearchParams.profileError === "string"
      ? resolvedSearchParams.profileError
      : null;

  const [member, plans] = await Promise.all([
    prisma.member.findFirst({
      where: {
        id: memberId,
        gymId: gym.id,
      },
      include: {
        user: {
          select: {
            role: true,
          },
        },
        subscriptions: {
          include: {
            plan: true,
          },
          orderBy: { createdAt: "desc" },
        },
        profileChangeLogs: {
          include: { changedByUser: { select: { name: true } } },
          orderBy: { changedAt: "desc" },
          take: 50,
        },
      },
    }),
    prisma.membershipPlan.findMany({
      where: { gymId: gym.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!member) {
    notFound();
  }

  const isMemberViewer = user.role === "MEMBER";
  const isProfileComplete = !!member.birthDate && !!member.phone;
  const hideMemberExtras = isMemberViewer && !isProfileComplete;

  const now = new Date();
  const activeSubscription =
    member.subscriptions.find((sub) => {
      return (
        sub.status === "ACTIVE" &&
        sub.startsAt <= now &&
        sub.endsAt > now
      );
    }) ?? null;

  const summarySubscription =
    activeSubscription ?? member.subscriptions[0] ?? null;

  const showClassHistory =
    !hideMemberExtras &&
    (user.memberId === member.id ||
      user.role === "PLATFORM_ADMIN" ||
      user.role === "GYM_ADMIN");

  const checkInHistoryRaw = showClassHistory
    ? await prisma.checkIn.findMany({
        where: {
          memberId: member.id,
          classId: { not: null },
        },
        include: {
          class: {
            select: {
              name: true,
              startAt: true,
              endAt: true,
              dayOfWeek: true,
              startTime: true,
              endTime: true,
              mainCategory: true,
              subCategory: true,
              age: true,
              discipline: true,
              topic: true,
              capacity: true,
              attendanceConfirmedAt: true,
              guestNames: true,
              location: { select: { name: true } },
              instructor: { select: { name: true } },
            },
          },
        },
        orderBy: { checkedAt: "desc" },
        take: 50,
      })
    : [];

  const checkInHistory: Array<{
    id: string;
    className: string;
    date: string;
    startTime: string;
    endTime: string;
    locationName: string | null;
    instructorName: string | null;
    mainCategory: string | null;
    subCategory: string | null;
    age: string | null;
    discipline: string | null;
    topic: string | null;
    capacity: number | null;
    signedUpAt: string;
    status: "Signed up" | "Present" | "Absent";
  }> = checkInHistoryRaw.map((ci) => {
    const c = ci.class;
    if (!c) {
      return {
        id: ci.id,
        className: "",
        date: "",
        startTime: "",
        endTime: "",
        locationName: null,
        instructorName: null,
        mainCategory: null,
        subCategory: null,
        age: null,
        discipline: null,
        topic: null,
        capacity: null,
        signedUpAt: ci.checkedAt.toISOString(),
        status: "Signed up" as const,
      };
    }
    const dateStr = c.startAt
      ? c.startAt.toISOString().slice(0, 10)
      : "";
    const startTimeStr = c.startAt
      ? c.startAt.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : c.startTime ?? "";
    const endTimeStr = c.endAt
      ? c.endAt.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : c.endTime ?? "";
    const instructorName =
      c.instructor?.name ??
      (c.guestNames?.length ? `Guests: ${c.guestNames.join(", ")}` : null);
    let status: "Signed up" | "Present" | "Absent" = "Signed up";
    if (c.attendanceConfirmedAt) {
      status = ci.attended ? "Present" : "Absent";
    }
    return {
      id: ci.id,
      className: c.name ?? "",
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      locationName: c.location?.name ?? null,
      instructorName,
      mainCategory: c.mainCategory,
      subCategory: c.subCategory,
      age: c.age,
      discipline: c.discipline ?? null,
      topic: c.topic ?? null,
      capacity: c.capacity ?? null,
      signedUpAt: ci.checkedAt.toISOString(),
      status,
    };
  });

  return (
    <div className="space-y-4">
      {hideMemberExtras && (
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          role="alert"
        >
          Please fill in your Birthday and Phone number for additional features to become visible.
        </div>
      )}
      <PageTour pageKey="member-profile" steps={MEMBER_PROFILE_TOUR_STEPS} />
      <div className="flex items-center justify-end">
        <PageTourRestart pageKey="member-profile" />
      </div>
      <section
        className="border border-white/10 rounded-xl p-4 space-y-4"
        data-tour="member-profile"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-white/80">Profile</h2>
        </div>
        <MemberProfilePanel
          member={{
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            email: member.email,
            phone: member.phone,
            birthDate: member.birthDate,
            status: member.status,
            userRole: member.user?.role ?? null,
          }}
          gymSlug={gymSlug}
          updateAction={updateMemberProfile}
          updateRoleAction={updateMemberUserRole}
          currentUserRole={user.role ?? undefined}
          deleteAction={deleteMember}
          canDeleteMember={
            user.role === "PLATFORM_ADMIN" || user.role === "GYM_ADMIN"
          }
          canEditProfile={
            user.role === "PLATFORM_ADMIN" || user.role === "GYM_ADMIN"
          }
          profileError={profileError}
        />
      </section>

      {!hideMemberExtras && (
        <section
          className="border border-white/10 rounded-xl p-4 space-y-3"
          data-tour="member-belt"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/80">Belt & stripes</h2>
          </div>
          <MemberBeltStripesPanel
            memberId={member.id}
            gymSlug={gymSlug}
            belt={member.belt ?? null}
            stripes={member.stripes ?? null}
            canEdit={roleAtLeast(user.role, "STAFF")}
            updateAction={updateMemberBeltStripes}
          />
        </section>
      )}

      {!hideMemberExtras && (
        <section
          className="border border-white/10 rounded-xl p-4 space-y-3"
          data-tour="member-plan"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/80">Plan</h2>
          </div>

          {summarySubscription && (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="flex flex-col gap-2 border border-white/15 rounded-xl p-4 bg-black/40 min-h-[160px]">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <span className="font-medium">
                    {summarySubscription.plan?.name ?? "Unknown plan"}
                  </span>
                  <span className="text-[11px] text-white/60 uppercase">
                    {summarySubscription.status}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5 text-[11px] text-white/60">
                  <div>
                    {summarySubscription.plan?.billingKind === "PASS" ? "Pass" : "Subscription"}
                  </div>
                  {summarySubscription.plan && (
                    <div>
                      {summarySubscription.plan.billingKind === "PASS"
                        ? summarySubscription.plan.visits === "TEN_VISITS"
                          ? "10 visits"
                          : "1 visit"
                        : `${summarySubscription.plan.duration === "ONE_YEAR" ? "1 year" : "1 month"} · ${summarySubscription.plan.age === "KIDS_AND_JUNIORS" ? "Kids & Juniors" : "Adults"}`}
                    </div>
                  )}
                  {summarySubscription.plan?.priceCents != null && (
                    <div>
                      €
                      {(summarySubscription.plan.priceCents / 100).toFixed(2)}
                    </div>
                  )}
                </div>

                <div className="mt-auto flex justify-end">
                  <div className="flex flex-col items-end gap-1 text-[11px]">
                    {activeSubscription &&
                      activeSubscription.id === summarySubscription.id && (
                        <details className="text-right">
                          <summary className="cursor-pointer text-orange-400 hover:text-orange-300 list-none">
                            Cancel plan
                          </summary>
                          <form
                            action={cancelSubscription}
                            className="mt-1 flex flex-col items-end gap-1"
                          >
                            <input
                              type="hidden"
                              name="gymSlug"
                              value={gymSlug}
                            />
                            <input
                              type="hidden"
                              name="memberId"
                              value={member.id}
                            />
                            <input
                              type="hidden"
                              name="subscriptionId"
                              value={activeSubscription.id}
                            />
                            <div className="flex flex-col gap-1 items-end">
                              <label className="text-[10px] font-medium text-white/80">
                                Cancellation date
                                <input
                                  name="cancelDate"
                                  type="date"
                                  required
                                  className="mt-1 px-2 py-1 rounded-md bg-black/40 border border-white/20 focus:outline-none focus:ring-1 focus:ring-red-500 text-[11px]"
                                />
                              </label>
                            </div>
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-red-600 text-[11px] font-medium hover:bg-red-500 transition-colors"
                            >
                              Confirm cancellation
                            </button>
                          </form>
                        </details>
                      )}
                    <Link
                      href={`/${gymSlug}/admin/members/${member.id}/change-plan`}
                      className="text-orange-400 hover:text-orange-300"
                    >
                      Change plan
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {member.subscriptions.length === 0 && plans.length > 0 && (
            <div className="mt-4">
              <MemberPlanChooser
                plans={plans as any}
                gymSlug={gymSlug}
                memberId={member.id}
                pickPlanAction={pickPlanForMember}
              />
            </div>
          )}
        </section>
      )}

      {showClassHistory && (
        <section
          className="border border-white/10 rounded-xl p-4 space-y-4"
          data-tour="member-class-history"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white/80">Class history</h2>
          </div>
          <MemberClassHistoryTable rows={checkInHistory} />
        </section>
      )}
    </div>
  );
}

