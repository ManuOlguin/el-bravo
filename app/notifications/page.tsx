import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/src/components/ui";
import { requirePageUser } from "@/src/server/auth/dal";
import { listNotifications } from "@/src/server/notifications/queries";
import { NotificationsList } from "@/src/features/notifications/NotificationsList";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificationsPage() {
  const user = await requirePageUser();
  const { items, nextCursor } = await listNotifications(user.id, { limit: 20 });
  return (
    <div className="mx-auto max-w-screen-sm">
      <PageHeader
        title="Notificaciones"
        back="/home"
        actions={
          <Link
            href="/settings/notifications"
            className="rounded-lg px-2 py-1 text-sm font-semibold text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            Ajustes
          </Link>
        }
      />
      <NotificationsList initialItems={items} initialCursor={nextCursor} tz={user.timezone} />
    </div>
  );
}
