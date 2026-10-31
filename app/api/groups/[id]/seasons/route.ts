import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;

  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        leftAt: null,
      },
      select: { id: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const seasons = await prisma.season.findMany({
      where: { groupId },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        finalizedAt: true,
      },
    });

    return NextResponse.json(seasons, { status: 200 });
  } catch (err) {
    console.error("/api/groups/[id]/seasons GET error:", err);
    return NextResponse.json(
      { error: "Error loading seasons" },
      { status: 500 }
    );
  }
}