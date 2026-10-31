import "server-only";
import { prisma } from "@/src/lib/db";
import { dbDateToLocalDate, localDateOf } from "@/src/lib/time";
import { getGroupForMember } from "@/src/server/groups/queries";
import type { CategoryOption } from "./season-form-state";
import { seasonSummarySelect, toSeasonSummary } from "./summary";
import type { SeasonSummary } from "./types";

export type SeasonFormData = {
  group: { id: string; name: string; timezone: string; myRole: "admin" | "member" };
  categories: CategoryOption[];
  today: string;
  otherSeasons: { name: string; startDate: string; endDate: string }[];
  season: SeasonSummary | null;
};

/**
 * Datos del wizard de temporada. Lanza `AuthError` si el viewer no es miembro; devuelve `season: null`
 * si `seasonId` no existe o no es de este grupo (la página decide el 404).
 */
export async function getSeasonFormData(groupId: string, viewerId: string, seasonId?: string, now: Date = new Date()): Promise<SeasonFormData> {
  const group = await getGroupForMember(groupId, viewerId);
  const [categories, seasons] = await Promise.all([
    prisma.activityCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, slug: true, name: true } }),
    prisma.season.findMany({ where: { groupId }, select: { id: true, name: true, startDate: true, endDate: true } }),
  ]);
  const row = seasonId ? await prisma.season.findFirst({ where: { id: seasonId, groupId }, select: seasonSummarySelect }) : null;
  return {
    group: { id: group.id, name: group.name, timezone: group.timezone, myRole: group.myRole },
    categories,
    today: localDateOf(now, group.timezone),
    otherSeasons: seasons
      .filter((s) => s.id !== seasonId)
      .map((s) => ({ name: s.name, startDate: dbDateToLocalDate(s.startDate), endDate: dbDateToLocalDate(s.endDate) })),
    season: row ? toSeasonSummary(row, viewerId, group.timezone, now) : null,
  };
}
