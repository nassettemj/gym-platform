import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canAttendClass } from "@/lib/age";
import { MemberScheduleView } from "@/components/MemberScheduleView";
import { requireGymAccess } from "@/lib/gymAuth";
import {
  createCheckIn,
  deleteCheckIn,
} from "../members/[memberId]/actions";
import { PageTour, PageTourRestart, type PageTourStep } from "@/components/PageTour";

const MY_SCHEDULE_TOUR_STEPS: PageTourStep[] = [
  {
    element: "body",
    popover: {
      title: "My schedule",
      description:
        "Here you see your upcoming classes. Sign up for a class to reserve your spot, and instructors can mark your attendance.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="my-schedule-view"]',
    popover: {
      title: "Calendar",
      description:
        "Switch between day, week, or month. Click a class to sign up or cancel your sign-up. If you're staff, you can also take attendance from here.",
      side: "top",
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

interface MySchedulePageProps {
  params: Promise<{ gymSlug: string }>;
}

export default async function MySchedulePage({ params }: MySchedulePageProps) {
  const { gymSlug } = await params;

  const { gym, user } = await requireGymAccess(gymSlug);

  if (!user.memberId) {
    redirect(`/${gymSlug}/admin`);
  }

  const member = await prisma.member.findFirst({
    where: { id: user.memberId, gymId: gym.id },
    include: {
      subscriptions: {
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!member) notFound();

  const now = new Date();
  const activeSubscription =
    member.subscriptions.find(
      (sub) =>
        sub.status === "ACTIVE" &&
        sub.startsAt <= now &&
        sub.endsAt > now
    ) ?? null;

  const isMemberViewer = user.role === "MEMBER";
  const isProfileComplete = !!member.birthDate && !!member.phone;
  const hideMemberExtras = isMemberViewer && !isProfileComplete;
  const userIsStaffViewingOwnProfile =
    user.memberId === member.id &&
    ["GYM_ADMIN", "STAFF", "INSTRUCTOR", "LOCATION_ADMIN"].includes(
      user.role ?? ""
    );
  const showSchedule =
    (activeSubscription || userIsStaffViewingOwnProfile) && !hideMemberExtras;

  let scheduleClassItems: {
    id: string;
    name: string;
    startAt: string;
    endAt: string;
    locationName: string;
    instructorName: string;
    guestNames: string[];
    topic: string | null;
    mainCategory: string | null;
    subCategory: string | null;
    age: "ALL_AGES" | "ADULT_17_PLUS" | "AGE_4_6" | "AGE_7_10" | "AGE_11_15" | null;
    capacity: number | null;
    signupCount: number;
    instructorId: string | null;
    instructorMemberId: string | null;
    attendanceConfirmedAt: string | null;
    attended: boolean;
  }[] = [];
  let checkedInClassIds: string[] = [];

  if (showSchedule) {
    const startWindow = new Date(now);
    startWindow.setDate(startWindow.getDate() - 14);
    const endWindow = new Date(now);
    endWindow.setDate(endWindow.getDate() + 60);

    const classes = await prisma.class.findMany({
      where: {
        gymId: gym.id,
        OR: [
          { startAt: { gte: startWindow, lte: endWindow } },
          { startAt: null },
        ],
      },
      include: {
        instructor: true,
        location: true,
        _count: { select: { checkIns: true } },
      },
      orderBy: { startAt: "asc" },
    });

    const ageFiltered =
      member.birthDate != null
        ? classes.filter((c) =>
            canAttendClass(
              member.birthDate!,
              c.age,
              c.startAt ?? new Date()
            )
          )
        : classes.filter((c) => !c.age || c.age === "ALL_AGES");

    scheduleClassItems = ageFiltered.map((c) => ({
      id: c.id,
      name: c.name,
      startAt: c.startAt?.toISOString() ?? "",
      endAt: c.endAt?.toISOString() ?? "",
      locationName: c.location?.name ?? "",
      instructorName:
        c.instructor?.name ??
        (c.guestNames?.length
          ? `Guests: ${c.guestNames.join(", ")}`
          : ""),
      guestNames: c.guestNames ?? [],
      topic: c.topic ?? null,
      mainCategory: c.mainCategory ?? null,
      subCategory: c.subCategory ?? null,
      age: c.age ?? null,
      capacity: c.capacity ?? null,
      signupCount: (c as { _count?: { checkIns: number } })._count?.checkIns ?? 0,
      instructorId: c.instructor?.id ?? null,
      instructorMemberId: c.instructor?.memberId ?? null,
      attendanceConfirmedAt: c.attendanceConfirmedAt?.toISOString() ?? null,
      attended: false,
    }));

    const classIds = scheduleClassItems.map((item) => item.id);
    let checkInAttendedByClassId: Record<string, boolean> = {};
    if (classIds.length > 0) {
      const checkIns = await prisma.checkIn.findMany({
        where: {
          memberId: member.id,
          classId: { in: classIds },
        },
        select: { classId: true, attended: true },
      });
      checkedInClassIds = checkIns
        .map((ci) => ci.classId)
        .filter((id): id is string => id != null);
      for (const ci of checkIns) {
        if (ci.classId) {
          checkInAttendedByClassId[ci.classId] = ci.attended;
        }
      }
    }

    scheduleClassItems = scheduleClassItems.map((item) => ({
      ...item,
      attended: checkInAttendedByClassId[item.id] ?? false,
    }));
  }

  if (!showSchedule) {
    return (
      <div className="space-y-4">
        {hideMemberExtras ? (
          <div
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
            role="alert"
          >
            Please fill in your Birthday and Phone number in your{" "}
            <a
              href={`/${gymSlug}/admin/members/${member.id}`}
              className="underline hover:no-underline"
            >
              profile
            </a>{" "}
            to see and sign up for classes.
          </div>
        ) : (
          <div
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
            role="alert"
          >
            You need an active subscription to sign up for classes.{" "}
            <a
              href={`/${gymSlug}/admin/members/${member.id}`}
              className="underline hover:no-underline"
            >
              View your profile
            </a>{" "}
            to manage your plan.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageTour pageKey="my-schedule" steps={MY_SCHEDULE_TOUR_STEPS} />
      <div className="flex items-center justify-end">
        <PageTourRestart pageKey="my-schedule" />
      </div>
      <section
        className="border border-white/10 rounded-xl p-4 space-y-4"
        data-tour="my-schedule-view"
      >
        {!member.birthDate && (
          <p className="text-xs text-white/60 mb-2">
            Add your birth date to see classes suited to your age.
          </p>
        )}
        <MemberScheduleView
          classes={scheduleClassItems}
          gymSlug={gymSlug}
          memberId={member.id}
          checkedInClassIds={checkedInClassIds}
          signUpAction={createCheckIn}
          unsignAction={deleteCheckIn}
          initialViewMode="week"
          showHint={false}
        />
      </section>
    </div>
  );
}
