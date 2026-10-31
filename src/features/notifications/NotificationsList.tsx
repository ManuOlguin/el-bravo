"use client";

import { useState, useTransition } from "react";
import { Button, EmptyState, toast } from "@/src/components/ui";
import { listNotificationsAction, markAllReadAction } from "@/src/server/actions/notifications";
import type { NotificationView } from "@/src/server/notifications/queries";
import { groupByDay } from "./format";
import { NotificationItem, emitNotificationsChanged } from "./NotificationItem";

/** Lista paginada de `/notifications`, agrupada por día, con "Marcar todas como leídas" y "Cargar más". */
export function NotificationsList({
  initialItems,
  initialCursor,
  tz,
}: {
  initialItems: NotificationView[];
  initialCursor: string | null;
  tz: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [now] = useState(() => new Date());
  const [loading, startLoading] = useTransition();
  const [marking, startMarking] = useTransition();
  const unread = items.some((i) => !i.read);

  function loadMore() {
    startLoading(async () => {
      const r = await listNotificationsAction(cursor);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...r.data.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(r.data.nextCursor);
    });
  }

  function markAll() {
    startMarking(async () => {
      const r = await markAllReadAction();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Listo");
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
      emitNotificationsChanged();
    });
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<span className="text-xl">🔔</span>}
        title="No tenés notificaciones"
        description="Cuando tus amigos entrenen, reaccionen o te pasen en el ranking, te avisamos acá."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="secondary" size="sm" pending={marking} disabled={!unread} onClick={markAll}>
        Marcar todas como leídas
      </Button>
      {groupByDay(items, now, tz).map((g) => (
        <section key={g.day} aria-label={g.label} className="space-y-1">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-fg-subtle">{g.label}</h2>
          <ul className="space-y-1">
            {g.items.map((item) => (
              <NotificationItem
                key={item.id}
                item={item}
                tz={tz}
                now={now}
                onRead={(id) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)))}
              />
            ))}
          </ul>
        </section>
      ))}
      {cursor && (
        <Button variant="ghost" fullWidth pending={loading} onClick={loadMore}>
          Cargar más
        </Button>
      )}
    </div>
  );
}
