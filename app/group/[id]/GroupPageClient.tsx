// app/group/[id]/GroupPageClient.tsx
"use client";

import { useState } from "react";
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

export default function GroupPageClient({
  group,
  isAdmin,
  activities,
  membersWithStats,
  activeSeason,
  upcomingSeason,
}: GroupPageClientProps) {
  const [invitePopupOpen, setInvitePopupOpen] = useState(false);
  const [settingsPopupOpen, setSettingsPopupOpen] = useState(false); // 👈 nuevo

  return (
    <>
      <header>
        <Navbar userName="Manu" photoUrl="https://i.pravatar.cc/100" />
      </header>
      <main className="min-h-screen bg-black-900 p-6 text-white">
        <div className="mx-auto max-w-7xl space-y-4">
          {/* Top bar */}
          <div className="flex items-center justify-between gap-2">
            <a
              href="/dashboard"
              className="inline-flex items-center px-4 py-1 bg-surface rounded-md text-sm hover:bg-surfacehover"
            >
              Volver
            </a>
          </div>

          <div className=" rounded-lg m">
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

                {/* Ojo: group.description hoy NO existe en schema; si te rompe, borrá esta línea */}
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
                    <InviteGroupButton
                      setPopupInviteOpen={setInvitePopupOpen}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => setSettingsPopupOpen(true)}
                    className="inline-flex items-center px-2 py-1 bg-surface rounded-md text-sm hover:bg-surfacehover"
                    aria-label="Configuración del grupo"
                  >
                    {/* Podés reemplazar esto por un ícono SVG si querés algo más prolijo */}
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
                    <div className="text-2xl font-semibold">
                      {activeSeason.name}
                    </div>
                    <div className="text-2xl font-semibold text-black/28">
                      {new Date(activeSeason.startDate).toLocaleDateString()} -{" "}
                      {new Date(activeSeason.endDate).toLocaleDateString()}
                    </div>
                  </div>
                  <UserActiveStats />
                  <GroupUserCalendar />
                  <div className="flex gap-2 mt-2">
                    <GroupSeasonActivities activities={activities} />
                    <GroupSeasonMembers members={membersWithStats} />
                  </div>
                  <GroupSeasonRank />
                </>
              ) : (
                <div className="text-sm text-gray-400">
                  No hay temporada activa.
                </div>
              )}

              {upcomingSeason && (
                <div className="mt-3 text-sm text-gray-300">
                  Próxima:{" "}
                  <span className="font-medium">{upcomingSeason.name}</span>{" "}
                  (arranca{" "}
                  {new Date(upcomingSeason.startDate).toLocaleDateString()})
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
