import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card } from "@/src/components/ui";
import { localDateOf } from "@/src/lib/time";
import { AuthError, requirePageUser } from "@/src/server/auth/dal";
import { getGroupPageData } from "@/src/features/group/data";
import { GroupHeader } from "@/src/features/group/GroupHeader";
import { SeasonHero } from "@/src/features/group/SeasonHero";
import { MyWeekCard } from "@/src/features/group/MyWeekCard";
import { Leaderboard } from "@/src/features/group/Leaderboard";
import { ActivityFeed } from "@/src/features/group/ActivityFeed";
import { PastSeasons } from "@/src/features/group/PastSeasons";
import { MembersList } from "@/src/features/group/MembersList";
import { GroupActionsMenu } from "@/src/features/group/GroupActionsMenu";

export const metadata: Metadata = { title: "Grupo" };

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;

  let data;
  try {
    data = await getGroupPageData(id, user);
  } catch (e) {
    if (e instanceof AuthError) notFound();
    throw e;
  }

  const { group, current, upcoming, standings, viewer } = data;
  const isAdmin = viewer.role === "admin";
  const today = localDateOf(new Date(), group.timezone);
  const me = standings.find((s) => s.userId === viewer.id) ?? null;
  const showLeaderboard = !!current && (current.status === "active" || standings.length > 0);

  // Mobile: una columna en el orden del plan (los wrappers son `contents` y manda `order-*`).
  // Desde md: ranking + semana a la izquierda, feed a la derecha.
  return (
    <div className="flex flex-col gap-4">
      <GroupHeader group={group} isAdmin={isAdmin} />
      {group.description && <p className="-mt-2 text-sm text-fg-muted">{group.description}</p>}
      <SeasonHero groupId={group.id} current={current} upcoming={upcoming} me={me} today={today} isAdmin={isAdmin} />

      <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start">
        <div className="contents md:flex md:flex-col md:gap-4">
          {data.myWeek && (
            <div className="order-1">
              <MyWeekCard week={data.myWeek} today={today} />
            </div>
          )}
          {showLeaderboard && current && (
            <div className="order-2">
              <Leaderboard
                season={current}
                standings={standings}
                viewerId={viewer.id}
                title={current.status === "active" ? "Ranking" : "Ranking final (vista previa)"}
                limit={10}
                moreHref={`/group/${group.id}/season/${current.id}`}
              />
            </div>
          )}
          <div className="order-4">
            <PastSeasons groupId={group.id} seasons={data.past} />
          </div>
          <div className="order-5">
            <MembersList groupId={group.id} members={group.members} viewerId={viewer.id} isAdmin={isAdmin} />
          </div>
          <Card className="order-6">
            <GroupActionsMenu groupId={group.id} groupName={group.name} isAdmin={isAdmin} memberCount={group.members.length} />
          </Card>
        </div>
        <div className="order-3 md:order-none">
          <ActivityFeed groupId={group.id} initial={data.feed} viewer={{ id: user.id, name: user.name }} tz={user.timezone} />
        </div>
      </div>
    </div>
  );
}
