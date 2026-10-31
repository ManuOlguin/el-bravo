import "server-only";
import { prisma } from "@/src/lib/db";
import { notify } from "@/src/server/notifications";

// Seguir (D5): sin solicitudes. "Amigos" = seguimiento mutuo.

export type UserSummary = { id: string; name: string | null; photoUrl: string | null };
const summarySelect = { id: true, name: true, photoUrl: true } as const;

/** Membresía vigente en un grupo (misma regla que `membershipRole`). */
export const ACTIVE_MEMBERSHIP = { leftAt: null, status: "accepted" } as const;

export class SocialError extends Error {
  constructor(public userMessage: string) {
    super(userMessage);
    this.name = "SocialError";
  }
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const f = await prisma.follow.findUnique({ where: { followerId_followingId: { followerId, followingId } }, select: { followerId: true } });
  return !!f;
}

export async function isFriend(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const n = await prisma.follow.count({
    where: { OR: [{ followerId: a, followingId: b }, { followerId: b, followingId: a }] },
  });
  return n === 2;
}

/** Idempotente. Notifica `new_follower` solo la primera vez. */
export async function follow(followerId: string, followingId: string): Promise<{ isFollowing: true; isFriend: boolean }> {
  if (followerId === followingId) throw new SocialError("No podés seguirte a vos mismo.");
  const target = await prisma.user.findUnique({ where: { id: followingId }, select: { isActive: true } });
  if (!target?.isActive) throw new SocialError("No encontramos a esa persona.");

  const { count } = await prisma.follow.createMany({ data: [{ followerId, followingId }], skipDuplicates: true });
  if (count > 0) {
    try {
      await notify({
        recipientIds: [followingId],
        type: "new_follower",
        actorId: followerId,
        dedupeKey: (recipientId) => `new_follower:${followerId}:${recipientId}`,
      });
    } catch (e) {
      console.error("[notify new_follower]", e); // una notificación nunca rompe la acción
    }
  }
  return { isFollowing: true, isFriend: await isFollowing(followingId, followerId) };
}

export async function unfollow(followerId: string, followingId: string): Promise<{ isFollowing: false }> {
  await prisma.follow.deleteMany({ where: { followerId, followingId } });
  return { isFollowing: false };
}

/** Ids de la gente que `userId` sigue. */
export async function followingIds(userId: string): Promise<string[]> {
  const rows = await prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
  return rows.map((r) => r.followingId);
}

/** Amigos (seguimiento mutuo), ordenados por nombre. */
export async function listFriends(userId: string): Promise<UserSummary[]> {
  return prisma.user.findMany({
    where: {
      isActive: true,
      followers: { some: { followerId: userId } },
      following: { some: { followingId: userId } },
    },
    select: summarySelect,
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function listFollowers(userId: string): Promise<UserSummary[]> {
  const rows = await prisma.follow.findMany({
    where: { followingId: userId, follower: { isActive: true } },
    orderBy: { createdAt: "desc" },
    select: { follower: { select: summarySelect } },
  });
  return rows.map((r) => r.follower);
}

export async function listFollowing(userId: string): Promise<UserSummary[]> {
  const rows = await prisma.follow.findMany({
    where: { followerId: userId, following: { isActive: true } },
    orderBy: { createdAt: "desc" },
    select: { following: { select: summarySelect } },
  });
  return rows.map((r) => r.following);
}

/**
 * Búsqueda por nombre: prefijo del nombre o de cualquier palabra. La comparación no distingue
 * mayúsculas ni acentos porque la columna usa la collation `utf8mb4_unicode_ci` de MySQL.
 */
export async function searchUsers(viewerId: string, rawQuery: string): Promise<(UserSummary & { isFollowing: boolean })[]> {
  const q = rawQuery.trim().replace(/\s+/g, " ");
  if (q.length < 2) return [];
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: viewerId },
      OR: [{ name: { startsWith: q } }, { name: { contains: ` ${q}` } }],
    },
    select: summarySelect,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 20,
  });
  const followed = new Set(
    (
      await prisma.follow.findMany({
        where: { followerId: viewerId, followingId: { in: users.map((u) => u.id) } },
        select: { followingId: true },
      })
    ).map((f) => f.followingId)
  );
  return users.map((u) => ({ ...u, isFollowing: followed.has(u.id) }));
}

/** Gente de tus grupos (membresía vigente) que todavía no seguís. */
export async function getFollowSuggestions(viewerId: string, limit = 10): Promise<UserSummary[]> {
  return prisma.user.findMany({
    where: {
      isActive: true,
      id: { not: viewerId },
      followers: { none: { followerId: viewerId } },
      groupMembers: {
        some: {
          ...ACTIVE_MEMBERSHIP,
          group: { members: { some: { userId: viewerId, ...ACTIVE_MEMBERSHIP } } },
        },
      },
    },
    select: summarySelect,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: limit,
  });
}

/** Relación del viewer con cada usuario de una lista (para pintar FollowButton en listas). */
export async function relationsFor(
  viewerId: string,
  userIds: string[]
): Promise<Map<string, { isFollowing: boolean; followsMe: boolean }>> {
  const rows = userIds.length
    ? await prisma.follow.findMany({
        where: {
          OR: [
            { followerId: viewerId, followingId: { in: userIds } },
            { followingId: viewerId, followerId: { in: userIds } },
          ],
        },
        select: { followerId: true, followingId: true },
      })
    : [];
  const map = new Map(userIds.map((id) => [id, { isFollowing: false, followsMe: false }]));
  for (const r of rows) {
    if (r.followerId === viewerId) {
      const e = map.get(r.followingId);
      if (e) e.isFollowing = true;
    } else {
      const e = map.get(r.followerId);
      if (e) e.followsMe = true;
    }
  }
  return map;
}
