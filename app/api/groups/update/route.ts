import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, name, photoUrl } = body ?? {};

    if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Group id required' }, { status: 400 });
    if (!name || typeof name !== 'string' || !name.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    // ensure the user is an admin of the group
    const membership = await prisma.groupMember.findFirst({ where: { userId: user.id, groupId: id, role: 'admin', leftAt: null } });
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const updated = await prisma.group.update({ where: { id }, data: { name: name.trim(), photoUrl: photoUrl ?? null } });

    return NextResponse.json({ id: updated.id }, { status: 200 });
  } catch (err) {
    console.error('/api/groups/update error:', err);
    return NextResponse.json({ error: 'Error updating group' }, { status: 500 });
  }
}
