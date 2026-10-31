/**
 * Emisores (W2-3): arman el contexto con queries, aplican las reglas puras y escriben con `notify`.
 * Sin "server-only": `index.ts` los reexporta y se importa desde scripts con tsx.
 */
import { prisma } from "@/src/lib/db";
import { addDays, dbDateToLocalDate, localDateOf, weekKeyOf, zonedToUtc } from "@/src/lib/time";
import type { ActivityChange, ActivityEffects } from "@/src/server/activities/effects";
import { notify } from "./notify";
import { planActivityNotifications, pushWindowKey, type GroupContext, type RuleContext, type SeasonContext } from "./rules";

/** Membresía vigente de grupo (misma regla que `ACTIVE_MEMBERSHIP` de social). */
const ACTIVE = { leftAt: null, status: "accepted" } as const;
const DAY_MS = 86_400_000;

async function buildGroupContexts(
  actor: { id: string; weeklyGoal: number },
  activity: { id: string; startedAt: Date },
  effects: ActivityEffects,
  now: Date
): Promise<{ groups: GroupContext[]; coMemberIds: Set<string> }> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId: actor.id, ...ACTIVE },
    select: {
      group: { select: { id: true, name: true, timezone: true, members: { where: ACTIVE, select: { userId: true } } } },
    },
  });
  const seasonIds = effects.scoring.map((e) => e.seasonId);
  const seasons = seasonIds.length
    ? await prisma.season.findMany({ where: { id: { in: seasonIds } }, select: { groupId: true, weeklyGoal: true } })
    : [];
  const goalByGroup = new Map(seasons.map((s) => [s.groupId, s.weeklyGoal]));

  const coMemberIds = new Set<string>();
  const groups: GroupContext[] = [];
  for (const { group } of memberships) {
    const tz = group.timezone;
    const memberIds = group.members.map((m) => m.userId);
    memberIds.forEach((id) => coMemberIds.add(id));
    const weekKey = weekKeyOf(activity.startedAt, tz);
    const from = zonedToUtc(weekKey, "00:00", tz);
    const to = zonedToUtc(addDays(weekKey, 7), "00:00", tz);
    const rows = await prisma.activity.findMany({
      where: { userId: { in: memberIds }, startedAt: { gte: from, lt: to } },
      select: { id: true, userId: true, startedAt: true },
    });
    const day = localDateOf(activity.startedAt, tz);
    const actorRows = rows.filter((r) => r.userId === actor.id);
    groups.push({
      groupId: group.id,
      groupName: group.name,
      memberIds,
      weekKey,
      isCurrentWeek: weekKey === weekKeyOf(now, tz),
      isNewDay: !actorRows.some((r) => r.id !== activity.id && localDateOf(r.startedAt, tz) === day),
      actorWorkoutsThisWeek: new Set(actorRows.map((r) => localDateOf(r.startedAt, tz))).size,
      othersWithWorkoutThisWeek: new Set(rows.filter((r) => r.userId !== actor.id).map((r) => r.userId)).size,
      weeklyGoal: goalByGroup.get(group.id) ?? actor.weeklyGoal,
    });
  }
  return { groups, coMemberIds };
}

async function buildSeasonContexts(actorId: string, effects: ActivityEffects, now: Date): Promise<SeasonContext[]> {
  if (!effects.scoring.length) return [];
  const seasons = await prisma.season.findMany({
    where: { id: { in: effects.scoring.map((e) => e.seasonId) } },
    select: {
      id: true,
      name: true,
      groupId: true,
      group: { select: { timezone: true } },
      members: { where: { leftAt: null }, select: { userId: true } },
      standings: { select: { userId: true, points: true, rank: true, currentStreak: true } },
    },
  });
  return seasons.map((s) => ({
    seasonId: s.id,
    seasonName: s.name,
    groupId: s.groupId,
    weekKey: weekKeyOf(now, s.group.timezone),
    memberIds: s.members.map((m) => m.userId),
    actorStreak: s.standings.find((r) => r.userId === actorId)?.currentStreak ?? 0,
    others: s.standings.filter((r) => r.userId !== actorId).map((r) => ({ userId: r.userId, points: r.points, rank: r.rank })),
  }));
}

/**
 * Notificaciones de una actividad. Solo las actividades NUEVAS notifican (editar o borrar no).
 * La llama `runActivityEffects` dentro de un try/catch: nunca rompe el guardado.
 */
export async function emitActivityNotifications(
  change: ActivityChange,
  effects: ActivityEffects,
  opts: { now?: Date } = {}
): Promise<void> {
  if (change.before !== null || !change.after) return;
  const now = opts.now ?? new Date();
  const activity = change.after;
  const actor = await prisma.user.findUnique({ where: { id: change.userId }, select: { id: true, name: true, weeklyGoal: true } });
  if (!actor) return;

  const [{ groups, coMemberIds }, seasons, followers, following, category] = await Promise.all([
    buildGroupContexts(actor, activity, effects, now),
    buildSeasonContexts(actor.id, effects, now),
    prisma.follow.findMany({ where: { followingId: actor.id, follower: { isActive: true } }, select: { followerId: true } }),
    prisma.follow.findMany({ where: { followerId: actor.id }, select: { followingId: true } }),
    prisma.activityCategory.findUnique({ where: { id: activity.activityCategoryId }, select: { name: true } }),
  ]);
  const followerIds = followers.map((f) => f.followerId);
  const followingSet = new Set(following.map((f) => f.followingId));

  const ctx: RuleContext = {
    actor: { id: actor.id, name: actor.name },
    groups,
    seasons,
    effects,
    isNewActivity: true,
    followerIds,
    friendIdsOutsideGroups: followerIds.filter((id) => followingSet.has(id) && !coMemberIds.has(id)),
    activity: { categoryName: category?.name ?? null, durationMinutes: activity.durationMinutes },
    windowKey: pushWindowKey(now),
  };

  for (const p of planActivityNotifications(ctx, activity.id)) {
    await notify({
      recipientIds: p.recipientIds,
      type: p.type,
      actorId: p.actorId,
      groupId: p.groupId,
      seasonId: p.seasonId,
      activityId: p.activityId,
      data: p.data,
      dedupeKey: p.dedupe,
    });
  }
}

/** Miembros vigentes del grupo de una temporada. */
async function seasonAudience(seasonId: string) {
  return prisma.season.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      name: true,
      groupId: true,
      startDate: true,
      finalizedAt: true,
      resultsPublishedAt: true,
      group: { select: { name: true, timezone: true, members: { where: ACTIVE, select: { userId: true } } } },
    },
  });
}

/** "Se publicaron los resultados de X" a todo el grupo. Idempotente; no hace nada si no están publicados. */
export async function emitSeasonPublished(seasonId: string): Promise<void> {
  const s = await seasonAudience(seasonId);
  if (!s?.resultsPublishedAt) return;
  await notify({
    recipientIds: s.group.members.map((m) => m.userId),
    type: "season_results_published",
    groupId: s.groupId,
    seasonId: s.id,
    data: { seasonName: s.name, groupName: s.group.name },
    dedupeKey: (r) => `season_published:${s.id}:${r}`,
  });
}

/** "Arrancó X en Y" a todo el grupo. Idempotente. */
export async function emitSeasonStarted(seasonId: string): Promise<void> {
  const s = await seasonAudience(seasonId);
  if (!s) return;
  await notify({
    recipientIds: s.group.members.map((m) => m.userId),
    type: "season_started",
    groupId: s.groupId,
    seasonId: s.id,
    data: { seasonName: s.name, groupName: s.group.name },
    dedupeKey: (r) => `season_started:${s.id}:${r}`,
  });
}

/**
 * Para el cron: temporadas que empezaron hoy (o ayer, por si una corrida falló) en la zona de su grupo.
 * Devuelve los ids notificados.
 */
export async function emitDueSeasonStarts(now: Date = new Date()): Promise<string[]> {
  const candidates = await prisma.season.findMany({
    where: { finalizedAt: null, startDate: { gte: new Date(now.getTime() - 3 * DAY_MS), lte: new Date(now.getTime() + DAY_MS) } },
    select: { id: true, startDate: true, group: { select: { timezone: true } } },
  });
  const done: string[] = [];
  for (const s of candidates) {
    const today = localDateOf(now, s.group.timezone);
    const start = dbDateToLocalDate(s.startDate);
    if (start !== today && start !== addDays(today, -1)) continue;
    await emitSeasonStarted(s.id);
    done.push(s.id);
  }
  return done;
}

/**
 * Para el cron: resultados publicados en los últimos 7 días. Cubre la publicación automática
 * (`finalizeDueSeasons`) y la manual (`publishSeasonResultsAction`) sin tocar los archivos de W1-1.
 */
export async function emitRecentlyPublishedSeasons(now: Date = new Date()): Promise<string[]> {
  const seasons = await prisma.season.findMany({
    where: { resultsPublishedAt: { gte: new Date(now.getTime() - 7 * DAY_MS), lte: now } },
    select: { id: true },
  });
  for (const s of seasons) await emitSeasonPublished(s.id);
  return seasons.map((s) => s.id);
}
