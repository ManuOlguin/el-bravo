// Sin "server-only": se reexporta desde index.ts, que scripts/migrate-v2-data.ts importa desde tsx.
import { prisma } from "@/src/lib/db";
import type { UserBadgeView } from "./types";

/** Todas las insignias activas (incluidas las de nivel 0), por `sortOrder`, con el estado guardado del usuario. */
export async function getUserBadges(userId: string): Promise<UserBadgeView[]> {
  const badges = await prisma.badge.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      levels: { orderBy: { level: "asc" }, select: { level: true, threshold: true } },
      users: { where: { userId }, select: { level: true, progress: true, achievedAt: true } },
    },
  });
  return badges.map((b) => {
    const ub = b.users[0];
    const level = ub?.level ?? 0;
    return {
      code: b.code,
      name: b.name,
      description: b.description,
      iconKey: b.iconKey,
      level,
      maxLevel: b.levels.length ? b.levels[b.levels.length - 1].level : 0,
      progress: ub?.progress ?? 0,
      nextThreshold: b.levels.find((l) => l.level > level)?.threshold ?? null,
      achievedAt: ub?.achievedAt ?? null,
      levels: b.levels,
    };
  });
}

