import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { code } = body ?? {};

    if (!code || typeof code !== "string" || !/^[0-9]{6}$/.test(code)) {
      return NextResponse.json({ error: "Código inválido" }, { status: 400 });
    }

    const now = new Date();

    const group = await prisma.group.findFirst({
      where: {
        inviteCode: code,
        OR: [
          { inviteCodeExpiresAt: null },
          { inviteCodeExpiresAt: { gt: now } },
        ],
      },
      select: { id: true },
    });

    if (!group) {
      return NextResponse.json({ error: "Código inválido o expirado" }, { status: 400 });
    }

    // Ya sos miembro activo?
    const existingActive = await prisma.groupMember.findFirst({
      where: { groupId: group.id, userId: user.id, leftAt: null },
      select: { id: true },
    });

    if (existingActive) {
      return NextResponse.json({ error: "Ya sos miembro de este grupo" }, { status: 400 });
    }

    // Rejoin si ya existía registro con leftAt != null (por @@unique(groupId,userId))
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: user.id } },
      create: {
        groupId: group.id,
        userId: user.id,
        role: "member",
      },
      update: {
        leftAt: null,
        joinedAt: now,
      },
    });

    return NextResponse.json({ ok: true, groupId: group.id }, { status: 200 });
  } catch (err) {
    console.error("/api/groups/join error:", err);
    return NextResponse.json({ error: "Error joining group" }, { status: 500 });
  }
}
