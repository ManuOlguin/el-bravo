// app/group/[id]/GroupPageClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "@/src/components/Navbar";
import UserActiveStats from "@/src/components/UserActiveStats";
import GroupUserCalendar from "@/src/components/GroupUserCalendar";
import InviteGroupButton from "@/src/components/InviteGroupButton";
import GroupInviteCodePanel from "@/src/components/GroupInviteCodePanel";
import GroupTabs from "@/src/components/GroupTabs";
import GroupSettingsPopup from "@/src/components/GroupSettingsPopup";
import GroupSeasonActivities from "@/src/components/GroupSeasonActivities";
import GroupSeasonMembers from "@/src/components/GroupSeasonMembers";
import GroupSeasonRank from "@/src/components/GroupSeasonRank";

type GroupPageClientProps = {
  group: any;
  isAdmin: boolean;
  activities: any[];
  membersWithStats: any[];
  activeSeason: any | null;
  upcomingSeason: any | null;
  pastSeasons: any[];
};

type MeResponse = {
  user: {
    id: string;
    name?: string | null;
    image?: string | null;
  } | null;
};

export default function GroupPageClient({
  group,
  isAdmin,
  activities,
  membersWithStats,
  activeSeason,
  upcomingSeason,
}: GroupPageClientProps) {
  console.log("GroupPageClient render", { group, isAdmin, activities, membersWithStats, activeSeason, upcomingSeason }); // 👈 DEBUG
  const [invitePopupOpen, setInvitePopupOpen] = useState(false);
  const [settingsPopupOpen, setSettingsPopupOpen] = useState(false);

  const [me, setMe] = useState<MeResponse["user"]>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadMe() {
      try {
        setMeLoading(true);
        setMeError(null);

        const res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });

        if (!res.ok) {
          throw new Error(`GET /api/auth/me failed (${res.status})`);
        }

        const data = (await res.json()) as MeResponse;

        console.log("Fetched /api/auth/me:", data);

        if (!alive) return;
        setMe(data.user ?? null);
      } catch (err) {
        if (!alive) return;
        setMe(null);
        setMeError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!alive) return;
        setMeLoading(false);
      }
    }

    loadMe();
    return () => {
      alive = false;
    };
  }, []);

// 🔹 Actividades SOLO del usuario actual
  const myActivities = useMemo(
    () =>
      me
        ? activities.filter((a) => (a as any).user?.id === me.id)
        : [],
    [activities, me]
  );
  return (
    <>
      <header>
        <Navbar
          userName={me?.name ?? "—"}
          photoUrl={me?.image ?? "https://i.pravatar.cc/100"}
        />
      </header>

      <main className="min-h-screen bg-black-900 p-6 text-white">
        <div className="mx-auto max-w-7xl space-y-4">
          <div className="flex items-center justify-between gap-2">
            <a
              href="/dashboard"
              className="inline-flex items-center px-4 py-1 bg-surface rounded-md text-sm hover:bg-surfacehover"
            >
              Volver
            </a>
          </div>

          <div className="rounded-lg">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <div className="w-20 h-20 rounded-lg bg-gray-700 overflow-hidden">
                {group.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={group.photoUrl}
                    alt={group.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">
                    {group.name.charAt(0)}
                  </div>
                )}
              </div>

              <div className="flex-1 ml-2">
                <h1 className="text-3xl font-semibold">{group.name}</h1>

                {"description" in group && (group as any).description && (
                  <p className="text-sm text-gray-300 mt-2">
                    {(group as any).description}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-3">
                  <img
                    src="https://i.pravatar.cc/100"
                    className="h-6 w-6 rounded-full"
                    alt="Group Members"
                  />
                  <img
                    src="https://i.pravatar.cc/101"
                    className="h-6 w-6 rounded-full"
                    alt="Group Members"
                  />
                  <img
                    src="https://i.pravatar.cc/102"
                    className="h-6 w-6 rounded-full"
                    alt="Group Members"
                  />
                  <img
                    src="https://i.pravatar.cc/103"
                    className="h-6 w-6 rounded-full"
                    alt="Group Members"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <InviteGroupButton setPopupInviteOpen={setInvitePopupOpen} />
                  )}

                  <button
                    type="button"
                    onClick={() => setSettingsPopupOpen(true)}
                    className="inline-flex items-center px-2 py-1 bg-surface rounded-md text-sm hover:bg-surfacehover"
                    aria-label="Configuración del grupo"
                  >
                    <span className="text-lg">⚙️</span>
                  </button>
                </div>
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
            />

            <div className="mt-4">
              {activeSeason ? (
                <>
                  <div className="bg-[linear-gradient(to_right,#4EBEA3,#86D18A,#B7E272)] p-4 rounded-xl border border-gray-700 flex justify-between items-center">
                    <div className="text-2xl font-semibold">{activeSeason.name}</div>
                    <div className="text-2xl font-semibold text-black/28">
                      {new Date(activeSeason.startDate).toLocaleDateString()} -{" "}
                      {new Date(activeSeason.endDate).toLocaleDateString()}
                    </div>
                  </div>

                  <UserActiveStats activities={myActivities}
                  weeklyRequired={activeSeason.minPerWeek} />

                  {/* Optional: tiny state handling so it doesn’t crash / feel weird */}
                  {meLoading ? (
                    <div className="text-sm text-gray-400 mt-2">Cargando usuario…</div>
                  ) : meError ? (
                    <div className="text-sm text-red-400 mt-2">
                      Error cargando usuario: {meError}
                    </div>
                  ) : !me ? (
                    <div className="text-sm text-gray-400 mt-2">
                      No hay usuario logueado.
                    </div>
                  ) : (
                    <GroupUserCalendar
                      seasonStart={activeSeason.startDate}
                      seasonEnd={activeSeason.endDate}
                      weeklyRequired={activeSeason.minPerWeek}
                      workouts={activities.filter((a) => a.user.id === me.id) ?? []}
                    />
                  )}

                  <div className="flex gap-2 mt-2">
                    <GroupSeasonActivities activities={activities} />
                    <GroupSeasonMembers members={membersWithStats} weeklyRequired={activeSeason.minPerWeek} />
                  </div>

                  <GroupSeasonRank />
                </>
              ) : (
                <div className="text-sm text-gray-400">No hay temporada activa.</div>
              )}

              {upcomingSeason && (
                <div className="mt-3 text-sm text-gray-300">
                  Próxima: <span className="font-medium">{upcomingSeason.name}</span>{" "}
                  (arranca {new Date(upcomingSeason.startDate).toLocaleDateString()})
                </div>
              )}
            </div>

            <div className="mt-6">
              <GroupTabs
                activities={activities}
                members={membersWithStats}
                seasons={group.seasons}
                groupId={group.id}
                isAdmin={isAdmin}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
