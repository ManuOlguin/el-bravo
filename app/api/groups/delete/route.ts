import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { groupId } = body ?? {};

    if (!groupId || typeof groupId !== "string") {
      return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
    }

    // Validar que sea admin activo en ese grupo
    const membership = await prisma.groupMember.findFirst({
      where: { groupId, userId: user.id, leftAt: null },
      select: { id: true, role: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member" }, { status: 403 });
    }

    if (membership.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Hard delete: borra TODO lo relacionado al grupo
    await prisma.$transaction(async (tx) => {
      await tx.seasonMember.deleteMany({
        where: { season: { groupId } },
      });

      await tx.season.deleteMany({
        where: { groupId },
      });

      await tx.groupMember.deleteMany({
        where: { groupId },
      });

      await tx.group.delete({
        where: { id: groupId },
      });
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("/api/groups/delete error:", err);

    // Si llegara a fallar por FK/restricciones, devolvemos un mensaje simple
    return NextResponse.json(
      { error: "Error deleting group" },
      { status: 500 }
    );
  }
}
