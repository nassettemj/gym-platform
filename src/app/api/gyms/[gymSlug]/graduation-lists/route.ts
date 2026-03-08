import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGymAndUserForApi } from "@/lib/gymAuth";

export async function POST(
  req: Request,
  context: { params: Promise<{ gymSlug: string }> },
) {
  const { gymSlug } = await context.params;
  const authResult = await getGymAndUserForApi(gymSlug);
  if ("error" in authResult) return authResult.response;

  const { gym } = authResult;

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
