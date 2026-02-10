import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";

function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // "123456"
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { groupId, regenerate } = body ?? {};

    if (!groupId || typeof groupId !== "string") {
      return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
    }

    // validar admin activo
    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId: user.id, leftAt: null },
      select: { role: true },
    });

    if (!membership || membership.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();

    // si ya existe y no expiró, devolverlo (salvo regenerate)
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { inviteCode: true, inviteCodeExpiresAt: true },
    });

    const stillValid =
      group?.inviteCode &&
      (!group.inviteCodeExpiresAt || group.inviteCodeExpiresAt.getTime() > now.getTime());

    if (stillValid && !regenerate) {
      return NextResponse.json(
        { code: group!.inviteCode, expiresAt: group!.inviteCodeExpiresAt },
        { status: 200 }
      );
    }

    const rawTtl = process.env.GROUP_INVITE_TTL_DAYS;
    const ttlDaysParsed = Number.parseInt(rawTtl ?? "7", 10);
    const ttlDays = Number.isFinite(ttlDaysParsed) ? ttlDaysParsed : 7;

    const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);


    let code = generate6DigitCode();

    for (let i = 0; i < 5; i++) {
      try {
        const updated = await prisma.group.update({
          where: { id: groupId },
          data: { inviteCode: code, inviteCodeExpiresAt: expiresAt },
          select: { inviteCode: true, inviteCodeExpiresAt: true },
        });

        return NextResponse.json(
          { code: updated.inviteCode, expiresAt: updated.inviteCodeExpiresAt },
          { status: 200 }
        );
      } catch (e: any) {
        // si chocó el unique, reintenta con otro code
        code = generate6DigitCode();
      }
    }

    return NextResponse.json({ error: "Could not generate code" }, { status: 500 });
  } catch (err) {
    console.error("/api/groups/invite-code error:", err);
    return NextResponse.json({ error: "Error generating invite code" }, { status: 500 });
  }
}
