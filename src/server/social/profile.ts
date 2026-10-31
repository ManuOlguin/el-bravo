import "server-only";
import { prisma } from "@/src/lib/db";
import { ACTIVE_MEMBERSHIP } from "./follows";

/**
 * Perfil público dentro de la app (D5): lo ve cualquier usuario logueado.
 * NUNCA incluye el email ni las notas de las actividades.
 */
export type PublicProfile = {
  user: { id: string; name: string | null; photoUrl: string | null; bio: string | null; createdAt: Date };
  counts: { followers: number; following: number; workouts: number };
  relation: { isMe: boolean; isFollowing: boolean; followsMe: boolean; isFriend: boolean };
  sharedGroups: { id: string; name: string }[];
  recentActivities: { id: string; categoryName: string; startedAt: Date; durationMinutes: number; photoUrl: string | null }[]; // últimas 10
};

export async function getPublicProfile(viewerId: string, userId: string): Promise<PublicProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, photoUrl: true, bio: true, createdAt: true, isActive: true },
  });
  if (!user || !user.isActive) return null;

  const isMe = viewerId === userId;
  const [followers, following, workouts, viewerFollows, followsViewer, sharedGroups, activities] = await Promise.all([
    prisma.follow.count({ where: { followingId: userId, follower: { isActive: true } } }),
    prisma.follow.count({ where: { followerId: userId, following: { isActive: true } } }),
    prisma.activity.count({ where: { userId } }),
    isMe ? null : prisma.follow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: userId } } }),
    isMe ? null : prisma.follow.findUnique({ where: { followerId_followingId: { followerId: userId, followingId: viewerId } } }),
    prisma.group.findMany({
      where: {
        AND: [
          { members: { some: { userId, ...ACTIVE_MEMBERSHIP } } },
          { members: { some: { userId: viewerId, ...ACTIVE_MEMBERSHIP } } },
        ],
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.activity.findMany({
      where: { userId },
      orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      take: 10,
      select: {
        id: true,
        startedAt: true,
        durationMinutes: true,
        activityCategory: { select: { name: true } },
        media: { orderBy: { position: "asc" }, take: 1, select: { url: true, thumbUrl: true } },
      },
    }),
  ]);

  const isFollowing = !!viewerFollows;
  const followsMe = !!followsViewer;
  return {
    user: { id: user.id, name: user.name, photoUrl: user.photoUrl, bio: user.bio, createdAt: user.createdAt },
    counts: { followers, following, workouts },
    relation: { isMe, isFollowing, followsMe, isFriend: isFollowing && followsMe },
    sharedGroups,
    recentActivities: activities.map((a) => ({
      id: a.id,
      categoryName: a.activityCategory.name,
      startedAt: a.startedAt,
      durationMinutes: a.durationMinutes,
      photoUrl: a.media[0] ? (a.media[0].thumbUrl ?? a.media[0].url) : null,
    })),
  };
}
