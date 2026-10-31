"use server";
/**
 * Server Actions de temporadas (roadmap D3/D10, plan W1-1 Task 4).
 * Toda mutación que afecta puntos termina en `recomputeSeason` (o finalizar/reabrir, que recalculan adentro).
 */
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { localDateToDbDate } from "@/src/lib/time";
import { requireGroupAdmin, requireGroupMember, AuthError } from "@/src/server/auth/dal";
import { ok, fail, parseInput, runAction, type ActionResult } from "@/src/server/http/result";
import { seasonInputSchema, type SeasonInput } from "@/src/schemas/season";
import { recomputeSeason, finalizeSeason, publishSeasonResults, reopenSeason } from "@/src/server/scoring/recompute";
import { statusOfDbSeason, finalizeSeasonIfDue } from "@/src/server/seasons/lifecycle";
import { emitSeasonPublished } from "@/src/server/notifications";

/** Las notificaciones nunca rompen la acción; el cron de notificaciones reintenta. */
async function notifySeasonPublished(seasonId: string) {
  try {
    await emitSeasonPublished(seasonId);
  } catch (e) {
    console.error("[notifications] season published", e);
  }
}

type Tx = Prisma.TransactionClient;

/** Error de negocio dentro de una transacción: se traduce a `fail(message)` y hace rollback. */
class SeasonRuleError extends Error {}

const ENDED = "La temporada ya terminó";

async function loadSeason(seasonId: string) {
  const s = await prisma.season.findUnique({
    where: { id: seasonId },
    select: {
      id: true, groupId: true, startDate: true, endDate: true, finalizedAt: true, resultsReveal: true, resultsPublishedAt: true,
      group: { select: { timezone: true } },
    },
  });
  if (!s) throw new AuthError("NOT_FOUND");
  return s;
}

function revalidateGroup(groupId: string) {
  revalidatePath(`/group/${groupId}`);
}

async function lockGroup(tx: Tx, groupId: string) {
  await tx.$queryRaw`SELECT id FROM \`Group\` WHERE id = ${groupId} FOR UPDATE`;
}

async function assertNoOverlap(tx: Tx, groupId: string, start: Date, end: Date, excludeSeasonId?: string) {
  const other = await tx.season.findFirst({
    where: { groupId, ...(excludeSeasonId ? { id: { not: excludeSeasonId } } : {}), startDate: { lte: end }, endDate: { gte: start } },
    select: { name: true },
  });
  if (other) throw new SeasonRuleError(`Las fechas se superponen con la temporada "${other.name}"`);
}

async function assertCategories(tx: Tx, ids: string[]) {
  const found = await tx.activityCategory.count({ where: { id: { in: ids }, isActive: true } });
  if (found !== ids.length) throw new SeasonRuleError("Algún tipo de actividad no es válido");
}

function seasonData(d: SeasonInput) {
  return {
    name: d.name,
    description: d.description ? d.description : null,
    startDate: localDateToDbDate(d.startDate),
    endDate: localDateToDbDate(d.endDate),
    weeklyGoal: d.weeklyGoal,
    minDailyMinutes: d.minDailyMinutes,
    resultsReveal: d.resultsReveal,
    ...(d.rules ?? {}),
  };
}

async function withRules<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof SeasonRuleError) return fail(e.message);
    throw e;
  }
}

export async function createSeasonAction(input: SeasonInput): Promise<ActionResult<{ seasonId: string }>> {
  return runAction(() =>
    withRules(async () => {
      const parsed = parseInput(seasonInputSchema, input);
      if (!parsed.ok) return parsed.result;
      const d = parsed.data;
      const user = await requireGroupAdmin(d.groupId);
      const data = seasonData(d);

      const season = await prisma.$transaction(async (tx) => {
        await lockGroup(tx, d.groupId);
        await assertCategories(tx, d.categories.map((c) => c.activityCategoryId));
        await assertNoOverlap(tx, d.groupId, data.startDate, data.endDate);
        return tx.season.create({
          data: {
            ...data,
            groupId: d.groupId,
            createdBy: user.id,
            categories: { create: d.categories.map((c) => ({ activityCategoryId: c.activityCategoryId, weight: c.weight })) },
            awards: { create: d.awards.map((a) => ({ awardType: a.awardType, bonusPoints: a.bonusPoints })) },
            members: { create: [{ userId: user.id }] },
          },
          select: { id: true },
        });
      });

      await recomputeSeason(season.id);
      revalidateGroup(d.groupId);
      return ok({ seasonId: season.id }, "Temporada creada");
    })
  );
}

export async function updateSeasonAction(seasonId: string, input: SeasonInput): Promise<ActionResult<void>> {
  return runAction(() =>
    withRules(async () => {
      const parsed = parseInput(seasonInputSchema, input);
      if (!parsed.ok) return parsed.result;
      const d = parsed.data;
      const current = await loadSeason(seasonId);
      await requireGroupAdmin(current.groupId);
      if (d.groupId !== current.groupId) return fail("La temporada no es de este grupo");
      const data = seasonData(d);

      await prisma.$transaction(async (tx) => {
        await lockGroup(tx, current.groupId);
        const fresh = await tx.season.findUniqueOrThrow({ where: { id: seasonId }, select: { finalizedAt: true } });
        if (fresh.finalizedAt) throw new SeasonRuleError("La temporada está finalizada. Reabrila para editarla.");
        await assertCategories(tx, d.categories.map((c) => c.activityCategoryId));
        await assertNoOverlap(tx, current.groupId, data.startDate, data.endDate, seasonId);
        await tx.season.update({
          where: { id: seasonId },
          data: {
            ...data,
            categories: {
              deleteMany: {},
              create: d.categories.map((c) => ({ activityCategoryId: c.activityCategoryId, weight: c.weight })),
            },
            // Sin finalizar todavía no hay ganadores: reemplazar los premios es seguro.
            awards: { deleteMany: {}, create: d.awards.map((a) => ({ awardType: a.awardType, bonusPoints: a.bonusPoints })) },
          },
        });
      });

      await recomputeSeason(seasonId);
      revalidateGroup(current.groupId);
      return ok(undefined, "Temporada actualizada");
    })
  );
}

export async function deleteSeasonAction(seasonId: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    const s = await loadSeason(seasonId);
    await requireGroupAdmin(s.groupId);
    await prisma.season.delete({ where: { id: seasonId } });
    revalidateGroup(s.groupId);
    return ok(undefined, "Temporada eliminada");
  });
}

export async function joinSeasonAction(seasonId: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    const s = await loadSeason(seasonId);
    const { user } = await requireGroupMember(s.groupId);
    const status = statusOfDbSeason(s);
    if (status === "ended" || status === "finalized") return fail(ENDED);
    await prisma.seasonMember.upsert({
      where: { seasonId_userId: { seasonId, userId: user.id } },
      create: { seasonId, userId: user.id },
      update: { leftAt: null, joinedAt: new Date() },
    });
    await recomputeSeason(seasonId);
    revalidateGroup(s.groupId);
    return ok(undefined, "Te uniste a la temporada");
  });
}

export async function leaveSeasonAction(seasonId: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    const s = await loadSeason(seasonId);
    const { user } = await requireGroupMember(s.groupId);
    const status = statusOfDbSeason(s);
    if (status === "ended" || status === "finalized") return fail(ENDED);
    await prisma.seasonMember.updateMany({ where: { seasonId, userId: user.id, leftAt: null }, data: { leftAt: new Date() } });
    await recomputeSeason(seasonId);
    revalidateGroup(s.groupId);
    return ok(undefined, "Saliste de la temporada");
  });
}

/** Admin: finaliza (también antes de la fecha de fin). Publica sola si `resultsReveal` es `auto`. */
export async function finalizeSeasonAction(seasonId: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    const s = await loadSeason(seasonId);
    await requireGroupAdmin(s.groupId);
    const status = statusOfDbSeason(s);
    if (status === "upcoming") return fail("La temporada todavía no empezó");
    if (status !== "finalized") {
      await finalizeSeason(seasonId, { publish: s.resultsReveal === "auto" });
      if (s.resultsReveal === "auto") await notifySeasonPublished(seasonId);
    }
    revalidateGroup(s.groupId);
    return ok(undefined, "Temporada finalizada");
  });
}

export async function publishSeasonResultsAction(seasonId: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    const s = await loadSeason(seasonId);
    await requireGroupAdmin(s.groupId);
    if (!s.finalizedAt) return fail("Primero finalizá la temporada");
    await publishSeasonResults(seasonId);
    await notifySeasonPublished(seasonId);
    revalidateGroup(s.groupId);
    return ok(undefined, "Resultados publicados");
  });
}

/** Admin: borra `finalizedAt`, ganadores y puntos de premios, y recalcula. */
export async function reopenSeasonAction(seasonId: string): Promise<ActionResult<void>> {
  return runAction(async () => {
    const s = await loadSeason(seasonId);
    await requireGroupAdmin(s.groupId);
    if (!s.finalizedAt) return fail("La temporada no está finalizada");
    await reopenSeason(seasonId);
    revalidateGroup(s.groupId);
    return ok(undefined, "Temporada reabierta");
  });
}

/**
 * Para las páginas (respaldo del cron, D3): si la temporada terminó y es `auto`, la finaliza publicando.
 * Idempotente; no requiere permisos porque solo hace lo que el cron haría igual.
 */
export async function ensureSeasonFinalizedIfDue(seasonId: string): Promise<void> {
  await finalizeSeasonIfDue(seasonId);
}
