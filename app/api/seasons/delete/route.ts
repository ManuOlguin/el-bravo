import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { seasonId } = body ?? {};

    if (!seasonId || typeof seasonId !== "string") {
      return NextResponse.json({ error: "Missing seasonId" }, { status: 400 });
    }

    // Traigo temporada + groupId
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true, groupId: true },
    });

    if (!season) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }

    // Validar admin del grupo
    const membership = await prisma.groupMember.findFirst({
      where: { groupId: season.groupId, userId: user.id, leftAt: null },
      select: { role: true },
    });

    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 400 });
    if (membership.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await prisma.$transaction([
      prisma.seasonMember.deleteMany({ where: { seasonId } }),
      prisma.season.delete({ where: { id: seasonId } }),
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("/api/seasons/delete error:", err);
    return NextResponse.json({ error: "Error deleting season" }, { status: 500 });
  }
}
