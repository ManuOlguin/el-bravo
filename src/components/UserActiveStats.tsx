"use client";

import { addWeeks, weekKeyOf, DEFAULT_TZ, type WeekKey } from "@/src/lib/time";

type WorkoutLike = {
  date?: Date | string;
  startedAt?: Date | string;
};

type Props = {
  activities: WorkoutLike[];
  weeklyRequired: number;
  timezone?: string;
};

function getActivityDate(a: WorkoutLike): Date | null {
  const raw = a.date ?? a.startedAt;
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

/** Racha de semanas consecutivas (hasta la actual) que cumplen `min`. La semana en curso no corta la racha. */
function weekStreak(weekCounts: Map<WeekKey, number>, currentWeek: WeekKey, min: number) {
  let streak = (weekCounts.get(currentWeek) ?? 0) >= min ? 1 : 0;
  for (let w = addWeeks(currentWeek, -1); (weekCounts.get(w) ?? 0) >= min; w = addWeeks(w, -1)) streak++;
  return streak;
}

function computeStreaks(activities: WorkoutLike[], weeklyRequired: number, tz: string) {
  if (!activities.length || weeklyRequired <= 0) {
    return { normalStreak: 0, goldenStreak: 0, currentWeekCount: 0 };
  }
  const weekCounts = new Map<WeekKey, number>();
  for (const a of activities) {
    const d = getActivityDate(a);
    if (!d) continue;
    const key = weekKeyOf(d, tz);
    weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
  }
  const currentWeek = weekKeyOf(new Date(), tz);
  return {
    normalStreak: weekStreak(weekCounts, currentWeek, 1),
    goldenStreak: weekStreak(weekCounts, currentWeek, weeklyRequired),
    currentWeekCount: weekCounts.get(currentWeek) ?? 0,
  };
}

export default function UserActiveStats({ activities, weeklyRequired, timezone = DEFAULT_TZ }: Props) {
  const { normalStreak, goldenStreak, currentWeekCount } = computeStreaks(activities, weeklyRequired, timezone);

  const baseCircles = Math.max(weeklyRequired, 0);
  const hasExtra = currentWeekCount > weeklyRequired;

  return (
    <div className="mt-[10px] grid w-full grid-cols-2 gap-[10px] sm:flex sm:gap-3">
      {/* Card 1 - semanas activas */}
      <div className="rounded-lg bg-[#3b4f6c] p-4 sm:w-1/3">
        <div className="text-center text-5xl font-bold text-white">{normalStreak}</div>
        <div className="text-center text-md font-semibold text-white/80">
          semanas activas
        </div>
      </div>

      {/* Card 2 - semanas perfectas */}
      <div className="rounded-lg bg-lime-600 p-4 sm:w-1/3">
        <div className="text-center text-5xl font-bold text-white">{goldenStreak}</div>
        <div className="text-center text-md font-semibold text-white/80">
          semanas perfectas
        </div>
      </div>

      {/* Card 3 - entrenamientos esta semana */}
      <div className="col-span-2 min-w-[270px] rounded-lg bg-[#1f2f4a] p-4 sm:w-1/3">
        <div className="mb-2 flex justify-center gap-4">
          {Array.from({ length: baseCircles }).map((_, idx) => {
            const filled = idx < currentWeekCount;

            return (
              <div
                key={idx}
                className={
                  "h-11 w-11 rounded-full border-[6px] transition-colors " +
                  (filled
                    ? "border-[#465902] bg-gradient-to-b from-[#8AC617] to-[#63710B]"
                    : "border-[#41556f] bg-transparent")
                }
              />
            );
          })}

          {hasExtra && (
            <div
              className="h-11 w-11 rounded-full border-[6px] border-[#90AB3A] bg-gradient-to-b from-[#E6FFBE] to-[#9FFF00]"
              title="Entrenamientos extra esta semana"
            />
          )}
        </div>

        <div className="text-center text-md font-semibold text-white/80">
          entrenamientos esta semana
        </div>
      </div>
    </div>
  );
}