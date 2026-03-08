import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGymAndUserForApi } from "@/lib/gymAuth";

export type UpcomingGraduationItem = {
  id: string;
  name: string | null;
  startAt: string;
  locationName?: string | null;
};

export async function GET(
  _req: Request,
  context: { params: Promise<{ gymSlug: string }> },
) {
  const { gymSlug } = await context.params;
  const authResult = await getGymAndUserForApi(gymSlug);
  if ("error" in authResult) return authResult.response;

  const { gym } = authResult;
  const now = new Date();
  const classes = await prisma.class.findMany({
    where: {
      gymId: gym.id,
      mainCategory: "GRADUATION",
      startAt: { gt: now },
    },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      name: true,
      startAt: true,
      location: { select: { name: true } },
    },
  });

  const items: UpcomingGraduationItem[] = classes
    .filter((c): c is typeof c & { startAt: Date } => c.startAt != null)
    .map((c) => ({
      id: c.id,
      name: c.name,
      startAt: c.startAt.toISOString(),
      locationName: c.location?.name ?? null,
    }));

  return NextResponse.json({ items });
}
