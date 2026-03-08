import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

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
  const session = await auth();
  const user = session?.user as { role?: string; gymId?: string } | undefined;

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const gym = await prisma.gym.findUnique({
    where: { slug: gymSlug },
    select: { id: true },
  });

  if (!gym) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== gym.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

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
