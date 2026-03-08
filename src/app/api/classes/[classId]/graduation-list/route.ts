import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import type { AuthUser } from "@/types/auth";

export async function GET(
  _req: Request,
  context: { params: Promise<{ classId: string }> },
) {
  const { classId } = await context.params;
  const session = await auth();
  const user = session?.user as AuthUser | undefined;

  if (!user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const list = await prisma.graduationList.findUnique({
    where: { classId },
    select: { snapshot: true, class: { select: { gymId: true } } },
  });

  if (!list) {
    return new NextResponse(null, { status: 404 });
  }

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== list.class.gymId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return NextResponse.json({ snapshot: list.snapshot });
}
