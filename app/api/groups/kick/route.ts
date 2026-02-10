import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { groupId, userId } = body ?? {};

    if (!groupId || typeof groupId !== "string") {
      return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
    }
    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    if (userId === user.id) {
      return NextResponse.json({ error: "No podés expulsarte a vos mismo" }, { status: 400 });
    }

    // Admin del grupo
    const adminMembership = await prisma.groupMember.findFirst({
      where: { groupId, userId: user.id, leftAt: null },
      select: { role: true },
    });

    if (!adminMembership) return NextResponse.json({ error: "Not a member" }, { status: 400 });
    if (adminMembership.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Membresía del target
    const targetMembership = await prisma.groupMember.findFirst({
      where: { groupId, userId, leftAt: null },
      select: { id: true, role: true },
    });

    if (!targetMembership) {
      return NextResponse.json({ error: "Ese usuario no es miembro activo" }, { status: 400 });
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.groupMember.update({
        where: { id: targetMembership.id },
        data: { leftAt: now },
      }),
      prisma.seasonMember.updateMany({
        where: {
          userId,
          leftAt: null,
          season: { groupId },
        },
        data: { leftAt: now },
      }),
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("/api/groups/kick error:", err);
    return NextResponse.json({ error: "Error kicking member" }, { status: 500 });
  }
}
