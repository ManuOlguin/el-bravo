import "server-only";
import { prisma } from "@/src/lib/db";
import { AuthError } from "@/src/server/auth/errors";
import { notify } from "@/src/server/notifications";
import { ACTIVE_MEMBERSHIP } from "./follows";
import { emojiFromKey, emojiKey, REACTION_EMOJIS, type ReactionEmoji, type ReactionSummary } from "./reaction-types";

export { REACTION_EMOJIS, type ReactionEmoji, type ReactionSummary } from "./reaction-types";

/** El viewer puede ver (y reaccionar a) una actividad si es suya, si sigue al dueño o si comparten un grupo. */
export async function canViewUserActivities(viewerId: string, ownerId: string): Promise<boolean> {
  if (viewerId === ownerId) return true;
  const [follows, sharedGroup] = await Promise.all([
    prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: ownerId } }, select: { followerId: true } }),
    prisma.group.findFirst({
      where: {
        AND: [
          { members: { some: { userId: viewerId, ...ACTIVE_MEMBERSHIP } } },
          { members: { some: { userId: ownerId, ...ACTIVE_MEMBERSHIP } } },
        ],
      },
      select: { id: true },
    }),
  ]);
  return !!follows || !!sharedGroup;
}

/** Resúmenes de reacciones de varias actividades en UNA query (sin N+1). Orden de emojis = REACTION_EMOJIS. */
export async function getReactionSummaries(activityIds: string[], viewerId: string): Promise<Map<string, ReactionSummary>> {
  const result = new Map<string, ReactionSummary>(activityIds.map((id) => [id, []]));
  if (activityIds.length === 0) return result;
  const rows = await prisma.reaction.findMany({
    where: { activityId: { in: activityIds } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { activityId: true, emoji: true, userId: true, user: { select: { name: true } } },
  });
  const grouped = new Map<string, Map<ReactionEmoji, ReactionSummary[number]>>();
  for (const r of rows) {
    const emoji = emojiFromKey(r.emoji);
    if (!emoji) continue; // clave desconocida (no debería pasar)
    const byEmoji = grouped.get(r.activityId) ?? new Map();
    grouped.set(r.activityId, byEmoji);
    const s = byEmoji.get(emoji) ?? { emoji, count: 0, mine: false, users: [] };
    byEmoji.set(emoji, s);
    s.count++;
    if (r.userId === viewerId) s.mine = true;
    s.users.push({ id: r.userId, name: r.user.name });
  }
  for (const [activityId, byEmoji] of grouped) {
    result.set(
      activityId,
      REACTION_EMOJIS.filter((e) => byEmoji.has(e)).map((e) => byEmoji.get(e)!)
    );
  }
  return result;
}

/** Si la reacción existe la borra; si no, la crea (y notifica al dueño). */
export async function toggleReaction(viewerId: string, activityId: string, emoji: ReactionEmoji): Promise<ReactionSummary> {
  const activity = await prisma.activity.findUnique({ where: { id: activityId }, select: { userId: true } });
  if (!activity) throw new AuthError("NOT_FOUND");
  if (!(await canViewUserActivities(viewerId, activity.userId))) throw new AuthError("FORBIDDEN");

  const key = emojiKey(emoji);
  const removed = await prisma.reaction.deleteMany({ where: { activityId, userId: viewerId, emoji: key } });
  if (removed.count === 0) {
    const { count } = await prisma.reaction.createMany({ data: [{ activityId, userId: viewerId, emoji: key }], skipDuplicates: true });
    if (count > 0 && activity.userId !== viewerId) {
      try {
        await notify({
          recipientIds: [activity.userId],
          type: "reaction_received",
          actorId: viewerId,
          activityId,
          data: { emoji },
          dedupeKey: (recipientId) => `reaction:${activityId}:${viewerId}:${emoji}:${recipientId}`,
        });
      } catch (e) {
        console.error("[notify reaction_received]", e);
      }
    }
  }
  return (await getReactionSummaries([activityId], viewerId)).get(activityId) ?? [];
}
