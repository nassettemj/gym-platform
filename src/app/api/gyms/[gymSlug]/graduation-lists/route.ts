import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function POST(
  req: Request,
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

  let body: { classId: string; snapshot: unknown };
  try {
    body = await req.json();
    if (!body || typeof body.classId !== "string" || body.snapshot === undefined) {
      return new NextResponse("Bad request", { status: 400 });
    }
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  const classRecord = await prisma.class.findFirst({
    where: { id: body.classId, gymId: gym.id },
    select: { id: true },
  });

  if (!classRecord) {
    return new NextResponse("Class not found", { status: 404 });
  }

  await prisma.graduationList.upsert({
    where: { classId: body.classId },
    create: {
      classId: body.classId,
      gymId: gym.id,
      snapshot: body.snapshot as object,
    },
    update: { snapshot: body.snapshot as object },
  });

  return NextResponse.json({ ok: true });
}
