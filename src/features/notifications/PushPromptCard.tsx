"use client";

import { useState, useSyncExternalStore } from "react";
import { Button, Card } from "@/src/components/ui";
import { usePushSubscription } from "./EnablePushCard";

const DISMISS_KEY = "elbravo:push-prompt-dismissed-at";
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000; // vuelve a ofrecerse a las 2 semanas

function dismissedRecently() {
  try {
    const at = Number(window.localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}
const subscribeNothing = () => () => undefined;

/**
 * Home: invita a activar las notificaciones push con un toque (el navegador solo deja pedir el permiso
 * después de un toque). Solo aparece si se pueden activar y todavía no están; "Ahora no" la esconde 2 semanas.
 * En iPhone sin instalar explica que primero hay que agregarla a inicio.
 */
export function PushPromptCard({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const { state, pending, enable } = usePushSubscription(vapidPublicKey);
  const dismissed = useSyncExternalStore(subscribeNothing, dismissedRecently, () => true);
  const [hidden, setHidden] = useState(false);
  if (dismissed || hidden || (state !== "off" && state !== "ios-install")) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // sin storage: vuelve a aparecer en la próxima visita
    }
    setHidden(true);
  };

  return (
    <Card className="flex items-start gap-3 border-primary/40">
      <span aria-hidden="true" className="text-2xl">
        🔔
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="font-bold">¿Te avisamos?</p>
          {state === "off" ? (
            <p className="text-sm text-fg-muted">Cuando te pasan en el ranking, tus amigos entrenan o reaccionan a lo tuyo. Elegís qué avisos en Ajustes.</p>
          ) : (
            <p className="text-sm text-fg-muted">
              En iPhone, primero instalá la app: <strong className="text-fg">Compartir → Agregar a inicio</strong>, abrila desde el ícono y activalas desde acá.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {state === "off" && (
            <Button size="sm" pending={pending} onClick={enable}>
              Activar notificaciones
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Ahora no
          </Button>
        </div>
      </div>
    </Card>
  );
}
