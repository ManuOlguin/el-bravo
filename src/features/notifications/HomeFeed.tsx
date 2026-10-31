import "server-only";
import Link from "next/link";
import { EmptyState } from "@/src/components/ui";
import { listNotifications } from "@/src/server/notifications/queries";
import { groupByDay } from "./format";
import { NotificationItem } from "./NotificationItem";

/**
 * Sección "Novedades" para la home (la monta W2-4): las últimas 5 notificaciones agrupadas por día.
 * Server Component: `<HomeFeed userId={user.id} tz={user.timezone} />`.
 */
export async function HomeFeed({ userId, tz, limit = 5 }: { userId: string; tz: string; limit?: number }) {
  const { items } = await listNotifications(userId, { limit });
  const now = new Date();
  return (
    <section aria-labelledby="home-feed-title" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 id="home-feed-title" className="text-lg font-extrabold">
          Novedades
        </h2>
        {items.length > 0 && (
          <Link href="/notifications" className="rounded-lg px-2 py-1 text-sm font-semibold text-primary hover:bg-surface-2">
            Ver todas
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState title="Todavía no hay novedades" description="Acá vas a ver lo que pasa en tus grupos y con tus amigos." />
      ) : (
        <div className="space-y-3">
          {groupByDay(items, now, tz).map((g) => (
            <div key={g.day} className="space-y-1">
              <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-fg-subtle">{g.label}</h3>
              <ul className="space-y-1">
                {g.items.map((item) => (
                  <NotificationItem key={item.id} item={item} tz={tz} now={now} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
