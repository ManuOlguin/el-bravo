"use client";

import Link from "next/link";
import { Avatar, cn } from "@/src/components/ui";
import { markReadAction } from "@/src/server/actions/notifications";
import type { NotificationView } from "@/src/server/notifications/queries";
import { highlight, relativeTime } from "./format";

/** Evento global para que la campana refresque el contador cuando algo se marca como leído. */
export const NOTIFICATIONS_CHANGED = "elbravo:notifications-changed";
export function emitNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));
}

/**
 * Una notificación. Las no leídas llevan punto lima y fondo `surface-2`.
 * Al tocarla se marca como leída (en segundo plano) y navega a su `href`.
 */
export function NotificationItem({
  item,
  tz,
  now,
  onNavigate,
  onRead,
}: {
  item: NotificationView;
  tz: string;
  now: Date;
  onNavigate?: () => void;
  onRead?: (id: string) => void;
}) {
  function handleClick() {
    if (!item.read) {
      onRead?.(item.id);
      void markReadAction(item.id).then(() => emitNotificationsChanged());
    }
    onNavigate?.();
  }

  return (
    <li>
      <Link
        href={item.href}
        onClick={handleClick}
        className={cn(
          "flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:bg-surface-3",
          item.read ? "bg-transparent" : "bg-surface-2"
        )}
      >
        <span className="relative shrink-0">
          {item.actor ? (
            <Avatar name={item.actor.name} src={item.actor.photoUrl} size="md" />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-3 text-lg" aria-hidden="true">
              {item.icon}
            </span>
          )}
          {item.actor && (
            <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-surface-1 text-xs" aria-hidden="true">
              {item.icon}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm leading-snug text-fg">
            {highlight(item.title, item.emphasis).map((p, i) =>
              p.strong ? (
                <strong key={i} className="font-bold">
                  {p.text}
                </strong>
              ) : (
                <span key={i}>{p.text}</span>
              )
            )}
          </span>
          {item.body && <span className="mt-0.5 block truncate text-xs text-fg-muted">{item.body}</span>}
          <time dateTime={item.createdAt} className="mt-0.5 block text-xs text-fg-subtle" suppressHydrationWarning>
            {relativeTime(item.createdAt, now, tz)}
          </time>
        </span>
        {!item.read && (
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Sin leer" role="img" />
        )}
      </Link>
    </li>
  );
}
