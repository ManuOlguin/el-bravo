"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Button, EmptyState, LinkButton, Sheet, Skeleton, cn, toast } from "@/src/components/ui";
import { listNotificationsAction, markAllReadAction, unreadCountAction } from "@/src/server/actions/notifications";
import type { NotificationView } from "@/src/server/notifications/queries";
import { badgeCount } from "./format";
import { NOTIFICATIONS_CHANGED, NotificationItem } from "./NotificationItem";

const POLL_MS = 60_000;

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

/**
 * Campana de la barra superior. El contador arranca con el valor del layout (server), se refresca
 * al navegar y con un poll de 60 s solo mientras la pestaña está visible. Abre un sheet con las últimas 10.
 */
export function NotificationBell({ initialCount, tz }: { initialCount: number; tz: string }) {
  const pathname = usePathname();
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationView[] | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [marking, startMarking] = useTransition();

  const refreshCount = useCallback(async () => {
    const r = await unreadCountAction();
    if (r.ok) setCount(r.data);
  }, []);

  // Al navegar (el layout raíz no se vuelve a renderizar en navegaciones del cliente).
  useEffect(() => {
    let cancelled = false;
    unreadCountAction().then((r) => {
      if (!cancelled && r.ok) setCount(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Poll liviano solo con la pestaña visible; al volver a la pestaña refresca enseguida.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer || document.visibilityState !== "visible") return;
      timer = setInterval(() => void refreshCount(), POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshCount();
        start();
      } else stop();
    };
    const onChanged = () => void refreshCount();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(NOTIFICATIONS_CHANGED, onChanged);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(NOTIFICATIONS_CHANGED, onChanged);
    };
  }, [refreshCount]);

  async function openSheet() {
    setOpen(true);
    setNow(new Date());
    const r = await listNotificationsAction(null, 10);
    if (r.ok) setItems(r.data.items);
    else {
      toast.error(r.error);
      setItems([]);
    }
  }

  function markAll() {
    startMarking(async () => {
      const r = await markAllReadAction();
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setItems((prev) => prev?.map((i) => ({ ...i, read: true })) ?? prev);
      setCount(0);
    });
  }

  const label = count > 0 ? `Notificaciones (${count} sin leer)` : "Notificaciones";

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        aria-label={label}
        title={label}
        className="relative grid h-10 w-10 place-items-center rounded-xl text-fg-muted transition-transform hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
      >
        <BellIcon />
        {count > 0 && (
          <span
            data-testid="notification-count"
            className={cn(
              "absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-extrabold leading-none text-on-primary"
            )}
          >
            {badgeCount(count)}
          </span>
        )}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Notificaciones">
        <div className="space-y-3">
          {items === null ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState title="No tenés notificaciones" description="Cuando tus amigos entrenen o te pasen en el ranking, te avisamos acá." />
          ) : (
            <ul className="space-y-1">
              {items.map((item) => (
                <NotificationItem
                  key={item.id}
                  item={item}
                  tz={tz}
                  now={now}
                  onNavigate={() => setOpen(false)}
                  onRead={(id) => {
                    setItems((prev) => prev?.map((i) => (i.id === id ? { ...i, read: true } : i)) ?? prev);
                    setCount((c) => Math.max(0, c - 1));
                  }}
                />
              ))}
            </ul>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" size="sm" className="flex-1" pending={marking} disabled={count === 0} onClick={markAll}>
              Marcar leídas
            </Button>
            <LinkButton href="/notifications" variant="ghost" size="sm" className="flex-1" onClick={() => setOpen(false)}>
              Ver todas
            </LinkButton>
          </div>
        </div>
      </Sheet>
    </>
  );
}
