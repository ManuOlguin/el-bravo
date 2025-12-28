"use client";

import React, { useState } from "react";

export default function GroupTabs({ activities, members, activeSeason, pastSeasons }: any) {
  const [tab, setTab] = useState("activity");

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
        <div className="mt-6 bg-gray-800 rounded-md p-4">
          <h3 className="text-lg font-semibold">Inscripción</h3>
          <p className="text-sm text-gray-300 mt-1">Período: {new Date(activeSeason.createdAt).toLocaleDateString()} → {new Date(activeSeason.startDate).toLocaleDateString()}</p>
          <p className="text-sm text-gray-300">Miembros inscritos: {activeSeason.members?.length ?? 0}</p>
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
