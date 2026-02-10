import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { groupId, seasonId, name, startDate, endDate, minPerWeek } = body ?? {};

    if (!groupId || !seasonId) {
      return NextResponse.json({ error: "Missing ids" }, { status: 400 });
    }
    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const membership = await prisma.groupMember.findFirst({
      where: { userId: user.id, groupId, leftAt: null },
      select: { role: true },
    });
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });
    if (membership.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const season = await prisma.season.findFirst({
      where: { id: seasonId, groupId },
      select: { id: true, endDate: true },
    });
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });

    // No permitir editar si ya terminó
    if (new Date(season.endDate).getTime() < Date.now()) {
      return NextResponse.json({ error: "Season finished" }, { status: 400 });
    }

    function parseDateOnly(value: string) {
      const [y, m, d] = value.split("-").map(Number);
      // Date-only estable: lo guardamos al MEDIODÍA UTC para evitar saltos por TZ
      return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    }

    const start = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
    }

    const mpw = Number(minPerWeek);
    if (!Number.isFinite(mpw) || mpw < 1) {
      return NextResponse.json({ error: "Invalid minPerWeek" }, { status: 400 });
    }

    await prisma.season.update({
      where: { id: seasonId },
      data: {
        name: String(name).trim(),
        startDate: start,
        endDate: end,
        minPerWeek: mpw,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("/api/seasons/update error:", err);
    return NextResponse.json({ error: "Error updating season" }, { status: 500 });
  }
}
