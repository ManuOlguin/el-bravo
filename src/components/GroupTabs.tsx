"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function isEnded(season: any) {
  return new Date(season.endDate).getTime() < Date.now();
}

function isUpcoming(season: any) {
  return new Date(season.startDate).getTime() > Date.now();
}

function SeasonBadge({ season }: { season: any }) {
  if (isEnded(season)) {
    return (
      <span className="ml-2 inline-flex items-center rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-200">
        Finalizada
      </span>
    );
  }
  if (isUpcoming(season)) {
    return (
      <span className="ml-2 inline-flex items-center rounded-full bg-indigo-700 px-2 py-0.5 text-xs text-indigo-100">
        Próxima
      </span>
    );
  }
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-green-700 px-2 py-0.5 text-xs text-green-100">
      Activa
    </span>
  );
}


type Props = {
  activities: any[];
  members: any[];
  seasons: any[]; // TODAS las temporadas del grupo (activas, próximas y pasadas)
  groupId: string;
  isAdmin: boolean;
};

export default function GroupTabs({ activities, members, seasons, groupId, isAdmin }: Props) {
  const router = useRouter();

  const [tab, setTab] = useState<"activity" | "members" | "seasons">("activity");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [kickingUserId, setKickingUserId] = useState<string | null>(null);

  // --- who am I?
  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        const u = data?.user ?? data;
        if (mounted && u?.id) setCurrentUserId(u.id);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const now = useMemo(() => new Date(), []);
  const orderedSeasons = useMemo(() => {
    const arr = Array.isArray(seasons) ? [...seasons] : [];
    arr.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    return arr;
  }, [seasons]);

  async function kickMember(userId: string) {
    if (!isAdmin) return;
    if (!groupId) return;
    if (!confirm("¿Seguro que querés expulsar a este miembro del grupo?")) return;

    setKickingUserId(userId);
    try {
      // 👇 si tu endpoint tiene otro nombre, cambiá esta URL:
      const res = await fetch("/api/groups/kick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, userId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "No se pudo expulsar al miembro");
        return;
      }

      router.refresh();
    } catch {
      alert("Network error");
    } finally {
      setKickingUserId(null);
    }
  }

  return (
    <div className="mt-4">
      {/* Tabs */}
      <div className="flex gap-2 bg-gray-700 rounded-md p-1">
        <button
          onClick={() => setTab("activity")}
          className={`px-3 py-1 rounded-md ${tab === "activity" ? "bg-gray-800" : "bg-transparent"}`}
        >
          Actividad
        </button>

        <button
          onClick={() => setTab("members")}
          className={`px-3 py-1 rounded-md ${tab === "members" ? "bg-gray-800" : "bg-transparent"}`}
        >
          Miembros
        </button>

        <button
          onClick={() => setTab("seasons")}
          className={`px-3 py-1 rounded-md ${tab === "seasons" ? "bg-gray-800" : "bg-transparent"}`}
        >
          Temporadas
        </button>
      </div>

      {/* Content */}
      <div className="mt-4">
        {/* Actividad */}
        {tab === "activity" && (
          <div className="space-y-3">
            {activities?.length === 0 && <p className="text-sm text-gray-400">No hay actividad reciente.</p>}

            {activities?.map((a: any) => (
              <div key={a.id} className="p-3 bg-gray-800 rounded-md flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center">
                  {a.user?.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.user.photoUrl} alt={a.user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-300">{(a.user?.name || a.user?.email || "U").charAt(0)}</span>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{a.user?.name ?? a.user?.email}</div>
                    <div className="text-sm text-gray-400">{new Date(a.startedAt).toLocaleString()}</div>
                  </div>
                  <div className="text-sm text-gray-300">
                    {a.type} · {a.notes ?? ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Miembros */}
        {tab === "members" && (
          <div className="space-y-2">
            {members?.map((m: any) => {
              const isMe = currentUserId && m.id === currentUserId;

              return (
                <div key={m.id} className="p-3 bg-gray-800 rounded-md flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center">
                    {m.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.photoUrl} alt={m.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-300">{(m.name || m.email || "U").charAt(0)}</span>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{m.name ?? m.email}</div>

                      <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-400">
                          Golden: {m.goldenStreak} · Common: {m.commonStreak}
                        </div>

                        {/* ✅ BOTÓN EXPULSAR (solo admin y no a vos mismo) */}
                        {isAdmin && currentUserId && m.id !== currentUserId && (
                          <button
                            type="button"
                            title="Expulsar miembro"
                            onClick={async () => {
                              if (!confirm(`¿Expulsar a ${m.name ?? m.email} del grupo?`)) return;

                              try {
                                const res = await fetch("/api/groups/kick", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ groupId, userId: m.id }),
                                });

                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                  alert(data?.error || "No se pudo expulsar");
                                  return;
                                }

                                router.refresh();
                              } catch {
                                alert("Network error");
                              }
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-red-600 hover:bg-red-500"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Temporadas */}
        {tab === "seasons" && (
          <div className="space-y-3">
            {orderedSeasons.length === 0 && (
              <p className="text-sm text-gray-400">Todavía no hay temporadas creadas para este grupo.</p>
            )}

            {orderedSeasons.map((s: any) => {
              const start = new Date(s.startDate);
              const end = new Date(s.endDate);
              const isPast = end.getTime() < now.getTime();

              return (
                <div key={s.id} className="p-3 bg-gray-800 rounded-md">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium flex items-center">
                        {s.name}
                        <SeasonBadge season={s} />
                      </div>
                      <div className="text-sm text-gray-400">
                        {start.toLocaleDateString()} → {end.toLocaleDateString()}
                      </div>
                      <div className="text-sm text-gray-400">Miembros inscritos: {s.members?.length ?? 0}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* ✏️ editar (solo si NO terminó) */}
                      {!isPast && isAdmin ? (
                        <a
                          href={`/group/${groupId}/season/${s.id}/edit`}
                          className="inline-flex items-center px-2 py-1 bg-gray-700 rounded text-sm hover:bg-gray-600"
                          title="Editar temporada"
                        >
                          ✏️
                        </a>
                      ) : null}

                      {/* 🗑️ borrar (solo admin, opcional si ya lo tenés) */}
                      {isAdmin ? (
                        <button
                          type="button"
                          className="inline-flex items-center px-2 py-1 bg-gray-700 rounded text-sm hover:bg-gray-600"
                          title="Borrar temporada"
                          onClick={async () => {
                            if (!confirm("¿Seguro que querés borrar esta temporada?")) return;

                            const res = await fetch("/api/seasons/delete", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ seasonId: s.id }),
                            });

                            const data = await res.json().catch(() => ({}));
                            if (!res.ok) {
                              alert(data?.error || "No se pudo borrar la temporada");
                              return;
                            }
                            router.refresh();
                          }}
                        >
                          🗑️
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
