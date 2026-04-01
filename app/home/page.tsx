import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/currentUser";
import LogoutButton from "@/src/components/LogoutButton";
import JoinGroupModal from "@/src/components/JoinGroupModal";
import { prisma } from "@/src/lib/db";

type ActivityForHome = {
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number | null;
};

type HomeRoutineItem = {
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

type HomeMembershipItem = {
  id: string;
  joinedAt: Date;
  role: string;
  groupId: string;
  group: {
    id: string;
    name: string;
    photoUrl: string | null;
    members: {
      user: {
        id: string;
        name: string | null;
        email: string;
        photoUrl: string | null;
      };
    }[];
    seasons: {
      id: string;
      name: string | null;
      startDate: Date;
      endDate: Date | null;
    }[];
  };
};

function getInitial(value: string | null | undefined) {
  return (value || "U").charAt(0).toUpperCase();
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

function computeHomeStats(
  activities: ActivityForHome[],
  weeklyGoal: number
) {
  const now = new Date();
  const currentWeekKey = getWeekKey(now);
  const currentWeekStart = getWeekStart(now);

  const weekCounts = new Map<string, number>();

  for (const activity of activities) {
    const key = getWeekKey(activity.startedAt);
    weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
  }

  const allWeekStartsDesc = Array.from(weekCounts.keys())
    .map((weekKey) => getWeekStart(new Date(`${weekKey}T12:00:00`)))
    .sort((a, b) => b.getTime() - a.getTime());

  let activeWeeks = 0;
  let perfectWeeks = 0;

  for (const weekStart of allWeekStartsDesc) {
    const weekKey = getWeekKey(weekStart);
    const count = weekCounts.get(weekKey) ?? 0;
    const isCurrentWeek = weekStart.getTime() === currentWeekStart.getTime();

    if (isCurrentWeek) {
      if (count >= 1) {
        activeWeeks += 1;
      }
      continue;
    }

    if (count >= 1) {
      activeWeeks += 1;
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
        perfectWeeks += 1;
      }
      continue;
    }

    if (count >= weeklyGoal) {
      perfectWeeks += 1;
    } else {
      break;
    }
  }

  const workoutsThisWeek = weekCounts.get(currentWeekKey) ?? 0;

  return {
    activeWeeks,
    perfectWeeks,
    workoutsThisWeek,
  };
}

function isSeasonActive(season: {
  startDate: Date;
  endDate: Date | null;
} | null) {
  if (!season) return false;

  const now = new Date();
  const start = new Date(season.startDate);
  const end = season.endDate ? new Date(season.endDate) : null;

  if (now < start) return false;
  if (end && now > end) return false;

  return true;
}

function getGroupCardClasses(hasActiveSeason: boolean) {
  if (hasActiveSeason) {
    return "bg-gradient-to-r from-lime-900/70 via-yellow-900/35 to-slate-900 hover:brightness-110";
  }

  return "bg-slate-900 hover:bg-slate-800";
}

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      name: true,
      email: true,
      photoUrl: true,
      weeklyGoal: true,
    },
  });

  if (!dbUser) {
    redirect("/login");
  }

  const [membershipsRaw, routinesRaw, activitiesRaw] = await Promise.all([
    prisma.groupMember.findMany({
      where: {
        userId: user.id,
        leftAt: null,
      },
      orderBy: {
        joinedAt: "desc",
      },
      include: {
        group: {
          include: {
            members: {
              where: { leftAt: null },
              select: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    photoUrl: true,
                  },
                },
              },
            },
            seasons: {
              orderBy: {
                startDate: "desc",
              },
              take: 1,
              select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true,
              },
            },
          },
        },
      },
    }),
    prisma.routine.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
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
    }),
    prisma.activity.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        startedAt: "desc",
      },
      select: {
        startedAt: true,
        endedAt: true,
        durationMinutes: true,
      },
    }),
  ]);

  const memberships = membershipsRaw as unknown as HomeMembershipItem[];
  const routines = routinesRaw as unknown as HomeRoutineItem[];
  const activities = activitiesRaw as unknown as ActivityForHome[];

  const weeklyGoal =
    typeof dbUser.weeklyGoal === "number" && dbUser.weeklyGoal > 0
      ? dbUser.weeklyGoal
      : 3;

  const stats = computeHomeStats(activities, weeklyGoal);

  const totalDots = Math.min(
    Math.max(weeklyGoal, stats.workoutsThisWeek, 1),
    7
  );
  const filledDots = Math.min(stats.workoutsThisWeek, 7);

  return (
    <main className="min-h-screen bg-[#08142d] p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-[28px] bg-slate-800/80 p-6 shadow-2xl">
          <div className="mb-5 flex items-start justify-between gap-4">
            <a href="/profile" className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-slate-700 text-slate-200">
                {dbUser.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={dbUser.photoUrl}
                    alt={dbUser.name ?? dbUser.email}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{getInitial(dbUser.name ?? dbUser.email)}</span>
                )}
              </div>

              <div>
                <div className="text-sm text-slate-300">Hola,</div>
                <div className="text-4xl font-bold leading-tight">
                  {dbUser.name ?? dbUser.email}
                </div>
                <div className="mt-1 text-sm text-slate-400">
                  🔥 Estás cerca de una semana perfecta.
                </div>
              </div>
            </a>

            <LogoutButton />
          </div>

          <div className="mb-5">
            <a
              href="/load"
              className="block w-full rounded-xl bg-gradient-to-b from-lime-600 to-lime-800 px-6 py-4 text-center text-xl font-semibold text-white shadow-md transition hover:from-lime-500 hover:to-lime-700"
            >
              Registrar entrenamiento
            </a>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-900/70 p-6 text-center">
              <div className="text-6xl font-bold leading-none text-white">
                {stats.activeWeeks}
              </div>
              <div className="mt-4 text-3xl font-semibold text-slate-300">
                semanas activas
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/70 p-6 text-center">
              <div className="mb-4 flex items-center justify-center gap-3">
                {Array.from({ length: totalDots }).map((_, index) => {
                  const filled = index < filledDots;

                  return (
                    <span
                      key={index}
                      className={`block h-10 w-10 rounded-full border-4 ${
                        filled
                          ? "border-lime-500 bg-lime-500/30"
                          : "border-slate-700 bg-transparent"
                      }`}
                    />
                  );
                })}
              </div>

              <div className="text-3xl font-semibold text-slate-300">
                entrenamientos esta semana
              </div>
            </div>

            <div className="rounded-2xl bg-lime-600 p-6 text-center text-white">
              <div className="text-6xl font-bold leading-none">
                {stats.perfectWeeks}
              </div>
              <div className="mt-4 text-3xl font-semibold text-lime-100">
                semanas perfectas
              </div>
            </div>
          </div>

          <section className="mb-5 rounded-2xl bg-slate-900/70 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-white">Rutinas</div>
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
                {routines.map((routine) => (
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
                        {routine.exercises.slice(0, 3).map((item) => (
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

                <a
                  href="/create-routine"
                  className="flex min-h-[156px] items-center justify-center rounded-xl bg-slate-700 text-6xl font-bold text-white transition hover:bg-slate-600"
                >
                  +
                </a>
              </div>
            )}
          </section>

          <section className="rounded-2xl bg-slate-900/70 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold text-white">Grupos</div>

              <div className="flex items-center gap-2">
                <JoinGroupModal />
                <a
                  href="/create-group"
                  className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500"
                >
                  Crear grupo
                </a>
              </div>
            </div>

            {memberships.length === 0 ? (
              <div className="rounded-xl bg-slate-800 p-4 text-sm text-slate-400">
                No estás en ningún grupo todavía.
              </div>
            ) : (
              <div className="space-y-3">
                {memberships.map((membership) => {
                  const season = membership.group.seasons?.[0] ?? null;
                  const activeSeason = isSeasonActive(season);

                  return (
                    <a
                      key={membership.id}
                      href={`/group/${membership.groupId}`}
                      className={`flex items-center justify-between gap-4 rounded-2xl p-4 transition ${getGroupCardClasses(
                        activeSeason
                      )}`}
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-slate-700 text-3xl font-bold text-white">
                          {membership.group.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={membership.group.photoUrl}
                              alt={membership.group.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>{getInitial(membership.group.name)}</span>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-3xl font-bold text-white">
                            {membership.group.name}
                          </div>

                          <div className="mt-1 text-sm text-slate-300">
                            {season
                              ? season.name ?? "Temporada activa"
                              : "Sin temporada activa"}
                          </div>

                          <div className="mt-1 text-sm text-slate-400">
                            Miembros ({membership.group.members.length}) · Tu rol:{" "}
                            {membership.role}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {membership.group.members.slice(0, 3).map((member) => (
                          <div
                            key={member.user.id}
                            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-700 text-xs text-white"
                            title={member.user.name ?? member.user.email}
                          >
                            {member.user.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={member.user.photoUrl}
                                alt={member.user.name ?? member.user.email}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span>
                                {getInitial(member.user.name ?? member.user.email)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}