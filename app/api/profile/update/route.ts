import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, photoUrl } = body ?? {};

    if (!name || typeof name !== 'string') return NextResponse.json({ error: 'Invalid name' }, { status: 400 });

    const updated = await prisma.user.update({ where: { id: user.id }, data: { name: name.trim(), photoUrl: photoUrl ?? null } });

    return NextResponse.json({ id: updated.id }, { status: 200 });
  } catch (err) {
    console.error('/api/profile/update error:', err);
    return NextResponse.json({ error: 'Error updating profile' }, { status: 500 });
  }
}
