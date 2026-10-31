"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, cn, toastResult, useConfirm } from "@/src/components/ui";
import { logoutAction, logoutEverywhereAction } from "@/src/server/actions/account";

type Item = { href: string; label: string; description: string; enabled: boolean };

// Notificaciones: la habilita W2-3 cuando exista /settings/notifications.
const ITEMS: Item[] = [
  { href: "/settings/profile", label: "Perfil", description: "Nombre, foto, bio, objetivo y zona horaria", enabled: true },
  { href: "/settings/password", label: "Contraseña", description: "Cambiá tu contraseña", enabled: true },
  { href: "/settings/notifications", label: "Notificaciones", description: "Próximamente", enabled: false },
];

function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function SettingsMenu() {
  const router = useRouter();
  const confirm = useConfirm();
  const [loggingOut, startLogout] = useTransition();
  const [loggingOutAll, startLogoutAll] = useTransition();

  async function onLogout() {
    const ok = await confirm({ title: "¿Cerrar sesión?", confirmLabel: "Cerrar sesión" });
    if (!ok) return;
    startLogout(async () => {
      await logoutAction(); // borra la cookie y redirige a /login
    });
  }

  async function onLogoutEverywhere() {
    const ok = await confirm({
      title: "¿Cerrar sesión en todos lados?",
      description: "Vas a tener que volver a iniciar sesión en todos tus dispositivos, incluido este.",
      confirmLabel: "Cerrar en todos lados",
      danger: true,
    });
    if (!ok) return;
    startLogoutAll(async () => {
      const result = await logoutEverywhereAction();
      if (toastResult(result)) {
        router.replace("/login");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Ajustes" className="overflow-hidden rounded-card border border-border bg-surface-1">
        <ul className="divide-y divide-border">
          {ITEMS.map((item) => (
            <li key={item.href}>
              {item.enabled ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none active:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{item.label}</span>
                    <span className="block truncate text-sm text-fg-muted">{item.description}</span>
                  </span>
                  <span className="text-fg-subtle">
                    <Chevron />
                  </span>
                </Link>
              ) : (
                <div aria-disabled="true" className={cn("flex items-center gap-3 px-4 py-3.5 opacity-50")}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{item.label}</span>
                    <span className="block truncate text-sm text-fg-muted">{item.description}</span>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-3">
        <Button variant="secondary" size="lg" fullWidth pending={loggingOut} onClick={onLogout}>
          Cerrar sesión
        </Button>
        <Button variant="danger" size="lg" fullWidth pending={loggingOutAll} onClick={onLogoutEverywhere}>
          Cerrar sesión en todos lados
        </Button>
      </div>
    </div>
  );
}
