import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { startedAt, endedAt, notes, routineId, type } = body ?? {};
    if (!startedAt || !endedAt) return NextResponse.json({ error: 'Start and end required' }, { status: 400 });
    const s = new Date(startedAt);
    const e = new Date(endedAt);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s >= e) return NextResponse.json({ error: 'Invalid dates' }, { status: 400 });

    const validTypes = ['gym','run','sport','mobility','other'];
    if (!type || typeof type !== 'string' || !validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid or missing activity type' }, { status: 400 });
    }

    const data: any = { userId: user.id, startedAt: s, endedAt: e, notes: notes ?? null, type };
    if (routineId) {
      const routine = await prisma.routine.findUnique({ where: { id: routineId } });
      if (!routine || routine.userId !== user.id) return NextResponse.json({ error: 'Invalid routine' }, { status: 400 });
      data.routineId = routineId;
    }

    const created = await prisma.activity.create({ data });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (err) {
    console.error('/api/activities/create error:', err);
    return NextResponse.json({ error: 'Error creating activity' }, { status: 500 });
  }
}
