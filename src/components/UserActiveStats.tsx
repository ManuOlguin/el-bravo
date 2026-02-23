// src/components/UserActiveStats.tsx
"use client";

type WorkoutLike = {
  date?: Date | string;
  startedAt?: Date | string;
};

type Props = {
  activities: WorkoutLike[];
  weeklyRequired: number;
};

function toLocalDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// Lunes como inicio de semana
function startOfWeekMonday(d: Date) {
  const day = d.getDay(); // 0 = domingo, 1 = lunes, ...
  const diff = day === 0 ? -6 : 1 - day; // si es domingo, ir 6 días atrás
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return toLocalDay(monday);
}

function getActivityDate(a: WorkoutLike): Date | null {
  const raw = (a.date ?? a.startedAt) as Date | string | undefined;
  if (!raw) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function computeStreaks(
  activities: WorkoutLike[],
  weeklyRequired: number
): {
  normalStreak: number;
  goldenStreak: number;
  currentWeekCount: number;
} {
  if (!activities.length || weeklyRequired <= 0) {
    return { normalStreak: 0, goldenStreak: 0, currentWeekCount: 0 };
  }

  const weekCounts = new Map<string, number>();
  let earliestWeekStart: Date | null = null;

  for (const a of activities) {
    const d = getActivityDate(a);
    if (!d) continue;

    const weekStart = startOfWeekMonday(d);
    const key = weekStart.toISOString().slice(0, 10);

    weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);

    if (!earliestWeekStart || weekStart < earliestWeekStart) {
      earliestWeekStart = weekStart;
    }
  }

  if (!earliestWeekStart) {
    return { normalStreak: 0, goldenStreak: 0, currentWeekCount: 0 };
  }

  const today = new Date();
  const currentWeekStart = startOfWeekMonday(today);
  const currentWeekKey = currentWeekStart.toISOString().slice(0, 10);
  const currentWeekCount = weekCounts.get(currentWeekKey) ?? 0;

  let normalStreak = 0;
  let goldenStreak = 0;

  // iteramos semana por semana desde la primera con actividad hasta la actual
  for (
    let w = new Date(earliestWeekStart);
    w <= currentWeekStart;
    w.setDate(w.getDate() + 7)
  ) {
    const weekStart = toLocalDay(w);
    const key = weekStart.toISOString().slice(0, 10);
    const count = weekCounts.get(key) ?? 0;
    const isCurrentWeek = weekStart.getTime() === currentWeekStart.getTime();

    // Racha normal: >=1 entrenamiento/semana
    if (isCurrentWeek) {
      // semana activa: si todavía no llegó a 1, NO rompe la racha
      if (count >= 1) {
        normalStreak += 1;
      }
      // si es 0, dejamos la racha como venía
    } else {
      if (count >= 1) {
        normalStreak += 1;
      } else {
        normalStreak = 0;
      }
    }

    // Racha golden: >= weeklyRequired entrenos/semana
    if (isCurrentWeek) {
      // semana activa: si todavía no llegó al mínimo, NO rompe la racha
      if (count >= weeklyRequired) {
        goldenStreak += 1;
      }
    } else {
      if (count >= weeklyRequired) {
        goldenStreak += 1;
      } else {
        goldenStreak = 0;
      }
    }
  }

  return { normalStreak, goldenStreak, currentWeekCount };
}

export default function UserActiveStats({ activities, weeklyRequired }: Props) {
  const { normalStreak, goldenStreak, currentWeekCount } = computeStreaks(
    activities,
    weeklyRequired
  );

  const baseCircles = Math.max(weeklyRequired, 0);
  const hasExtra = currentWeekCount > weeklyRequired;

  return (
    <div className="mt-[10px] w-full grid grid-cols-2 gap-[10px] sm:flex sm:gap-3">
      {/* Card 1 - semanas activas (racha normal) */}
      <div className="bg-surface p-4 rounded-lg sm:w-1/3">
        <div className="text-5xl text-gray-300 text-center">{normalStreak}</div>
        <div className="text-md font-black text-white/43 text-center">
          semanas activas
        </div>
      </div>

      {/* Card 2 - semanas perfectas (racha golden) */}
      <div className="bg-[linear-gradient(to_bottom,#8DCD19,#616C0B)] p-4 rounded-lg sm:w-1/3">
        <div className="text-5xl text-gray-300 text-center">
          {goldenStreak}
        </div>
        <div className="text-md font-semibold text-white/43 text-center">
          semanas perfectas
        </div>
      </div>

      {/* Card 3 - entrenamientos esta semana */}
      <div className="bg-surface p-4 rounded-lg col-span-2 sm:w-1/3 min-w-[270px]">
        <div className="flex justify-center gap-4 mb-1">
          {/* Circulitos base según weeklyRequired */}
          {Array.from({ length: baseCircles }).map((_, idx) => {
            const filled = idx < currentWeekCount;
            return (
              <div
              key={idx}
              className={
                "rounded-full h-11 w-11 border-6 transition-colors " +
                (filled
                ? "border-[#465902] bg-gradient-to-b from-[#8AC617] to-[#63710B]"
                : "border-[rgba(92,92,92,0.14)]")
              }
              />
            );
          })}

          {/* Extra si se pasó del mínimo semanal */}
          {hasExtra && (
            <div
              className={
                "rounded-full h-11 w-11 border-6 border-[#90AB3A] bg-gradient-to-b from-[#E6FFBE] to-[#9FFF00] "
              }
              title="Entrenamientos extra esta semana"
            />
          )}
        </div>
        <div className="font-semibold text-white/43 text-center">
          entrenamientos esta semana
        </div>
      </div>
    </div>
  );
}