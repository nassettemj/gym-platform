import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { roleAtLeast } from "@/lib/roles";
import { setCheckInAttended, confirmClassAttendance, closeGraduationEvent } from "./actions";
import { GraduationListView, type SavedSnapshot } from "./GraduationListView";

interface ClassDetailPageProps {
  params: Promise<{ gymSlug: string; classId: string }>;
}

export default async function ClassDetailPage({ params }: ClassDetailPageProps) {
  const { gymSlug, classId } = await params;

  const session = await auth();
  const user = session?.user as {
    id?: string;
    gymId?: string;
    role?: string;
    memberId?: string;
  };
  if (!user) redirect(`/${gymSlug}/login`);

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true, name: true },
  });

  if (!gym) notFound();

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    redirect(`/${gymSlug}/login`);
  }

  const clazz = await prisma.class.findFirst({
    where: { id: classId, gymId: gym.id },
    include: {
      instructor: true,
      location: true,
      checkIns: {
        include: {
          member: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { checkedAt: "asc" },
      },
    },
  });

  if (!clazz) notFound();

  const isGraduation = clazz.mainCategory === "GRADUATION";
  const graduationListRecord = isGraduation
    ? await prisma.graduationList.findUnique({
        where: { classId: clazz.id },
        select: { snapshot: true },
      })
    : null;
  const graduationSnapshot = graduationListRecord
    ? (graduationListRecord.snapshot as {
        data: unknown[];
        memberCheckCounts?: Record<string, 0 | 1 | 2>;
        nextRankOverrides?: Record<string, { belt: string; stripes: number }>;
      })
    : null;

  const instructorName =
    clazz.instructor?.name ??
    (clazz.guestNames?.length ? `Guests: ${clazz.guestNames.join(", ")}` : "Unassigned");

  const dateStr = clazz.startAt
    ? clazz.startAt.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;
  const timeStr =
    clazz.startAt && clazz.endAt
      ? `${clazz.startAt.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })} – ${clazz.endAt.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })}`
      : null;

  const canSeeNames = roleAtLeast(user.role as any, "INSTRUCTOR");
  const isInstructor = user.memberId === clazz.instructor?.memberId;

  return (
    <div className="space-y-6">
      <Link
        href={`/${gymSlug}/admin/schedule`}
        className="text-sm text-white/70 hover:text-white"
      >
        ← Back to schedule
      </Link>

      <div className="border border-white/10 rounded-xl p-6 space-y-6">
        <div>
          <h1 className="text-lg font-semibold">{clazz.name || "Class"}</h1>
          {dateStr && (
            <p className="text-sm text-white/70 mt-1">{dateStr}</p>
          )}
          {timeStr && (
            <p className="text-sm text-white/70">{timeStr}</p>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-1">
              Instructor
            </h2>
            <p className="text-sm">{instructorName}</p>
          </div>

          {isGraduation ? (
            graduationSnapshot ? (
              <GraduationListView
                snapshot={graduationSnapshot as SavedSnapshot}
                gymSlug={gymSlug}
                classId={clazz.id}
                closeGraduationEvent={closeGraduationEvent}
              />
            ) : (
              <div>
                <h2 className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-1">
                  Graduation list
                </h2>
                <p className="text-sm text-white/60">
                  No graduation list associated with this event. Create one from the candidates list and link it via &quot;Save graduation&quot;.
                </p>
              </div>
            )
          ) : (
            <>
              <div>
                <h2 className="text-xs font-semibold text-white/80 uppercase tracking-wide mb-2">
                  Signed up ({clazz.checkIns.length})
                </h2>
                {clazz.checkIns.length === 0 ? (
                  <p className="text-sm text-white/60">No sign-ups yet</p>
                ) : canSeeNames ? (
                  <ul className="space-y-1">
                    {clazz.checkIns.map((ci) => {
                      const name =
                        ci.member.firstName || ci.member.lastName
                          ? `${ci.member.firstName} ${ci.member.lastName}`.trim()
                          : ci.member.email ?? "Unknown";
                      return (
                        <li
                          key={ci.id}
                          className="text-sm flex items-center gap-2"
                        >
                          {isInstructor && !clazz.attendanceConfirmedAt ? (
                            <form
                              action={setCheckInAttended}
                              className="flex items-center"
                            >
                              <input
                                type="hidden"
                                name="checkInId"
                                value={ci.id}
                              />
                              <input
                                type="hidden"
                                name="attended"
                                value={ci.attended ? "false" : "true"}
                              />
                              <button
                                type="submit"
                                className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                                  ci.attended
                                    ? "border-green-500 bg-green-500/20 text-green-500"
                                    : "border-white/60 bg-white/5 hover:border-green-500/50 hover:bg-green-500/10"
                                }`}
                                aria-label={
                                  ci.attended
                                    ? "Mark as not attended"
                                    : "Mark as attended"
                                }
                              >
                                {ci.attended && (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    className="w-3 h-3"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </button>
                            </form>
                          ) : (
                            <span
                              className="w-4 h-4 flex items-center justify-center flex-shrink-0 rounded border border-white/20"
                              aria-label={ci.attended ? "Present" : "Absent"}
                            >
                              {ci.attended ? (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className="w-3.5 h-3.5 text-green-500"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className="w-3.5 h-3.5 text-red-500"
                                >
                                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                </svg>
                              )}
                            </span>
                          )}
                          <span>{name}</span>
                          {ci.member.email && (
                            <span className="text-white/50 text-xs">
                              ({ci.member.email})
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-white/60">
                    {clazz.checkIns.length} signed up
                  </p>
                )}
              </div>

              {isInstructor && !clazz.attendanceConfirmedAt && (
                <form action={confirmClassAttendance}>
                  <input type="hidden" name="classId" value={clazz.id} />
                  <input type="hidden" name="gymSlug" value={gymSlug} />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-md bg-green-600/80 text-sm font-medium hover:bg-green-600"
                  >
                    Confirm attendance
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
