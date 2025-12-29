"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function GroupTabs({ activities, members, activeSeason, pastSeasons }: any) {
  const [tab, setTab] = useState("activity");
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeMembers, setActiveMembers] = useState<any[]>(activeSeason?.members ?? []);
  const [leaving, setLeaving] = useState(false);
  const router = useRouter();
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        const u = data?.user ?? data;
        if (mounted && u?.id) { setCurrentUser(u); setCurrentUserId(u.id); }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setActiveMembers(activeSeason?.members ?? []);
  }, [activeSeason]);

  return (
    <div className="mt-4">
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
      </div>

      <div className="mt-4">
        {tab === "activity" && (
          <div className="space-y-3">
            {activities.length === 0 && <p className="text-sm text-gray-400">No hay actividad reciente.</p>}
            {activities.map((a: any) => (
              <div key={a.id} className="p-3 bg-gray-800 rounded-md flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center">
                  {a.user.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.user.photoUrl} alt={a.user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-300">{(a.user.name || a.user.email || "U").charAt(0)}</span>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{a.user.name ?? a.user.email}</div>
                    <div className="text-sm text-gray-400">{new Date(a.startedAt).toLocaleString()}</div>
                  </div>
                  <div className="text-sm text-gray-300">{a.type} · {a.notes ?? ""}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "members" && (
          <div className="space-y-2">
            {members.map((m: any) => (
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
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{m.name ?? m.email}</div>
                    <div className="text-sm text-gray-400">Golden: {m.goldenStreak} · Common: {m.commonStreak}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeSeason && (
        <div className="mt-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">{activeSeason.name}</h3>
                {activeSeason.description && <p className="text-sm text-gray-300 mt-2">{activeSeason.description}</p>}
                <p className="text-sm text-gray-400 mt-3">Período: {new Date(activeSeason.createdAt).toLocaleDateString()} → {new Date(activeSeason.startDate).toLocaleDateString()}</p>
                <p className="text-sm text-gray-400">Miembros inscritos: {activeSeason.members?.length ?? 0}</p>
              </div>

              <div className="flex items-center gap-3">
                {(() => {
                  const isMember = !!activeMembers?.some((m: any) => m.user?.id === currentUserId);
                  if (isMember) return <div className="text-sm text-gray-300">Estás inscrito</div>;
                  return (
                    <div>
                      <button
                        disabled={joining}
                        onClick={async () => {
                          if (!confirm('¿Unirte a la inscripción?')) return;
                          setJoining(true);
                          try {
                            const res = await fetch('/api/seasons/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seasonId: activeSeason.id }) });
                            const data = await res.json().catch(() => ({}));
                            if (!res.ok) {
                              alert(data?.error || 'Error al unirse');
                            } else {
                              if (currentUser) {
                                setActiveMembers((prev) => [...prev, { id: `local-${currentUser.id}`, user: currentUser }]);
                              }
                              router.refresh();
                            }
                          } catch (e) {
                            alert('Network error');
                          } finally { setJoining(false); }
                        }}
                        className="px-3 py-1 bg-green-600 rounded text-sm"
                      >{joining ? 'Uniendo...' : 'Unirse'}</button>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="mt-4 border-t border-gray-700 pt-4 space-y-2">
              {activeMembers && activeMembers.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between bg-gray-900 p-2 rounded">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center">
                      {m.user?.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.user.photoUrl} alt={m.user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-gray-300">{(m.user?.name || m.user?.email || "U").charAt(0)}</span>
                      )}
                    </div>
                    <div className="text-sm">{m.user?.name ?? m.user?.email}</div>
                  </div>

                  {currentUserId === m.user?.id ? (
                    <div>
                      <button
                        disabled={leaving}
                        onClick={async () => {
                          if (!confirm('¿Abandonar inscripción?')) return;
                          setLeaving(true);
                          try {
                            const res = await fetch('/api/seasons/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seasonId: activeSeason.id }) });
                            if (!res.ok) {
                              const data = await res.json().catch(() => ({}));
                              alert(data?.error || 'Error al abandonar');
                            } else {
                              setActiveMembers((prev) => prev.filter((x) => x.user?.id !== currentUserId));
                              router.refresh();
                            }
                          } catch (e) {
                            alert('Network error');
                          } finally { setLeaving(false); }
                        }}
                        className="px-3 py-1 bg-red-600 rounded text-sm"
                      >{leaving ? 'Saliendo...' : 'Salir'}</button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {pastSeasons && pastSeasons.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Temporadas anteriores</h3>
          <div className="space-y-3">
            {pastSeasons.map((s: any) => (
              <div key={s.id} className="p-3 bg-gray-800 rounded-md">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-sm text-gray-400">{new Date(s.startDate).toLocaleDateString()} → {new Date(s.endDate).toLocaleDateString()}</div>
                  </div>
                  <div className="text-sm text-gray-300">Miembros: {s.members?.length ?? 0}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
