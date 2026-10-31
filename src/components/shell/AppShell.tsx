"use client";
import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { SHELL_HIDDEN_PATHS } from "./nav-items";
import { TopBar, type ShellUser } from "./TopBar";

/**
 * Shell de la app: barra superior + contenido + navegación inferior (mobile).
 * Sin usuario, o en las pantallas de auth, solo envuelve el contenido.
 */
export function AppShell({ user, children }: { user: ShellUser | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const hidden = SHELL_HIDDEN_PATHS.some((p) => pathname === p || pathname?.startsWith(`${p}/`));

  if (!user || hidden) return <main className="min-h-dvh">{children}</main>;

  return (
    <>
      <TopBar user={user} />
      <main className="mx-auto w-full max-w-screen-sm px-4 pb-28 pt-4 sm:max-w-screen-md sm:pb-10">{children}</main>
      <BottomNav />
    </>
  );
}
