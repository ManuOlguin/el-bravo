import "server-only";
import { prisma } from "@/src/lib/db";
import { statusOfDbSeason } from "@/src/server/seasons/lifecycle";
import { dbDateToLocalDate, localDateOf } from "@/src/lib/time";

export type MyGroupItem = {
  id: string;
  name: string;
  photoUrl: string | null;
  role: "admin" | "member";
  memberCount: number;
  today: string; // fecha local en la zona del grupo
  season: { id: string; name: string; endDate: string; joined: boolean; rank: number | null; points: number | null; participants: number } | null;
};

/** Mis grupos (vigentes) con la temporada en curso y mi puesto. Sin códigos ni emails. */
export async function getMyGroups(userId: string, now: Date = new Date()): Promise<MyGroupItem[]> {
  const rows = await prisma.groupMember.findMany({
    where: { userId, leftAt: null, status: "accepted" },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    select: {
      role: true,
      group: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
          timezone: true,
          _count: { select: { members: { where: { leftAt: null, status: "accepted" } } } },
          seasons: {
            where: { finalizedAt: null },
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
              finalizedAt: true,
              members: { where: { leftAt: null }, select: { userId: true } },
            },
          },
        },
      },
    },
  });

  const active = rows.flatMap((r) => {
    const s = r.group.seasons.find((x) => statusOfDbSeason({ ...x, group: { timezone: r.group.timezone } }, now) === "active");
    return s ? [{ groupId: r.group.id, season: s }] : [];
  });
  const standings = active.length
    ? await prisma.seasonStanding.findMany({
        where: { userId, seasonId: { in: active.map((a) => a.season.id) } },
        select: { seasonId: true, rank: true, points: true },
      })
    : [];

  return rows.map((r) => {
    const a = active.find((x) => x.groupId === r.group.id)?.season ?? null;
    const st = a ? standings.find((s) => s.seasonId === a.id) : undefined;
    return {
      id: r.group.id,
      name: r.group.name,
      photoUrl: r.group.photoUrl,
      role: r.role,
      memberCount: r.group._count.members,
      today: localDateOf(now, r.group.timezone),
      season: a
        ? {
            id: a.id,
            name: a.name,
            endDate: dbDateToLocalDate(a.endDate),
            joined: a.members.some((m) => m.userId === userId),
            rank: st?.rank ?? null,
            points: st?.points ?? null,
            participants: a.members.length,
          }
        : null,
    };
  });
}
