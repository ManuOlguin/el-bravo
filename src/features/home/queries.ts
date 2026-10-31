import "server-only";
import { prisma } from "@/src/lib/db";
import { getSeasonStandings } from "@/src/server/scoring/queries";
import { statusOfDbSeason } from "@/src/server/seasons/lifecycle";
import { summarizeStanding, type StandingSummary } from "./logic";

export type GroupStandingCard = {
  groupId: string;
  groupName: string;
  groupPhotoUrl: string | null;
  seasonId: string;
  seasonName: string;
  /** null = el usuario no participa en la temporada (se sumó al grupo después, por ejemplo). */
  standing: StandingSummary | null;
};

/** Una tarjeta por cada temporada ACTIVA (en la zona de su grupo) de los grupos vigentes del usuario. */
export async function getHomeGroupStandings(userId: string, now: Date = new Date()): Promise<{ groupCount: number; cards: GroupStandingCard[] }> {
  const memberships = await prisma.groupMember.findMany({
    where: { userId, leftAt: null, status: "accepted" },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    select: {
      group: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
          timezone: true,
          seasons: {
            where: { finalizedAt: null },
            orderBy: [{ startDate: "asc" }, { id: "asc" }],
            select: { id: true, name: true, startDate: true, endDate: true, finalizedAt: true },
          },
        },
      },
    },
  });

  const active = memberships.flatMap(({ group }) =>
    group.seasons
      .filter((s) => statusOfDbSeason({ ...s, group: { timezone: group.timezone } }, now) === "active")
      .map((s) => ({ group, season: s }))
  );

  const cards = await Promise.all(
    active.map(async ({ group, season }) => ({
      groupId: group.id,
      groupName: group.name,
      groupPhotoUrl: group.photoUrl,
      seasonId: season.id,
      seasonName: season.name,
      standing: summarizeStanding(await getSeasonStandings(season.id), userId),
    }))
  );
  return { groupCount: memberships.length, cards };
}

export type QuickRoutine = { id: string; name: string };

/** Las `limit` rutinas más usadas (por cantidad de entrenamientos); si faltan, completa con las más nuevas. */
export async function getQuickRoutines(userId: string, limit = 3): Promise<{ total: number; top: QuickRoutine[] }> {
  const [routines, usage] = await Promise.all([
    prisma.routine.findMany({ where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, name: true } }),
    prisma.activity.groupBy({ by: ["routineId"], where: { userId, routineId: { not: null } }, _count: { _all: true } }),
  ]);
  const uses = new Map(usage.map((u) => [u.routineId, u._count._all]));
  const top = routines
    .map((r, i) => ({ r, i, n: uses.get(r.id) ?? 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .slice(0, limit)
    .map(({ r }) => r);
  return { total: routines.length, top };
}
