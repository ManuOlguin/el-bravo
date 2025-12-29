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

    const membership = await prisma.seasonMember.findFirst({ where: { seasonId, userId: user.id, leftAt: null } });
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 400 });

    // check season status to allow leaving only during waiting (inscription) or maybe allow always — here we restrict to waiting
    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) return NextResponse.json({ error: "Season not found" }, { status: 404 });
    const now = new Date();
    if (!(new Date(season.startDate) > now)) return NextResponse.json({ error: "Cannot leave after start" }, { status: 400 });

    await prisma.seasonMember.update({ where: { id: membership.id }, data: { leftAt: new Date() } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('/api/seasons/leave error', err);
    return NextResponse.json({ error: 'Error leaving season' }, { status: 500 });
  }
}
