import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { requireGroupAdmin } from "@/src/server/auth/dal";
import { finalizeSeason } from "@/src/server/scoring";
import { routeError } from "../../bridge";

// PUENTE (W0-C): delega en finalizeSeason (stub hasta W1-1, idempotente).
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { groupId, seasonId } = body ?? {};
    if (!groupId || typeof groupId !== "string" || !seasonId || typeof seasonId !== "string") {
      return NextResponse.json({ error: "Faltan datos de la temporada." }, { status: 400 });
    }
    await requireGroupAdmin(groupId);

    const season = await prisma.season.findFirst({ where: { id: seasonId, groupId }, select: { id: true } });
    if (!season) {
      return NextResponse.json({ error: "No encontramos la temporada." }, { status: 404 });
    }

    await finalizeSeason(seasonId, { publish: true });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return routeError(err, "No se pudo finalizar la temporada.");
  }
}
