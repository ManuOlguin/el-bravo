import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { startedAt, endedAt, notes } = body ?? {};
    if (!startedAt || !endedAt) return NextResponse.json({ error: 'Start and end required' }, { status: 400 });
    const s = new Date(startedAt);
    const e = new Date(endedAt);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s >= e) return NextResponse.json({ error: 'Invalid dates' }, { status: 400 });

    const created = await prisma.activity.create({ data: { userId: user.id, startedAt: s, endedAt: e, notes: notes ?? null, type: "gym" } });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    console.error('/api/activities/create error:', err);
    return NextResponse.json({ error: 'Error creating activity' }, { status: 500 });
  }
}
