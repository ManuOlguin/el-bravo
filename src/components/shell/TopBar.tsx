"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/src/components/ui/Avatar";
import { cn } from "@/src/components/ui/cn";
import { DEFAULT_TZ } from "@/src/lib/time";
import { NotificationBell } from "@/src/features/notifications/NotificationBell";
import { NAV_ITEMS, isNavItemActive } from "./nav-items";

/** `unreadNotifications`/`timezone` los carga el layout para la campana (W2-3). */
export type ShellUser = { id: string; name: string | null; photoUrl: string | null; unreadNotifications?: number; timezone?: string };

/**
 * Barra superior: logo a la izquierda; `rightSlot` (p. ej. la campana de W2-3) + avatar a la derecha.
 * Desde `sm:` muestra además los links de navegación habilitados.
 */
export function TopBar({ user, rightSlot }: { user: ShellUser | null; rightSlot?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 pt-safe backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-screen-md items-center gap-3 px-4">
        <Link
          href="/home"
          className="shrink-0 rounded-lg text-lg font-extrabold tracking-tight text-fg transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
        >
          El <span className="text-primary">Bravo</span>
        </Link>

        {user && (
          <nav aria-label="Navegación principal" className="hidden min-w-0 flex-1 items-center gap-1 sm:flex">
            {NAV_ITEMS.filter((i) => i.enabled).map((item) => {
              const active = isNavItemActive(item, pathname);
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold transition-[transform,background-color,color] duration-100 active:scale-95",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    item.primary
                      ? "bg-primary-gradient text-on-primary hover:brightness-110"
                      : active
                        ? "bg-surface-2 text-primary"
                        : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {user && (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {rightSlot ?? <NotificationBell initialCount={user.unreadNotifications ?? 0} tz={user.timezone ?? DEFAULT_TZ} />}
            <Avatar name={user.name} src={user.photoUrl} size="sm" href="/profile" />
          </div>
        )}
      </div>
    </header>
  );
}
