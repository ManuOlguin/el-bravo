/** Ciclo de vida de temporadas (roadmap D3): estado derivado y finalización automática. */
import { prisma } from "@/src/lib/db";
import { dbDateToLocalDate, localDateOf } from "@/src/lib/time";
import { finalizeSeason } from "@/src/server/scoring/recompute";
import { seasonStatus, type SeasonStatus } from "./status";

type SeasonForStatus = { startDate: Date; endDate: Date; finalizedAt: Date | null; group: { timezone: string } };

/** Estado de una temporada leída de la DB, con la fecha local de hoy en la zona de su grupo. */
export function statusOfDbSeason(s: SeasonForStatus, now: Date = new Date()): SeasonStatus {
  return seasonStatus(
    { startDate: dbDateToLocalDate(s.startDate), endDate: dbDateToLocalDate(s.endDate), finalizedAt: s.finalizedAt },
    localDateOf(now, s.group.timezone)
  );
}

/** Respaldo del cron: si la temporada terminó y publica sola (`resultsReveal: auto`), la finaliza. Idempotente. */
export async function finalizeSeasonIfDue(seasonId: string, now: Date = new Date()): Promise<boolean> {
  const s = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { startDate: true, endDate: true, finalizedAt: true, resultsReveal: true, group: { select: { timezone: true } } },
  });
  if (!s || s.resultsReveal !== "auto" || statusOfDbSeason(s, now) !== "ended") return false;
  await finalizeSeason(seasonId, { publish: true, now });
  return true;
}

/** Cron diario: finaliza y publica todas las temporadas `auto` que ya terminaron en la zona de su grupo. */
export async function finalizeDueSeasons(now: Date = new Date()): Promise<string[]> {
  // Prefiltro en UTC (endDate es medianoche UTC de la fecha local); el filtro exacto es por zona del grupo.
  const candidates = await prisma.season.findMany({
    where: { finalizedAt: null, resultsReveal: "auto", endDate: { lt: new Date(now.getTime() + 86_400_000) } },
    select: { id: true, startDate: true, endDate: true, finalizedAt: true, group: { select: { timezone: true } } },
    orderBy: { endDate: "asc" },
  });
  const done: string[] = [];
  for (const s of candidates) {
    if (statusOfDbSeason(s, now) !== "ended") continue;
    try {
      await finalizeSeason(s.id, { publish: true, now });
      done.push(s.id);
    } catch (e) {
      console.error("[cron seasons] no se pudo finalizar", s.id, e); // una temporada rota no frena al resto
    }
  }
  return done;
}
