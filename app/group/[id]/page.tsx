import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { dbDateToLocalDate, localDateOf, weekKeyOf, addWeeks, type WeekKey } from "@/src/lib/time";
import { requirePageUser } from "@/src/server/auth/dal";
import { getSeasonStandings } from "@/src/server/scoring";
import { getUserBadges } from "@/src/server/badges";
import GroupPageClient from "./GroupPageClient";

// PUENTE (W0-C): adapta la página vieja del grupo al schema v2. W2-2 la reescribe.
// - El ranking sale de SeasonStanding (vacío → todos en 0 pts hasta W1-1).
// - Las fechas de temporada son fechas locales (@db.Date) en la zona del grupo.
// - No se finaliza nada al renderizar (eso es de W1-1: cron + primera visita idempotente).

type ActivityMuscleItem = { name: string; percentage: number };

type SeasonLeaderboardEntry = {
  userId: string;
  name: string | null;
  email: string | null;
  photoUrl: string | null;
  points: number;
  rank: number;
  activeWeeks: number;
  perfectWeeks: number;
};

type UserSeasonStanding = {
  rank: number;
  totalPoints: number;
  totalParticipants: number;
  pointsToNextAbove: number | null;
  nextAbove: SeasonLeaderboardEntry | null;
  nextBelow: SeasonLeaderboardEntry | null;
} | null;

function roundTo(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function calculateActivityMuscleShare(
  exercises: Array<{
    sets: Array<{ reps: number | null; weightKg: number | null }>;
    exercise: { muscles: Array<{ percentage: number; muscle: { name: string } }> };
  }>
): ActivityMuscleItem[] {
  const muscleLoadMap = new Map<string, number>();

  for (const entry of exercises) {
    const baseLoad = entry.sets.reduce((sum, s) => {
      const reps = s.reps ?? 0;
      const weightKg = s.weightKg ?? 0;
      return sum + (weightKg > 0 ? reps * weightKg : reps);
    }, 0);
    if (baseLoad <= 0) continue;

    const muscles = entry.exercise.muscles;
    const totalPct = muscles.reduce((sum, item) => sum + item.percentage, 0);
    if (totalPct <= 0) continue;

    for (const m of muscles) {
      const key = m.muscle.name;
      muscleLoadMap.set(key, (muscleLoadMap.get(key) ?? 0) + baseLoad * (m.percentage / totalPct));
    }
  }

  const totalLoad = Array.from(muscleLoadMap.values()).reduce((a, b) => a + b, 0);
  if (totalLoad <= 0) return [];

  return Array.from(muscleLoadMap.entries())
    .map(([name, load]) => ({ name, percentage: roundTo((load / totalLoad) * 100, 1) }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 4);
}

/** Racha de semanas consecutivas (hasta la actual) que cumplen `min`. La semana en curso no corta la racha. */
function weekStreak(weekCounts: Map<WeekKey, number>, currentWeek: WeekKey, min: number) {
  let streak = (weekCounts.get(currentWeek) ?? 0) >= min ? 1 : 0;
  for (let w = addWeeks(currentWeek, -1); (weekCounts.get(w) ?? 0) >= min; w = addWeeks(w, -1)) streak++;
  return streak;
}

function computeSeasonMemberStats(activities: Array<{ startedAt: Date }>, weeklyGoal: number, tz: string) {
  const weekCounts = new Map<WeekKey, number>();
  for (const a of activities) {
    const key = weekKeyOf(a.startedAt, tz);
    weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
  }
  const currentWeek = weekKeyOf(new Date(), tz);
  return {
    currentWeekCount: weekCounts.get(currentWeek) ?? 0,
    activeWeeks: weekStreak(weekCounts, currentWeek, 1),
    perfectWeeks: weekStreak(weekCounts, currentWeek, weeklyGoal),
  };
}

/**
 * Los componentes cliente viejos formatean con `new Date(x)` en la zona del navegador. Para que una
 * fecha local se vea igual en cualquier zona, se les pasa "YYYY-MM-DDT12:00:00" (mediodía local, sin Z).
 */
function clientLocalDate(d: Date) {
  return `${dbDateToLocalDate(d)}T12:00:00`;
}

export default async function GroupByIdPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();

  const { id: groupId } = await params;
  if (!groupId) redirect("/home");

  const membership = await prisma.groupMember.findFirst({
    where: { userId: user.id, groupId, leftAt: null },
    select: { role: true },
  });
  if (!membership) redirect("/home");

  const userSelect = { id: true, name: true, photoUrl: true } as const; // sin email (W1-4: no se envía al cliente)
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: {
        where: { leftAt: null },
        select: { id: true, userId: true, role: true, user: { select: userSelect } },
      },
      seasons: {
        orderBy: { startDate: "desc" },
        include: {
          members: { where: { leftAt: null }, include: { user: { select: userSelect } } },
          categories: {
            include: { activityCategory: { select: { id: true, slug: true, name: true } } },
          },
        },
      },
    },
  });
  if (!group) redirect("/home");

  const tz = group.timezone;
  const today = localDateOf(new Date(), tz);
  const isAdmin = membership.role === "admin";

  const withLocalDates = group.seasons.map((s) => ({
    ...s,
    start: dbDateToLocalDate(s.startDate),
    end: dbDateToLocalDate(s.endDate),
  }));

  const activeSeasonRaw =
    withLocalDates.find((s) => !s.finalizedAt && s.start <= today && s.end >= today) ?? null;
  const upcomingSeasonRaw = withLocalDates.find((s) => s.start > today) ?? null;
  const pastSeasonsRaw = withLocalDates.filter((s) => !!s.finalizedAt || s.end < today);

  // Objetos planos para el cliente (sin Decimal de Prisma).
  const toClientSeason = (s: (typeof withLocalDates)[number]) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    weeklyGoal: s.weeklyGoal,
    startDate: clientLocalDate(s.startDate),
    endDate: clientLocalDate(s.endDate),
    finalizedAt: s.finalizedAt,
    members: s.members,
  });
  const activeSeason = activeSeasonRaw ? toClientSeason(activeSeasonRaw) : null;

  const userJoinedActiveSeason = activeSeasonRaw
    ? activeSeasonRaw.members.some((m) => m.userId === user.id)
    : false;

  // Ranking: SeasonStanding (vacío hasta W1-1) + miembros en 0 pts.
  let seasonLeaderboard: SeasonLeaderboardEntry[] = [];
  if (activeSeasonRaw && userJoinedActiveSeason) {
    const standings = new Map((await getSeasonStandings(activeSeasonRaw.id)).map((s) => [s.userId, s]));
    seasonLeaderboard = activeSeasonRaw.members
      .map((m) => {
        const s = standings.get(m.userId);
        return {
          userId: m.user.id,
          name: m.user.name,
          email: null,
          photoUrl: m.user.photoUrl,
          points: s?.points ?? 0,
          activeWeeks: s?.currentStreak ?? 0,
          perfectWeeks: s?.weeksGoalMet ?? 0,
          daysTrained: s?.daysTrained ?? 0,
          rank: 0,
        };
      })
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.perfectWeeks - a.perfectWeeks ||
          b.daysTrained - a.daysTrained ||
          (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "")
      )
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }

  let userSeasonStanding: UserSeasonStanding = null;
  const myIndex = seasonLeaderboard.findIndex((e) => e.userId === user.id);
  if (myIndex !== -1) {
    const current = seasonLeaderboard[myIndex];
    const nextAbove = myIndex > 0 ? seasonLeaderboard[myIndex - 1] : null;
    userSeasonStanding = {
      rank: current.rank,
      totalPoints: current.points,
      totalParticipants: seasonLeaderboard.length,
      pointsToNextAbove: nextAbove ? nextAbove.points - current.points : null,
      nextAbove,
      nextBelow: seasonLeaderboard[myIndex + 1] ?? null,
    };
  }

  const memberIds = group.members.map((m) => m.userId);
  const activities = await prisma.activity.findMany({
    where: { userId: { in: memberIds } },
    orderBy: { startedAt: "desc" },
    take: 100,
    include: {
      user: { select: userSelect },
      media: { select: { id: true, url: true }, orderBy: { position: "asc" }, take: 1 },
      activityCategory: { select: { id: true, slug: true, name: true } },
      exercises: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          sets: { orderBy: { position: "asc" }, select: { reps: true, weightKg: true } },
          exercise: {
            select: {
              id: true,
              name: true,
              measureType: true,
              muscles: { select: { percentage: true, muscle: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });

  // Actividades que cuentan en la temporada activa: fecha local dentro del rango y categoría habilitada.
  const enabledCategoryIds = new Set(
    (activeSeasonRaw?.categories ?? []).filter((c) => Number(c.weight) > 0).map((c) => c.activityCategoryId)
  );
  const seasonScopedActivities = activeSeasonRaw
    ? activities.filter((a) => {
        const d = localDateOf(a.startedAt, tz);
        return d >= activeSeasonRaw.start && d <= activeSeasonRaw.end && enabledCategoryIds.has(a.activityCategoryId);
      })
    : [];

  const membersWithStats = (
    await Promise.all(
      group.members.map(async (member) => {
        const stats = computeSeasonMemberStats(
          seasonScopedActivities.filter((a) => a.userId === member.userId),
          activeSeasonRaw?.weeklyGoal ?? 3,
          tz
        );
        const badges = (await getUserBadges(member.userId))
          .filter((b) => b.level > 0)
          .sort((a, b) => b.level - a.level)
          .slice(0, 3)
          .map((b) => ({ id: b.code, name: b.name, level: b.level, category: null }));
        return {
          id: member.user.id,
          userId: member.userId,
          name: member.user.name,
          email: null,
          photoUrl: member.user.photoUrl,
          role: member.role,
          ...stats,
          badges,
        };
      })
    )
  ).sort(
    (a, b) =>
      b.perfectWeeks - a.perfectWeeks || b.activeWeeks - a.activeWeeks || b.currentWeekCount - a.currentWeekCount
  );

  const seasons = withLocalDates.map((season) => ({
    id: season.id,
    name: season.name,
    description: season.description,
    startDate: clientLocalDate(season.startDate),
    endDate: clientLocalDate(season.endDate),
    weeklyGoal: season.weeklyGoal,
    allowedActivityTypes: season.categories.map((c) => c.activityCategory.name),
    members: season.members.map((m) => ({
      id: m.user.id,
      userId: m.userId,
      name: m.user.name,
      email: null,
      photoUrl: m.user.photoUrl,
    })),
    joined: season.members.some((m) => m.userId === user.id),
    isActive: !season.finalizedAt && season.start <= today && season.end >= today,
    isUpcoming: season.start > today,
    isPast: !!season.finalizedAt || season.end < today,
  }));

  const actData = seasonScopedActivities.map((a) => ({
    id: a.id,
    type: a.activityCategory.name, // el cliente muestra este texto como etiqueta del tipo
    activityCategory: a.activityCategory,
    notes: a.notes,
    startedAt: a.startedAt,
    durationMinutes: a.durationMinutes,
    mediaUrl: a.media[0]?.url ?? null,
    user: a.user,
    muscles: calculateActivityMuscleShare(a.exercises),
  }));

  return (
    <GroupPageClient
      group={{
        id: group.id,
        name: group.name,
        description: group.description,
        photoUrl: group.photoUrl,
        createdAt: group.createdAt,
        members: group.members,
      }}
      isAdmin={isAdmin}
      activities={actData}
      membersWithStats={membersWithStats}
      activeSeason={activeSeason}
      upcomingSeason={upcomingSeasonRaw ? toClientSeason(upcomingSeasonRaw) : null}
      pastSeasons={pastSeasonsRaw.map(toClientSeason)}
      seasons={seasons}
      currentUserId={user.id}
      seasonLeaderboard={seasonLeaderboard}
      userSeasonStanding={userSeasonStanding}
      timezone={tz}
    />
  );
}
