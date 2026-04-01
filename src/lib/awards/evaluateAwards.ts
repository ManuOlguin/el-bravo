import { prisma } from "@/src/lib/db";
import { getUserAwardMetrics } from "@/src/lib/awards/getUserAwardMetrics";

type AwardCriteria =
  | {
      kind: "activity_type_week_streak";
      activityType: "gym" | "run" | "sport" | "mobility" | "other";
      minPerWeek: number;
      target: number;
    }
  | {
      kind: "perfect_week_streak";
      target: number;
    }
  | {
      kind: "weekend_activity_streak";
      target: number;
    }
  | {
      kind: "muscle_group_activities_rolling_days";
      muscleGroup: string;
      target: number;
      daysWindow: number;
    }
  | {
      kind: "distinct_activity_types_in_season";
      target: number;
      allowedTypes?: string[];
    };

export type EvaluatedAward = {
  id: string;
  code: string;
  name: string;
  description: string;
  iconKey: string | null;
  category: string | null;
  level: number | null;
  scope: string;
  pointsBonus: number;
  earned: boolean;
  progressCurrent: number;
  progressTarget: number;
  progressPct: number;
  seasonId: string | null;
};

function clampPct(current: number, target: number) {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

function isAwardCriteria(value: unknown): value is AwardCriteria {
  if (!value || typeof value !== "object") return false;

  const kind = (value as any).kind;

  return [
    "activity_type_week_streak",
    "perfect_week_streak",
    "weekend_activity_streak",
    "muscle_group_activities_rolling_days",
    "distinct_activity_types_in_season",
  ].includes(kind);
}

function evaluateFromCriteria(
  criteria: AwardCriteria,
  metrics: Awaited<ReturnType<typeof getUserAwardMetrics>>
): {
  progressCurrent: number;
  progressTarget: number;
  earned: boolean;
  seasonId: string | null;
} {
  switch (criteria.kind) {
    case "activity_type_week_streak": {
      const progressCurrent =
        metrics.activityTypeWeekStreaks[criteria.activityType] ?? 0;
      const progressTarget = criteria.target;

      return {
        progressCurrent,
        progressTarget,
        earned: progressCurrent >= progressTarget,
        seasonId: null,
      };
    }

    case "perfect_week_streak": {
      const progressCurrent = metrics.perfectWeekStreak;
      const progressTarget = criteria.target;

      return {
        progressCurrent,
        progressTarget,
        earned: progressCurrent >= progressTarget,
        seasonId: null,
      };
    }

    case "weekend_activity_streak": {
      const progressCurrent = metrics.weekendActivityStreak;
      const progressTarget = criteria.target;

      return {
        progressCurrent,
        progressTarget,
        earned: progressCurrent >= progressTarget,
        seasonId: null,
      };
    }

    case "muscle_group_activities_rolling_days": {
      const progressCurrent =
        metrics.muscleGroupRolling30Days[criteria.muscleGroup] ?? 0;
      const progressTarget = criteria.target;

      return {
        progressCurrent,
        progressTarget,
        earned: progressCurrent >= progressTarget,
        seasonId: null,
      };
    }

    case "distinct_activity_types_in_season": {
      const progressCurrent = metrics.distinctActivityTypesInLatestSeason;
      const progressTarget = criteria.target;

      return {
        progressCurrent,
        progressTarget,
        earned: progressCurrent >= progressTarget,
        seasonId: metrics.latestSeasonId,
      };
    }

    default: {
      return {
        progressCurrent: 0,
        progressTarget: 1,
        earned: false,
        seasonId: null,
      };
    }
  }
}

export async function evaluateAwardsForUser(userId: string): Promise<EvaluatedAward[]> {
  const [definitions, metrics] = await Promise.all([
    prisma.awardDefinition.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { category: "asc" },
        { level: "asc" },
        { createdAt: "asc" },
      ],
    }),
    getUserAwardMetrics(userId),
  ]);

  const evaluated: EvaluatedAward[] = [];

  for (const definition of definitions as any[]) {
    const rawCriteria = definition.criteria;

    if (!isAwardCriteria(rawCriteria)) {
      continue;
    }

    const result = evaluateFromCriteria(rawCriteria, metrics);

    evaluated.push({
      id: definition.id,
      code: definition.code,
      name: definition.name,
      description: definition.description,
      iconKey: definition.iconKey ?? null,
      category: definition.category ?? null,
      level: definition.level ?? null,
      scope: definition.scope,
      pointsBonus: Number(definition.pointsBonus ?? 0),
      earned: result.earned,
      progressCurrent: result.progressCurrent,
      progressTarget: result.progressTarget,
      progressPct: clampPct(result.progressCurrent, result.progressTarget),
      seasonId: result.seasonId,
    });
  }

  return evaluated;
}