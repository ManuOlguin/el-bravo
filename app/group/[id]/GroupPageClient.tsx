"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import UserActiveStats from "@/src/components/UserActiveStats";
import GroupUserCalendar from "@/src/components/GroupUserCalendar";
import InviteGroupButton from "@/src/components/InviteGroupButton";
import GroupInviteCodePanel from "@/src/components/GroupInviteCodePanel";
import GroupSettingsPopup from "@/src/components/GroupSettingsPopup";
import { formatDate as formatInstant } from "@/src/lib/time";

type MemberBadge = {
  id: string;
  name: string;
  level: number | null;
  category: string | null;
};

type MemberWithStats = {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  photoUrl: string | null;
  role: string;
  currentWeekCount: number;
  activeWeeks: number;
  perfectWeeks: number;
  badges: MemberBadge[];
};

type SeasonCard = {
  id: string;
  name: string;
  description: string | null;
  startDate: string | Date;
  endDate: string | Date;
  weeklyGoal: number;
  allowedActivityTypes: string[];
  joined: boolean;
  isActive: boolean;
  isUpcoming: boolean;
  isPast: boolean;
  members: Array<{
    id: string;
    userId: string;
    name: string | null;
    email: string | null;
    photoUrl: string | null;
  }>;
};

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

type GroupPageClientProps = {
  group: any;
  isAdmin: boolean;
  activities: any[];
  membersWithStats: MemberWithStats[];
  activeSeason: any | null;
  upcomingSeason: any | null;
  pastSeasons: any[];
  seasons: SeasonCard[];
  currentUserId: string;
  seasonLeaderboard: SeasonLeaderboardEntry[];
  userSeasonStanding: UserSeasonStanding;
  timezone: string;
};

function getInitial(value?: string | null) {
  return (value || "G").charAt(0).toUpperCase();
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("es-AR");
}

function getActivityTypeLabel(type: string) {
  switch (type) {
    case "gym":
      return "Gimnasio";
    case "run":
      return "Running";
    case "sport":
      return "Deporte";
    case "mobility":
      return "Movilidad";
    case "other":
      return "Otro";
    default:
      // Las temporadas ya envían el nombre de la categoría (ej. "Fuerza").
      return type || "Otro";
  }
}

function getBadgeLevelClass(level: number | null) {
  if (level === 3) return "border-amber-400 text-amber-300";
  if (level === 2) return "border-slate-300 text-slate-200";
  return "border-orange-400 text-orange-300";
}

export default function GroupPageClient({
  group,
  isAdmin,
  activities,
  membersWithStats,
  activeSeason,
  upcomingSeason,
  pastSeasons,
  seasons,
  currentUserId,
  seasonLeaderboard,
  userSeasonStanding,
  timezone,
}: GroupPageClientProps) {
  const router = useRouter();

  const [invitePopupOpen, setInvitePopupOpen] = useState(false);
  const [settingsPopupOpen, setSettingsPopupOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // El usuario actual llega por props (antes se pedía a /api/auth/me, que ya no existe).
  const me = useMemo(() => ({ id: currentUserId }), [currentUserId]);
  const meLoading = false;
  const meError: string | null = null;

  const myActivities = useMemo(
    () => (me ? activities.filter((activity) => activity.user?.id === me.id) : []),
    [activities, me]
  );

  async function joinSeason(seasonId: string) {
    setLoadingAction(`join-${seasonId}`);

    try {
      const res = await fetch("/api/seasons/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: group.id, seasonId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.error || "No se pudo unir a la temporada.");
        return;
      }

      router.refresh();
    } catch {
      alert("Error de red al unirte a la temporada.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function deleteSeason(seasonId: string) {
    const confirmed = window.confirm("¿Eliminar esta temporada?");
    if (!confirmed) return;

    setLoadingAction(`delete-${seasonId}`);

    try {
      const res = await fetch("/api/seasons/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: group.id, seasonId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.error || "No se pudo eliminar la temporada.");
        return;
      }

      router.refresh();
    } catch {
      alert("Error de red al eliminar la temporada.");
    } finally {
      setLoadingAction(null);
    }
  }

  async function finalizeSeason(seasonId: string) {
  const confirmed = window.confirm("¿Finalizar esta temporada?");
  if (!confirmed) return;

  setLoadingAction(`finalize-${seasonId}`);

  try {
    const res = await fetch("/api/seasons/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId: group.id, seasonId }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data?.error || "No se pudo finalizar la temporada.");
      return;
    }

    router.refresh();
  } catch {
    alert("Error de red al finalizar la temporada.");
  } finally {
    setLoadingAction(null);
  }
}

  return (
    <>
      <main className="min-h-screen bg-[#08142d] p-6 text-white">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="flex items-center justify-between gap-3">
            <a
              href="/home"
              className="inline-flex items-center rounded-md bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500"
            >
              ← Volver
            </a>
          </div>

          <div className="rounded-[28px] border border-slate-700/70 bg-slate-800/90 p-6 shadow-2xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-4">
                <div className="h-20 w-20 overflow-hidden rounded-xl bg-slate-700">
                  {group.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={group.photoUrl}
                      alt={group.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white">
                      {getInitial(group.name)}
                    </div>
                  )}
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-4xl font-bold text-white">{group.name}</h1>

                  {group.description ? (
                    <p className="mt-2 text-sm text-slate-400">{group.description}</p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {group.members.slice(0, 6).map((member: any) => (
                      <div
                        key={member.user.id}
                        className="h-8 w-8 overflow-hidden rounded-full bg-slate-700 ring-2 ring-slate-800"
                        title={member.user.name ?? member.user.email ?? "Miembro"}
                      >
                        {member.user.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={member.user.photoUrl}
                            alt={member.user.name ?? member.user.email ?? "Miembro"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
                            {getInitial(member.user.name ?? member.user.email)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start">
                {isAdmin ? (
                  <InviteGroupButton setPopupInviteOpen={setInvitePopupOpen} />
                ) : null}

                <button
                  type="button"
                  onClick={() => setSettingsPopupOpen(true)}
                  className="inline-flex items-center rounded-md bg-slate-600 px-3 py-2 text-sm font-medium text-white hover:bg-slate-500"
                  aria-label="Configuración del grupo"
                >
                  ⚙️
                </button>
              </div>
            </div>

            <GroupInviteCodePanel
              groupId={group.id}
              open={invitePopupOpen}
              onClose={() => setInvitePopupOpen(false)}
            />

            <GroupSettingsPopup
              open={settingsPopupOpen}
              onClose={() => setSettingsPopupOpen(false)}
              groupId={group.id}
              groupName={group.name}
              isAdmin={isAdmin}
              activeMemberCount={group.members.length}
              createdAt={group.createdAt}
              members={group.members.map((m: { userId: string; role: string; user: { name: string | null; photoUrl: string | null } }) => ({ userId: m.userId, name: m.user.name, photoUrl: m.user.photoUrl, role: m.role }))}
              currentUserId={currentUserId}
            />

            <div className="mt-6">
              {activeSeason ? (
                <>
                  <div className="rounded-2xl bg-[linear-gradient(to_right,#49b6a4,#84d27f,#b6df64)] p-4 text-slate-900">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="text-2xl font-bold">{activeSeason.name}</div>
                      <div className="text-lg font-semibold text-slate-900/70">
                        {formatDate(activeSeason.startDate)} - {formatDate(activeSeason.endDate)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <UserActiveStats
                      activities={myActivities}
                      weeklyRequired={activeSeason.weeklyGoal}
                      timezone={timezone}
                    />
                  </div>

                  {meLoading ? (
                    <div className="mt-3 text-sm text-slate-400">Cargando usuario…</div>
                  ) : meError ? (
                    <div className="mt-3 text-sm text-red-400">
                      Error cargando usuario: {meError}
                    </div>
                  ) : !me ? (
                    <div className="mt-3 text-sm text-slate-400">
                      No hay usuario logueado.
                    </div>
                  ) : (
                    <div className="mt-3">
                      <GroupUserCalendar
                        seasonStart={activeSeason.startDate}
                        seasonEnd={activeSeason.endDate}
                        weeklyRequired={activeSeason.weeklyGoal}
                        workouts={activities.filter((activity) => activity.user.id === me.id)}
                      />
                    </div>
                  )}

                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
                    <section className="rounded-2xl bg-slate-900/70 p-4">
                      <div className="mb-4 text-lg font-semibold text-white">
                        Actividades recientes
                      </div>

                      <div className="scrollbar-elbravo max-h-[620px] space-y-3 overflow-y-auto pr-1">
                        {activities.length === 0 ? (
                          <div className="rounded-xl bg-slate-800 px-4 py-4 text-sm text-slate-400">
                            No hay actividades en la temporada activa.
                          </div>
                        ) : (
                          activities.map((activity) => (
                            <article
                              key={activity.id}
                              className="rounded-2xl border border-slate-700 bg-slate-800/80 p-3"
                            >
                              <div className="flex items-start gap-3">
                                <div className="h-20 w-20 overflow-hidden rounded-xl bg-slate-700">
                                  {activity.mediaUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={activity.mediaUrl}
                                      alt={activity.user?.name ?? "Actividad"}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-300">
                                      SIN FOTO
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <div className="font-semibold text-white">
                                        {activity.user?.name ?? activity.user?.email ?? "Usuario"}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-400">
                                        {formatInstant(new Date(activity.startedAt), timezone)} ·{" "}
                                        {getActivityTypeLabel(activity.type)}
                                      </div>
                                    </div>

                                    <div className="text-right text-xs text-slate-400">
                                      {activity.durationMinutes ?? 0} min
                                    </div>
                                  </div>

                                  <div className="mt-3 space-y-2">
                                    {activity.muscles && activity.muscles.length > 0 ? (
                                      activity.muscles.map((muscle: any) => (
                                        <div key={muscle.name}>
                                          <div className="mb-1 flex items-center justify-between text-xs">
                                            <span className="font-medium text-white">
                                              {muscle.name}
                                            </span>
                                            <span className="text-slate-300">
                                              {muscle.percentage}%
                                            </span>
                                          </div>

                                          <div className="h-2 overflow-hidden rounded-full bg-slate-600">
                                            <div
                                              className="h-full rounded-full bg-lime-500"
                                              style={{
                                                width: `${Math.min(muscle.percentage, 100)}%`,
                                              }}
                                            />
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className="text-xs text-slate-500">
                                        No hay distribución muscular calculable.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </article>
                          ))
                        )}
                      </div>
                    </section>

                    <div className="space-y-4">
                      {userSeasonStanding ? (
                        <section className="rounded-2xl bg-slate-900/70 p-4">
                          <div className="text-sm font-medium text-slate-300">
                            Tu posición actual
                          </div>

                          <div className="mt-2 flex items-end justify-between gap-3">
                            <div>
                              <div className="text-3xl font-bold text-white">
                                {userSeasonStanding.rank}°
                              </div>
                              <div className="text-sm text-slate-400">
                                de {userSeasonStanding.totalParticipants}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-2xl font-semibold text-lime-400">
                                {userSeasonStanding.totalPoints}
                              </div>
                              <div className="text-sm text-slate-400">puntos</div>
                            </div>
                          </div>

                          {userSeasonStanding.pointsToNextAbove !== null ? (
                            <div className="mt-3 text-sm text-lime-400">
                              A {userSeasonStanding.pointsToNextAbove} puntos del puesto superior
                            </div>
                          ) : (
                            <div className="mt-3 text-sm text-lime-400">
                              Vas primero en la tabla
                            </div>
                          )}
                        </section>
                      ) : null}

                      <section className="rounded-2xl bg-slate-900/70 p-5">
                        <div className="mb-4 text-lg font-semibold text-white">Miembros</div>

                        <div className="scrollbar-elbravo max-h-[620px] space-y-3 overflow-y-auto pr-1">
                          {membersWithStats.map((member) => (
                            <div
                              key={member.id}
                              className="rounded-2xl border border-slate-700 bg-slate-800/80 p-4"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="h-12 w-12 overflow-hidden rounded-xl bg-slate-700">
                                    {member.photoUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img
                                        src={member.photoUrl}
                                        alt={member.name ?? member.email ?? "Miembro"}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center font-bold text-white">
                                        {getInitial(member.name ?? member.email)}
                                      </div>
                                    )}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="truncate font-semibold text-white">
                                      {member.name ?? member.email}
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <span className="rounded-full bg-slate-700 px-2 py-1 text-xs text-slate-200">
                                        {member.currentWeekCount} esta semana
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {member.badges.length > 0
                                    ? member.badges.map((badge) => (
                                        <div
                                          key={badge.id}
                                          title={badge.name}
                                          className={`flex h-10 w-10 items-center justify-center rounded-full border text-[10px] font-bold ${getBadgeLevelClass(
                                            badge.level
                                          )}`}
                                        >
                                          {badge.name.slice(0, 2).toUpperCase()}
                                        </div>
                                      ))
                                    : null}

                                  <div
                                    title="Racha activa"
                                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-500 text-sm font-bold text-white"
                                  >
                                    {member.activeWeeks}
                                  </div>

                                  <div
                                    title="Racha perfecta"
                                    className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-600 text-sm font-bold text-white"
                                  >
                                    {member.perfectWeeks}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl bg-slate-900/70 p-5 text-sm text-slate-400">
                  No hay temporada activa.
                </div>
              )}
            </div>

            <div className="mt-8">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-bold text-white">Temporadas</h2>

                {isAdmin ? (
                  <a
                    href={`/group/${group.id}/create-season`}
                    className="rounded-lg bg-gradient-to-b from-lime-600 to-lime-800 px-4 py-2 text-sm font-semibold text-white shadow-md hover:from-lime-500 hover:to-lime-700"
                  >
                    + Nueva temporada
                  </a>
                ) : null}
              </div>

              <div className="grid gap-4">
                {seasons.map((season) => (
                  <article
                    key={season.id}
                    className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/70"
                  >
                    <div className="bg-[linear-gradient(to_right,#4EBEA3,#86D18A,#B7E272)] px-5 py-4 text-slate-900">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-2xl font-bold">{season.name}</div>
                          <div className="mt-1 text-sm font-medium text-slate-900/70">
                            {formatDate(season.startDate)} - {formatDate(season.endDate)}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {season.isActive ? (
                            <span className="rounded-full bg-slate-900/15 px-3 py-1 text-sm font-semibold">
                              Activa
                            </span>
                          ) : season.isUpcoming ? (
                            <span className="rounded-full bg-slate-900/15 px-3 py-1 text-sm font-semibold">
                              Próxima
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-900/15 px-3 py-1 text-sm font-semibold">
                              Finalizada
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-5">
                      {season.description ? (
                        <p className="mb-4 text-sm text-slate-300">{season.description}</p>
                      ) : null}

                      <div className="mb-4 flex flex-wrap gap-2 text-sm">
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-200">
                          Objetivo semanal: {season.weeklyGoal}
                        </span>

                        {season.allowedActivityTypes.map((type) => (
                          <span
                            key={type}
                            className="rounded-full bg-slate-800 px-3 py-1 text-slate-200"
                          >
                            {getActivityTypeLabel(type)}
                          </span>
                        ))}
                      </div>

                      <div className="mb-5 flex flex-wrap gap-2">
                        {season.members.map((member) => (
                          <div
                            key={member.userId}
                            className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-2 text-sm text-slate-200"
                          >
                            <div className="h-6 w-6 overflow-hidden rounded-full bg-slate-700">
                              {member.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={member.photoUrl}
                                  alt={member.name ?? member.email ?? "Miembro"}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white">
                                  {getInitial(member.name ?? member.email)}
                                </div>
                              )}
                            </div>

                            <span>{member.name ?? member.email}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {!season.joined && !season.isPast ? (
                          <button
                            type="button"
                            onClick={() => joinSeason(season.id)}
                            disabled={loadingAction === `join-${season.id}`}
                            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-60"
                          >
                            {loadingAction === `join-${season.id}` ? "Uniéndote..." : "Unirme"}
                          </button>
                        ) : null}

                        {isAdmin ? (
                          <>
                            {season.isActive ? (
                              <button
                                type="button"
                                onClick={() => finalizeSeason(season.id)}
                                disabled={loadingAction === `finalize-${season.id}`}
                                className="rounded-lg bg-gradient-to-b from-lime-600 to-lime-800 px-4 py-2 text-sm font-medium text-white shadow-md hover:from-lime-500 hover:to-lime-700 disabled:opacity-60"
                              >
                                {loadingAction === `finalize-${season.id}`
                                  ? "Finalizando..."
                                  : "Finalizar"}
                              </button>
                            ) : null}

                            <a
                              href={`/group/${group.id}/season/${season.id}/edit`}
                              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
                            >
                              Editar
                            </a>

                            <button
                              type="button"
                              onClick={() => deleteSeason(season.id)}
                              disabled={loadingAction === `delete-${season.id}`}
                              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
                            >
                              {loadingAction === `delete-${season.id}`
                                ? "Eliminando..."
                                : "Borrar"}
                            </button>
                          </>
                        ) : null}
                      </div>

                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}