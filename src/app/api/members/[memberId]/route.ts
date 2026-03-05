import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(
  _req: Request,
  context: { params: Promise<{ memberId: string }> },
) {
  const { memberId } = await context.params;
  const session = await auth();
  const user = session?.user as any;

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      firstName: true,
      lastName: true,
      gymId: true,
    },
  });

  if (!member) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (user.role !== "PLATFORM_ADMIN" && user.gymId !== member.gymId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const name = `${member.firstName} ${member.lastName}`.trim();

  return NextResponse.json({ name });
}

