import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { dbDateToLocalDate, localDateOf, localDateToDbDate } from "@/src/lib/time";
import { requireGroupAdmin } from "@/src/server/auth/dal";
import { recomputeSeason } from "@/src/server/scoring";
import { routeError, isLocalDate } from "../../bridge";

// PUENTE (W0-C): fechas locales (@db.Date) + SeasonCategory (peso 1) y recálculo. W1-1/W2-2 lo reemplazan.

function normalizeIds(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.filter((v): v is string => typeof v === "string" && v.trim().length > 0)));
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { groupId, seasonId, name, startDate, endDate, minPerWeek, allowedActivityCategoryIds, description } = body ?? {};

    if (!groupId || typeof groupId !== "string" || !seasonId || typeof seasonId !== "string") {
      return NextResponse.json({ error: "Faltan datos de la temporada." }, { status: 400 });
    }
    await requireGroupAdmin(groupId);

    if (!name || typeof name !== "string" || !name.trim() || !isLocalDate(startDate) || !isLocalDate(endDate)) {
      return NextResponse.json({ error: "Completá el nombre y las fechas." }, { status: 400 });
    }

    const season = await prisma.season.findFirst({
      where: { id: seasonId, groupId },
      select: { id: true, endDate: true, finalizedAt: true, group: { select: { timezone: true } } },
    });
    if (!season) {
      return NextResponse.json({ error: "No encontramos la temporada." }, { status: 404 });
    }
    const today = localDateOf(new Date(), season.group.timezone);
    if (season.finalizedAt || dbDateToLocalDate(season.endDate) < today) {
      return NextResponse.json({ error: "La temporada ya terminó." }, { status: 400 });
    }

    if (startDate > endDate) {
      return NextResponse.json({ error: "La fecha de fin tiene que ser posterior al inicio." }, { status: 400 });
    }

    const weeklyGoal = Number(minPerWeek);
    if (!Number.isInteger(weeklyGoal) || weeklyGoal < 1 || weeklyGoal > 7) {
      return NextResponse.json({ error: "El objetivo semanal tiene que ser entre 1 y 7 días." }, { status: 400 });
    }

    const ids = normalizeIds(allowedActivityCategoryIds);
    if (ids.length === 0) {
      return NextResponse.json({ error: "Elegí al menos un tipo de actividad." }, { status: 400 });
    }
    const categories = await prisma.activityCategory.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true },
    });
    if (categories.length !== ids.length) {
      return NextResponse.json({ error: "Algún tipo de actividad no es válido." }, { status: 400 });
    }

    await prisma.season.update({
      where: { id: seasonId },
      data: {
        name: name.trim().slice(0, 80),
        description: typeof description === "string" && description.trim().length > 0 ? description.trim() : null,
        startDate: localDateToDbDate(startDate),
        endDate: localDateToDbDate(endDate),
        weeklyGoal,
        categories: {
          deleteMany: {},
          create: categories.map((c) => ({ activityCategoryId: c.id, weight: 1 })),
        },
      },
    });
    await recomputeSeason(seasonId);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    return routeError(err, "No se pudo actualizar la temporada.");
  }
}
