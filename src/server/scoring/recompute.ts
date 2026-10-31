/**
 * Recálculo transaccional de temporadas (roadmap D1/D3, contrato §5.5).
 * Toda mutación que afecta puntos (actividades, temporada, membresía, cron) termina acá.
 *
 * Sin `import "server-only"` a propósito: `scripts/migrate-v2-data.ts` importa este módulo desde tsx.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { dbDateToLocalDate, localDateOf } from "@/src/lib/time";
import type { ActivityChange } from "@/src/server/activities/effects";
import { computeSeasonScores, rankTotals } from "./compute";
import { computeAwardWinners, isSeasonAwardType } from "./awards";
import type { ScoringEffect, SeasonRules, SeasonScores, UserTotals, ScoringActivity } from "./types";

type Tx = Prisma.TransactionClient;
const TX_OPTS = { timeout: 15000, maxWait: 10000 } as const;

/** Bloquea la fila de la temporada hasta el fin de la transacción (serializa recálculos y finalización). */
async function lockSeason(tx: Tx, seasonId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM \`Season\` WHERE id = ${seasonId} FOR UPDATE`;
  return rows.length > 0;
}

async function loadSeasonInput(tx: Tx, seasonId: string) {
  const s = await tx.season.findUniqueOrThrow({
    where: { id: seasonId },
    include: {
      group: { select: { timezone: true, name: true } },
      categories: true,
      members: { where: { leftAt: null }, select: { userId: true } },
      awards: true,
    },
  });
  const rules: SeasonRules = {
    startDate: dbDateToLocalDate(s.startDate),
    endDate: dbDateToLocalDate(s.endDate),
    timezone: s.group.timezone,
    weeklyGoal: s.weeklyGoal,
    minDailyMinutes: s.minDailyMinutes,
    dayBasePoints: s.dayBasePoints,
    timePointsFactor: s.timePointsFactor,
    timeCurveMinutes: s.timeCurveMinutes,
    maxDailyMinutes: s.maxDailyMinutes,
    weeklyGoalBonus: s.weeklyGoalBonus,
    streakBonusStep: s.streakBonusStep,
    streakBonusCap: s.streakBonusCap,
    categoryWeights: Object.fromEntries(s.categories.map((c) => [c.activityCategoryId, Number(c.weight)])),
  };
  const memberIds = s.members.map((m) => m.userId);
  // Margen de ±1 día en UTC para cubrir cualquier zona horaria; compute filtra por día local.
  const from = new Date(s.startDate.getTime() - 86_400_000);
  const to = new Date(s.endDate.getTime() + 2 * 86_400_000);
  const activities: ScoringActivity[] = memberIds.length
    ? await tx.activity.findMany({
        where: { userId: { in: memberIds }, startedAt: { gte: from, lt: to } },
        select: { id: true, userId: true, activityCategoryId: true, startedAt: true, durationMinutes: true },
      })
    : [];
  return { season: s, rules, memberIds, activities };
}

/** Reescribe los standings sumando los puntos de premios ya otorgados (`ScoreEntry` kind `award`). */
async function writeStandings(tx: Tx, seasonId: string, totals: UserTotals[]) {
  const awardRows = await tx.scoreEntry.groupBy({
    by: ["userId"],
    where: { seasonId, kind: "award" },
    _sum: { points: true },
  });
  const award = new Map(awardRows.map((r) => [r.userId, r._sum.points ?? 0]));
  const ranked = rankTotals(totals.map((t) => ({ ...t, points: t.points + (award.get(t.userId) ?? 0) })));
  await tx.seasonStanding.deleteMany({ where: { seasonId } });
  if (ranked.length) {
    await tx.seasonStanding.createMany({
      data: ranked.map((t) => ({
        seasonId,
        userId: t.userId,
        rank: t.rank,
        points: t.points,
        daysTrained: t.daysTrained,
        activities: t.activities,
        minutes: t.minutes,
        weeksGoalMet: t.weeksGoalMet,
        currentStreak: t.currentStreak,
        bestStreak: t.bestStreak,
      })),
    });
  }
}

/** Recalcula dentro de una transacción que ya tiene la fila bloqueada. No mira `finalizedAt`. */
async function recomputeWithin(tx: Tx, seasonId: string, now: Date) {
  const input = await loadSeasonInput(tx, seasonId);
  const scores = computeSeasonScores(input.rules, input.memberIds, input.activities, now);
  await tx.scoreEntry.deleteMany({ where: { seasonId, kind: { not: "award" } } });
  if (scores.lines.length) {
    await tx.scoreEntry.createMany({
      data: scores.lines.map((l) => ({
        seasonId,
        userId: l.userId,
        activityId: l.activityId,
        kind: l.kind,
        weekKey: l.weekKey,
        points: l.points,
        reason: l.reason,
        detail: l.detail ? (l.detail as Prisma.InputJsonValue) : Prisma.DbNull,
      })),
    });
  }
  await writeStandings(tx, seasonId, scores.totals);
  await tx.season.update({ where: { id: seasonId }, data: { lastComputedAt: now } });
  return { ...input, scores };
}

/**
 * Recalcula la temporada completa. Si está finalizada no hace nada (resultados congelados),
 * salvo con `force` (reabrir, solo admin).
 */
export async function recomputeSeason(seasonId: string, opts: { force?: boolean; now?: Date } = {}): Promise<void> {
  const now = opts.now ?? new Date();
  await prisma.$transaction(async (tx) => {
    if (!(await lockSeason(tx, seasonId))) return;
    const s = await tx.season.findUniqueOrThrow({ where: { id: seasonId }, select: { finalizedAt: true } });
    if (s.finalizedAt && !opts.force) return;
    await recomputeWithin(tx, seasonId, now);
  }, TX_OPTS);
}

/**
 * Recalcula las temporadas afectadas por un cambio de actividad: las de los grupos donde el usuario
 * es miembro activo de la temporada y cuyo rango cubre la fecha local (zona del grupo) de `before` o `after`.
 * Las temporadas finalizadas se saltean. Devuelve un efecto por temporada recalculada.
 */
export async function recomputeSeasonsForChange(change: ActivityChange, opts: { now?: Date } = {}): Promise<ScoringEffect[]> {
  const snaps = [change.before, change.after].filter((x): x is NonNullable<typeof x> => !!x);
  if (!snaps.length) return [];
  // Prefiltro en UTC con margen holgado; el filtro exacto por fecha local (zona del grupo) va abajo.
  const times = snaps.map((a) => a.startedAt.getTime());
  const maxDay = new Date(Math.max(...times) + 86_400_000);
  const minDay = new Date(Math.min(...times) - 2 * 86_400_000);

  const memberships = await prisma.seasonMember.findMany({
    where: {
      userId: change.userId,
      leftAt: null,
      season: { finalizedAt: null, startDate: { lte: maxDay }, endDate: { gte: minDay } },
    },
    select: {
      season: {
        select: { id: true, name: true, groupId: true, startDate: true, endDate: true, group: { select: { name: true, timezone: true } } },
      },
    },
  });

  const seasons = memberships
    .map((m) => m.season)
    .filter((s) => {
      const start = dbDateToLocalDate(s.startDate);
      const end = dbDateToLocalDate(s.endDate);
      return snaps.some((a) => {
        const d = localDateOf(a.startedAt, s.group.timezone);
        return d >= start && d <= end;
      });
    })
    .sort((a, b) => a.id.localeCompare(b.id)); // orden fijo de locks entre recálculos concurrentes

  const activityId = (change.after ?? change.before)!.id;
  const effects: ScoringEffect[] = [];
  for (const s of seasons) {
    const before = await prisma.seasonStanding.findUnique({
      where: { seasonId_userId: { seasonId: s.id, userId: change.userId } },
      select: { points: true, rank: true },
    });
    await recomputeSeason(s.id, { now: opts.now });
    const [after, entry] = await Promise.all([
      prisma.seasonStanding.findUnique({
        where: { seasonId_userId: { seasonId: s.id, userId: change.userId } },
        select: { points: true, rank: true },
      }),
      change.after
        ? prisma.scoreEntry.findFirst({ where: { seasonId: s.id, activityId, kind: "workout" }, select: { points: true, reason: true } })
        : null,
    ]);
    effects.push({
      seasonId: s.id,
      seasonName: s.name,
      groupId: s.groupId,
      groupName: s.group.name,
      activityPoints: entry?.points ?? 0,
      activityReason: entry?.reason ?? null,
      totalBefore: before?.points ?? 0,
      totalAfter: after?.points ?? 0,
      rankBefore: before?.rank ?? null,
      rankAfter: after?.rank ?? 0,
    });
  }
  return effects;
}

/**
 * Finaliza la temporada: recalcula, otorga premios y congela resultados. Idempotente y seguro en paralelo
 * (lock de fila + chequeo de `finalizedAt` dentro de la transacción).
 */
export async function finalizeSeason(seasonId: string, opts: { publish: boolean; now?: Date }): Promise<void> {
  const now = opts.now ?? new Date();
  await prisma.$transaction(async (tx) => {
    if (!(await lockSeason(tx, seasonId))) return;
    const current = await tx.season.findUniqueOrThrow({ where: { id: seasonId }, select: { finalizedAt: true } });
    if (current.finalizedAt) return;

    // Estado limpio de premios (por si quedó algo de una reapertura a medias).
    await tx.scoreEntry.deleteMany({ where: { seasonId, kind: "award" } });
    await tx.seasonAwardWinner.deleteMany({ where: { seasonAward: { seasonId } } });

    const { season, rules, activities, scores } = await recomputeWithin(tx, seasonId, now);
    await grantAwards(tx, seasonId, season.awards, scores, activities, rules);
    await writeStandings(tx, seasonId, scores.totals);
    await tx.season.update({
      where: { id: seasonId },
      data: { finalizedAt: now, ...(opts.publish ? { resultsPublishedAt: now } : {}) },
    });
  }, TX_OPTS);
}

async function grantAwards(
  tx: Tx,
  seasonId: string,
  awards: { id: string; awardType: string; bonusPoints: number }[],
  scores: SeasonScores,
  activities: ScoringActivity[],
  rules: SeasonRules
) {
  for (const award of awards) {
    if (!isSeasonAwardType(award.awardType)) continue;
    const winners = computeAwardWinners(award.awardType, scores, activities, rules);
    if (!winners.length) continue;
    await tx.seasonAwardWinner.createMany({
      data: winners.map((w) => ({ seasonAwardId: award.id, userId: w.userId, value: w.value })),
    });
    if (award.bonusPoints > 0) {
      await tx.scoreEntry.createMany({
        data: winners.map((w) => ({
          seasonId,
          userId: w.userId,
          kind: "award" as const,
          points: award.bonusPoints,
          reason: `Premio: ${award.awardType}`,
          detail: { awardType: award.awardType, value: w.value } as Prisma.InputJsonValue,
        })),
      });
    }
  }
}

/** Publica los resultados de una temporada con `resultsReveal: manual`. Idempotente. */
export async function publishSeasonResults(seasonId: string, opts: { now?: Date } = {}): Promise<void> {
  await prisma.season.updateMany({
    where: { id: seasonId, resultsPublishedAt: null },
    data: { resultsPublishedAt: opts.now ?? new Date() },
  });
}

/**
 * Reabre una temporada finalizada (solo admin, lo valida la acción): borra premios otorgados,
 * `finalizedAt`/`resultsPublishedAt` y recalcula.
 */
export async function reopenSeason(seasonId: string, opts: { now?: Date } = {}): Promise<void> {
  const now = opts.now ?? new Date();
  await prisma.$transaction(async (tx) => {
    if (!(await lockSeason(tx, seasonId))) return;
    await tx.scoreEntry.deleteMany({ where: { seasonId, kind: "award" } });
    await tx.seasonAwardWinner.deleteMany({ where: { seasonAward: { seasonId } } });
    await tx.season.update({ where: { id: seasonId }, data: { finalizedAt: null, resultsPublishedAt: null } });
    await recomputeWithin(tx, seasonId, now);
  }, TX_OPTS);
}
