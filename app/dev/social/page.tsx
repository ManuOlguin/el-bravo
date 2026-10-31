import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, PageHeader } from "@/src/components/ui";
import { prisma } from "@/src/lib/db";
import { requirePageUser } from "@/src/server/auth/dal";
import { getFriendsFeed } from "@/src/server/social/feed";
import { FriendsFeedList } from "@/src/features/social/FriendsFeedList";
import { InviteFriendsButton } from "@/src/features/social/InviteFriendsButton";

export const metadata: Metadata = { title: "Social (dev)" };

// Vista previa con datos reales de las piezas sociales de W1-4 (feed de amigos e invitar amigos)
// hasta que W2-4 (home) y W2-2 (grupo) las integren. Solo existe en desarrollo.
export default async function DevSocialPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const viewer = await requirePageUser();
  const [feed, adminGroups] = await Promise.all([
    getFriendsFeed(viewer.id, { limit: 5 }),
    prisma.group.findMany({
      where: { members: { some: { userId: viewer.id, role: "admin", leftAt: null, status: "accepted" } } },
      select: { id: true, name: true, members: { where: { leftAt: null, status: "accepted" }, select: { userId: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-screen-sm space-y-6">
      <PageHeader title="Social (dev)" subtitle="Feed de amigos e invitaciones con datos reales" back="/dev/ui" />

      {adminGroups.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-fg-subtle">Invitar amigos</h2>
          <ul className="space-y-2">
            {adminGroups.map((g) => (
              <li key={g.id}>
                <Card className="flex items-center justify-between gap-3 p-3">
                  <span className="min-w-0 truncate font-semibold">{g.name}</span>
                  <InviteFriendsButton groupId={g.id} memberIds={g.members.map((m) => m.userId)} label="Invitar" />
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-fg-subtle">Feed de amigos</h2>
        <FriendsFeedList
          initialItems={feed.items}
          initialCursor={feed.nextCursor}
          viewer={{ id: viewer.id, name: viewer.name }}
          viewerTz={viewer.timezone}
        />
      </section>
    </div>
  );
}
