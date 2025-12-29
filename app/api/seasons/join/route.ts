import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { seasonId } = body ?? {};
    if (!seasonId) return NextResponse.json({ error: "Missing seasonId" }, { status: 400 });

    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });
    const now = new Date();
    if (!(new Date(season.startDate) > now)) return NextResponse.json({ error: "Inscription closed" }, { status: 400 });

    // Check any existing membership (including previously left)
    const existingAny = await prisma.seasonMember.findFirst({ where: { seasonId, userId: user.id } });
    if (existingAny) {
      if (existingAny.leftAt) {
        // user had left before: reactivate by clearing leftAt
        await prisma.seasonMember.update({ where: { id: existingAny.id }, data: { leftAt: null } });
        return NextResponse.json({ ok: true }, { status: 200 });
      }
      // already active
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    await prisma.seasonMember.create({ data: { seasonId, userId: user.id } });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('/api/seasons/join error', err);
    return NextResponse.json({ error: 'Error joining season' }, { status: 500 });
  }
}
