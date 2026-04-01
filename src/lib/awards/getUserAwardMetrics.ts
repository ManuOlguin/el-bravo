import { prisma } from "@/src/lib/db";

type ActivityType = "gym" | "run" | "sport" | "mobility" | "other";

type UserAwardMetrics = {
  userId: string;
  weeklyGoal: number;

  activityTypeWeekStreaks: Record<ActivityType, number>;
  perfectWeekStreak: number;
  weekendActivityStreak: number;

  muscleGroupRolling30Days: Record<string, number>;

  distinctActivityTypesInLatestSeason: number;
  latestSeasonId: string | null;
};

type NormalizedActivity = {
  id: string;
  type: ActivityType;
  startedAt: Date;
  endedAt: Date;
  exercises: {
    sets: number;
    reps: number;
    muscles: {
      percentage: number;
      muscle: {
        id: string;
        name: string;
        slug?: string | null;
        groupKey?: string | null;
      };
    }[];
  }[];
};

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 domingo, 1 lunes...
  const diff = day === 0 ? -6 : 1 - day; // semana arranca lunes
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

function formatWeekKey(date: Date) {
  const start = startOfWeek(date);
  return start.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getWeekendKey(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 domingo, 6 sábado

  let saturday: Date;
  if (day === 6) {
    saturday = new Date(d);
  } else if (day === 0) {
    saturday = addDays(d, -1);
  } else {
    // no es fin de semana, igual devolvemos la semana del sábado más cercano hacia atrás
    saturday = addDays(d, -(day + 1));
  }

  saturday.setHours(0, 0, 0, 0);
  return saturday.toISOString().slice(0, 10);
}

function getCurrentConsecutiveStreak(keys: string[]) {
  if (keys.length === 0) return 0;

  const uniqueSorted = [...new Set(keys)].sort((a, b) => (a < b ? 1 : -1));
  let streak = 1;

  for (let i = 0; i < uniqueSorted.length - 1; i++) {
    const current = new Date(uniqueSorted[i]);
    const next = new Date(uniqueSorted[i + 1]);

    const expectedPreviousWeek = addDays(current, -7);
    expectedPreviousWeek.setHours(0, 0, 0, 0);
    next.setHours(0, 0, 0, 0);

    if (next.getTime() === expectedPreviousWeek.getTime()) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

function getCurrentConsecutiveWeekendStreak(keys: string[]) {
  if (keys.length === 0) return 0;

  const uniqueSorted = [...new Set(keys)].sort((a, b) => (a < b ? 1 : -1));
  let streak = 1;

  for (let i = 0; i < uniqueSorted.length - 1; i++) {
    const current = new Date(uniqueSorted[i]);
    const next = new Date(uniqueSorted[i + 1]);

    const expectedPreviousWeekend = addDays(current, -7);
    expectedPreviousWeekend.setHours(0, 0, 0, 0);
    next.setHours(0, 0, 0, 0);

    if (next.getTime() === expectedPreviousWeekend.getTime()) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function calculateActivityMuscleGroupShare(activity: NormalizedActivity) {
  const loadsByGroup = new Map<string, number>();
  let totalLoad = 0;

  for (const exerciseEntry of activity.exercises) {
    const sets = Number(exerciseEntry.sets ?? 0);
    const reps = Number(exerciseEntry.reps ?? 0);

    if (sets <= 0 || reps <= 0) continue;

    const baseLoad = sets * reps;

    for (const relation of exerciseEntry.muscles) {
      const percentage = Number(relation.percentage ?? 0);
      const groupKey = relation.muscle.groupKey ?? "other";

      if (percentage <= 0) continue;

      const weightedLoad = baseLoad * (percentage / 100);
      totalLoad += weightedLoad;
      loadsByGroup.set(groupKey, (loadsByGroup.get(groupKey) ?? 0) + weightedLoad);
    }
  }

  const result = new Map<string, number>();

  if (totalLoad <= 0) {
    return result;
  }

  for (const [groupKey, load] of loadsByGroup.entries()) {
    result.set(groupKey, (load / totalLoad) * 100);
  }

  return result;
}

export async function getUserAwardMetrics(userId: string): Promise<UserAwardMetrics> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      weeklyGoal: true,
    } as any,
  });

  if (!user) {
    throw new Error("Usuario no encontrado");
  }

  const weeklyGoal = Number((user as any).weeklyGoal ?? 3);

  const activitiesRaw = await prisma.activity.findMany({
    where: {
      userId,
    },
    orderBy: {
      startedAt: "desc",
    },
    include: {
      exercises: {
        include: {
          exercise: {
            include: {
              muscles: {
                include: {
                  muscle: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const activities = (activitiesRaw as any[]).map(
    (activity): NormalizedActivity => ({
      id: activity.id,
      type: activity.type as ActivityType,
      startedAt: new Date(activity.startedAt),
      endedAt: new Date(activity.endedAt),
      exercises: Array.isArray(activity.exercises)
        ? activity.exercises.map((entry: any) => ({
            sets: Number(entry.sets ?? 0),
            reps: Number(entry.reps ?? 0),
            muscles: Array.isArray(entry.exercise?.muscles)
              ? entry.exercise.muscles.map((relation: any) => ({
                  percentage: Number(relation.percentage ?? 0),
                  muscle: {
                    id: relation.muscle?.id ?? "",
                    name: relation.muscle?.name ?? "Músculo",
                    slug: relation.muscle?.slug ?? null,
                    groupKey: relation.muscle?.groupKey ?? "other",
                  },
                }))
              : [],
          }))
        : [],
    })
  );

  // =========================================
  // 1. Rachas por tipo de actividad por semana
  // =========================================
  const weekKeysByType: Record<ActivityType, string[]> = {
    gym: [],
    run: [],
    sport: [],
    mobility: [],
    other: [],
  };

  for (const activity of activities) {
    weekKeysByType[activity.type].push(formatWeekKey(activity.startedAt));
  }

  const activityTypeWeekStreaks: Record<ActivityType, number> = {
    gym: getCurrentConsecutiveStreak(weekKeysByType.gym),
    run: getCurrentConsecutiveStreak(weekKeysByType.run),
    sport: getCurrentConsecutiveStreak(weekKeysByType.sport),
    mobility: getCurrentConsecutiveStreak(weekKeysByType.mobility),
    other: getCurrentConsecutiveStreak(weekKeysByType.other),
  };

  // =========================================
  // 2. Racha de semanas perfectas
  // Semana perfecta = llegó al weeklyGoal
  // =========================================
  const activityCountByWeek = new Map<string, number>();

  for (const activity of activities) {
    const weekKey = formatWeekKey(activity.startedAt);
    activityCountByWeek.set(weekKey, (activityCountByWeek.get(weekKey) ?? 0) + 1);
  }

  const perfectWeekKeys = [...activityCountByWeek.entries()]
    .filter(([, count]) => count >= weeklyGoal)
    .map(([weekKey]) => weekKey);

  const perfectWeekStreak = getCurrentConsecutiveStreak(perfectWeekKeys);

  // =========================================
  // 3. Racha de fines de semana con actividad
  // =========================================
  const weekendKeys = activities
    .filter((activity) => isWeekend(activity.startedAt))
    .map((activity) => getWeekendKey(activity.startedAt));

  const weekendActivityStreak = getCurrentConsecutiveWeekendStreak(weekendKeys);

  // =========================================
  // 4. Conteo rolling 30 días por grupo muscular
  // Cuenta una actividad si el grupo aporta al menos 20%
  // =========================================
  const rollingWindowStart = addDays(new Date(), -30);
  rollingWindowStart.setHours(0, 0, 0, 0);

  const muscleGroupRolling30Days: Record<string, number> = {};

  for (const activity of activities) {
    if (activity.startedAt < rollingWindowStart) continue;

    const groupShare = calculateActivityMuscleGroupShare(activity);

    for (const [groupKey, sharePct] of groupShare.entries()) {
      if (sharePct >= 20) {
        muscleGroupRolling30Days[groupKey] =
          (muscleGroupRolling30Days[groupKey] ?? 0) + 1;
      }
    }
  }

  // =========================================
  // 5. Tipos distintos de actividad en la última temporada del usuario
  // =========================================
  const latestSeasonMember = await prisma.seasonMember.findFirst({
    where: {
      userId,
      leftAt: null,
    },
    orderBy: {
      joinedAt: "desc",
    },
    select: {
      seasonId: true,
    },
  });

  let latestSeasonId: string | null = latestSeasonMember?.seasonId ?? null;
  let distinctActivityTypesInLatestSeason = 0;

  if (latestSeasonId) {
    const activitySeasons = await prisma.activitySeason.findMany({
      where: {
        seasonId: latestSeasonId,
        activity: {
          userId,
        },
      },
      select: {
        activity: {
          select: {
            type: true,
          },
        },
      },
    });

    const distinctTypes = new Set<string>();

    for (const row of activitySeasons as any[]) {
      const type = row.activity?.type;
      if (type) distinctTypes.add(type);
    }

    distinctActivityTypesInLatestSeason = distinctTypes.size;
  }

  return {
    userId,
    weeklyGoal,
    activityTypeWeekStreaks,
    perfectWeekStreak,
    weekendActivityStreak,
    muscleGroupRolling30Days,
    distinctActivityTypesInLatestSeason,
    latestSeasonId,
  };
}