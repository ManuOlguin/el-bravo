import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/currentUser";
import LogoutButton from "@/src/components/LogoutButton";
import { prisma } from "@/src/lib/db";
import { evaluateAwardsForUser } from "@/src/lib/awards/evaluateAwards";
import DeleteActivityButton from "@/src/components/DeleteActivityButton";

type ActivityExerciseItem = {
  id: string;
  sets: number;
  reps: number;
  exercise: {
    id: string;
    name: string;
  };
};

type ActivityForStats = {
  id: string;
  type: string;
  notes: string | null;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number | null;
  exercises: ActivityExerciseItem[];
};

type MembershipItem = {
  id: string;
  joinedAt: Date;
  role: string;
  groupId: string;
  group: {
    id: string;
    name: string;
    photoUrl: string | null;
  };
};

type RoutineItem = {
  id: string;
  name: string;
  exercises: {
    id: string;
    exercise: {
      id: string;
      name: string;
    };
  }[];
};

type ProfileAwardItem = {
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

function getActivityDurationMinutes(activity: {
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number | null;
}) {
  if (typeof activity.durationMinutes === "number" && activity.durationMinutes > 0) {
    return activity.durationMinutes;
  }

  const started = new Date(activity.startedAt).getTime();
  const ended = new Date(activity.endedAt).getTime();
  const diff = ended - started;

  if (Number.isNaN(diff) || diff <= 0) return 0;

  return Math.round(diff / 60000);
}

function getWeekStart(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  d.setDate(d.getDate() + diff);
  return d;
}

function getWeekKey(date: Date) {
  return getWeekStart(date).toISOString().slice(0, 10);
}

function getCurrentConsecutiveWeekStreak(
  weekCounts: Map<string, number>,
  predicate: (count: number) => boolean
) {
  let streak = 0;
  let cursor = getWeekStart(new Date());

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    const count = weekCounts.get(key) ?? 0;

    if (!predicate(count)) {
      break;
    }

    streak += 1;
    cursor = addDays(cursor, -7);
  }

  return streak;
}

function formatMinutes(totalMinutes: number) {
  if (!totalMinutes || totalMinutes <= 0) return "0m";

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}m`;
}

function formatDateLabel(date: Date) {
  return new Date(date).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTimeLabel(date: Date) {
  return new Date(date).toLocaleString("es-AR");
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function computeProfileStats(activities: ActivityForStats[], weeklyGoal: number) {
  const now = new Date();
  const currentWeekKey = getWeekKey(now);
  const currentWeekStart = getWeekStart(now);

  const weekCounts = new Map<string, number>();
  const weekMinutes = new Map<string, number>();

  let totalMinutes = 0;
  let longestWorkoutMinutes = 0;

  for (const activity of activities) {
    const minutes = getActivityDurationMinutes(activity);
    const weekKey = getWeekKey(activity.startedAt);

    totalMinutes += minutes;
    longestWorkoutMinutes = Math.max(longestWorkoutMinutes, minutes);

    weekCounts.set(weekKey, (weekCounts.get(weekKey) ?? 0) + 1);
    weekMinutes.set(weekKey, (weekMinutes.get(weekKey) ?? 0) + minutes);
  }

  const sortedWeekStarts = Array.from(
    new Set(
      activities.map((activity: ActivityForStats) => getWeekStart(activity.startedAt).getTime())
    )
  )
    .sort((a, b) => a - b)
    .map((time) => new Date(time));

  let longestActiveStreak = 0;
  let currentHistoricalStreak = 0;
  let previousWeekStart: Date | null = null;

  for (const weekStart of sortedWeekStarts) {
    if (!previousWeekStart) {
      currentHistoricalStreak = 1;
    } else {
      const diffDays =
        (weekStart.getTime() - previousWeekStart.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays === 7) {
        currentHistoricalStreak += 1;
      } else {
        currentHistoricalStreak = 1;
      }
    }

    longestActiveStreak = Math.max(longestActiveStreak, currentHistoricalStreak);
    previousWeekStart = weekStart;
  }

  const allWeekStartsDesc = Array.from(weekCounts.keys())
    .map((weekKey) => getWeekStart(new Date(`${weekKey}T12:00:00`)))
    .sort((a, b) => b.getTime() - a.getTime());

  let currentActiveWeeks = 0;
  let currentPerfectWeeks = 0;

  for (const weekStart of allWeekStartsDesc) {
    const weekKey = getWeekKey(weekStart);
    const count = weekCounts.get(weekKey) ?? 0;
    const isCurrentWeek = weekStart.getTime() === currentWeekStart.getTime();

    if (isCurrentWeek) {
      if (count >= 1) {
        currentActiveWeeks += 1;
      }
      continue;
    }

    if (count >= 1) {
      currentActiveWeeks += 1;
    } else {
      break;
    }
  }

  for (const weekStart of allWeekStartsDesc) {
    const weekKey = getWeekKey(weekStart);
    const count = weekCounts.get(weekKey) ?? 0;
    const isCurrentWeek = weekStart.getTime() === currentWeekStart.getTime();

    if (isCurrentWeek) {
      if (count >= weeklyGoal) {
        currentPerfectWeeks += 1;
      }
      continue;
    }

    if (count >= weeklyGoal) {
      currentPerfectWeeks += 1;
    } else {
      break;
    }
  }

  const workoutsThisWeek = weekCounts.get(currentWeekKey) ?? 0;
  const maxWeeklyMinutes = Math.max(0, ...Array.from(weekMinutes.values()));
  const averageMinutes =
    activities.length > 0 ? Math.round(totalMinutes / activities.length) : 0;

  return {
    activeWeeks: currentActiveWeeks,
    workoutsThisWeek,
    perfectWeeks: currentPerfectWeeks,
    longestActiveStreak,
    maxWeeklyMinutes,
    longestWorkoutMinutes,
    totalMinutes,
    averageMinutes,
  };
}

function getTypeLabel(type: string) {
  switch (type) {
    case "gym":
      return "Gym";
    case "run":
      return "Run";
    case "sport":
      return "Deporte";
    case "mobility":
      return "Movilidad";
    default:
      return "Otro";
  }
}

function getAwardShortLabel(name: string) {
  if (name.length <= 12) return name;
  return `${name.slice(0, 12)}…`;
}

function getAwardRingClasses(level: number | null) {
  switch (level) {
    case 3:
      return {
        border: "border-yellow-400",
        bg: "bg-yellow-500/10",
        text: "text-yellow-300",
        glow: "shadow-[0_0_18px_rgba(250,204,21,0.25)]",
      };
    case 2:
      return {
        border: "border-slate-300",
        bg: "bg-slate-200/10",
        text: "text-slate-200",
        glow: "shadow-[0_0_18px_rgba(226,232,240,0.18)]",
      };
    case 1:
    default:
      return {
        border: "border-amber-600",
        bg: "bg-amber-700/10",
        text: "text-amber-300",
        glow: "shadow-[0_0_18px_rgba(217,119,6,0.2)]",
      };
  }
}

function ProfileStatCard({
  label,
  value,
  highlight = false,
  subtitle,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  subtitle?: string;
}) {
  return (
    <div
      className={`rounded-xl p-5 ${
        highlight ? "bg-lime-600 text-white" : "bg-slate-700 text-white"
      }`}
    >
      <div className="text-4xl font-bold leading-none">{value}</div>
      <div className="mt-3 text-sm font-medium opacity-90">{label}</div>
      {subtitle ? <div className="mt-1 text-xs opacity-75">{subtitle}</div> : null}
    </div>
  );
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!dbUser) redirect("/home");

  const [activitiesRaw, membershipsRaw, routinesRaw, evaluatedAwardsRaw] = await Promise.all([
    prisma.activity.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        type: true,
        notes: true,
        startedAt: true,
        endedAt: true,
        exercises: {
          select: {
            id: true,
            sets: true,
            reps: true,
            exercise: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { startedAt: "desc" },
      take: 50,
    }),
    prisma.groupMember.findMany({
      where: {
        userId: user.id,
        leftAt: null,
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            photoUrl: true,
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    }),
    prisma.routine.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        exercises: {
          select: {
            id: true,
            exercise: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    evaluateAwardsForUser(user.id),
  ]);

  const activities = activitiesRaw as unknown as ActivityForStats[];
  const memberships = membershipsRaw as unknown as MembershipItem[];
  const routines = routinesRaw as unknown as RoutineItem[];
  const evaluatedAwards = evaluatedAwardsRaw as ProfileAwardItem[];

  const earnedAwards = evaluatedAwards
    .filter((award) => award.earned)
    .sort((a, b) => {
      const levelDiff = (b.level ?? 0) - (a.level ?? 0);
      if (levelDiff !== 0) return levelDiff;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 6);

  const profileWeeklyGoal =
    (dbUser as typeof dbUser & { weeklyGoal?: number | null }).weeklyGoal ?? 3;
  const stats = computeProfileStats(activities, profileWeeklyGoal);

  return (
    <main className="min-h-screen bg-[#08142d] p-6 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <a
              href="/home"
              className="inline-flex items-center rounded-md bg-slate-600 px-4 py-2 text-sm font-medium hover:bg-slate-500"
            >
              ← Volver a la home
            </a>
            <a
              href="/profile/edit"
              className="inline-flex items-center rounded-lg bg-gradient-to-b from-lime-600 to-lime-800 px-4 py-2 text-sm font-semibold text-white shadow-md hover:from-lime-500 hover:to-lime-700"
            >
              Editar perfil
            </a>
          </div>

          <LogoutButton />
        </div>

        <section className="rounded-2xl bg-slate-800 p-6 shadow-lg">
          <div className="space-y-5">
            <div className="rounded-2xl bg-slate-900/60 p-5">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-5">
                  <div className="h-24 w-24 overflow-hidden rounded-3xl bg-slate-700">
                    {dbUser.photoUrl ? (
                      <img
                        src={dbUser.photoUrl}
                        alt={dbUser.name ?? dbUser.email}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl text-slate-200">
                        {(dbUser.name || dbUser.email || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div>
                    <h1 className="text-4xl font-bold leading-tight">
                      {dbUser.name ?? "Sin nombre"}
                    </h1>
                    <p className="mt-1 text-sm text-slate-400">{dbUser.email}</p>
                    <p className="mt-3 text-xs text-slate-400">
                      Objetivo semanal:{" "}
                      <span className="font-semibold text-slate-200">
                        {profileWeeklyGoal} entrenamientos
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 md:min-w-[420px]">
                  <ProfileStatCard label="semanas activas" value={stats.activeWeeks} />
                  <ProfileStatCard
                    label="entrenamientos esta semana"
                    value={stats.workoutsThisWeek}
                  />
                  <ProfileStatCard
                    label="semanas perfectas"
                    value={stats.perfectWeeks}
                    highlight
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr_1fr]">
              <div className="rounded-2xl bg-slate-900/70 p-5">
                <div className="grid grid-cols-2 gap-4">
                  <ProfileStatCard
                    label="racha activa más larga"
                    value={stats.longestActiveStreak}
                    subtitle="semanas consecutivas"
                  />
                  <ProfileStatCard
                    label="más minutos en una semana"
                    value={formatMinutes(stats.maxWeeklyMinutes)}
                  />
                  <ProfileStatCard
                    label="entrenamiento más largo"
                    value={formatMinutes(stats.longestWorkoutMinutes)}
                  />
                  <ProfileStatCard
                    label="minutos totales"
                    value={formatMinutes(stats.totalMinutes)}
                    subtitle={`promedio ${formatMinutes(stats.averageMinutes)}`}
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900/70 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                    Badges / awards
                  </div>
                  <div className="text-xs text-slate-400">
                    {earnedAwards.length} ganadas
                  </div>
                </div>

                <div className="grid min-h-[220px] grid-cols-3 place-items-center gap-x-4 gap-y-6">
                  {Array.from({ length: 6 }).map((_, index) => {
                    const award = earnedAwards[index];

                    if (!award) {
                      return (
                        <div
                          key={`empty-award-${index}`}
                          className="flex w-full flex-col items-center justify-center gap-3"
                        >
                          <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-slate-500 bg-slate-800/80">
                            <div className="h-10 w-10 rounded-full border-2 border-slate-600" />
                          </div>

                          <span className="text-center text-xs text-slate-500">Vacía</span>
                        </div>
                      );
                    }

                    const ring = getAwardRingClasses(award.level);

                    return (
                      <div
                        key={award.code}
                        className="flex w-full flex-col items-center justify-center gap-3"
                      >
                        <div
                          title={award.description}
                          className={`flex h-20 w-20 items-center justify-center rounded-full border-4 ${ring.border} ${ring.bg} ${ring.text} ${ring.glow} transition-transform hover:scale-105`}
                        >
                          <span className="px-1 text-center text-[10px] font-bold leading-tight">
                            {getAwardShortLabel(award.name)}
                          </span>
                        </div>

                        <span className="text-center text-xs text-slate-300">
                          {award.name}
                        </span>
                      </div>
                    );
                  })}
                </div>

                
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/70 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-lg font-semibold">Rutinas</div>
                <a
                  href="/routine"
                  className="rounded-lg bg-gradient-to-b from-lime-600 to-lime-800 px-4 py-2 text-sm font-semibold text-white shadow-md hover:from-lime-500 hover:to-lime-700"
                >
                  Ver mis rutinas
                </a>
              </div>

              {routines.length === 0 ? (
                <div className="rounded-xl bg-slate-800 p-4 text-sm text-slate-400">
                  Todavía no tenés rutinas creadas.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {routines.map((routine: RoutineItem) => (
                    <div
                      key={routine.id}
                      className="rounded-xl bg-gradient-to-r from-red-700/80 to-violet-700/80 p-[1px]"
                    >
                      <div className="rounded-xl bg-slate-900 px-4 py-5">
                        <div className="text-lg font-bold">{routine.name}</div>
                        <div className="mt-2 text-sm text-slate-300">
                          {routine.exercises.length} ejercicio
                          {routine.exercises.length === 1 ? "" : "s"}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {routine.exercises
                            .slice(0, 3)
                            .map((item: RoutineItem["exercises"][number]) => (
                              <span
                                key={item.id}
                                className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300"
                              >
                                {item.exercise.name}
                              </span>
                            ))}

                          {routine.exercises.length > 3 ? (
                            <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-400">
                              +{routine.exercises.length - 3}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_1fr]">
              <div className="rounded-2xl bg-slate-900/70 p-5">
                <div className="mb-4 text-lg font-semibold">Actividad reciente</div>

                {activities.length === 0 ? (
                  <div className="rounded-xl bg-slate-800 p-4 text-sm text-slate-400">
                    No hay actividad cargada todavía.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activities.slice(0, 8).map((activity: ActivityForStats) => {
                      const minutes = getActivityDurationMinutes(activity);

                      return (
                        <div
                          key={activity.id}
                          className="relative rounded-xl bg-slate-800 px-4 py-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-xl font-semibold">
                                {formatDateLabel(activity.startedAt)}
                              </div>
                              <div className="mt-1 text-sm text-slate-400">
                                {formatMinutes(minutes)}
                              </div>
                            </div>

                            <div className="text-right text-sm text-slate-400">
                              {formatDateTimeLabel(activity.startedAt)}
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-indigo-600/20 px-3 py-1 text-xs font-medium text-indigo-300">
                              {getTypeLabel(activity.type)}
                            </span>

                            {activity.exercises
                              .slice(0, 4)
                              .map((item: ActivityExerciseItem) => (
                                <span
                                  key={item.id}
                                  className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300"
                                >
                                  {item.exercise.name}
                                </span>
                              ))}
                          </div>

                          {activity.notes ? (
                            <p className="mt-3 text-sm text-slate-300">“{activity.notes}”</p>
                          ) : null}
                          <div className="absolute bottom-3 right-3">
                            <DeleteActivityButton activityId={activity.id} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-slate-900/70 p-5">
                <div className="mb-4 text-lg font-semibold">Mis grupos</div>

                {memberships.length === 0 ? (
                  <div className="rounded-xl bg-slate-800 p-4 text-sm text-slate-400">
                    No pertenecés a ningún grupo todavía.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {memberships.map((membership: MembershipItem) => (
                      <a
                        key={membership.id}
                        href={`/group/${membership.groupId}`}
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-800 p-4 transition hover:bg-slate-700"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 overflow-hidden rounded-full bg-slate-600">
                            {membership.group.photoUrl ? (
                              <img
                                src={membership.group.photoUrl}
                                alt={membership.group.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-200">
                                {membership.group.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="font-semibold">{membership.group.name}</div>
                            <div className="text-sm text-slate-400">Rol: {membership.role}</div>
                          </div>
                        </div>

                        <div className="text-sm text-slate-400">
                          {new Date(membership.joinedAt).toLocaleDateString("es-AR")}
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}