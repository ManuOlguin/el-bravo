"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, toast } from "@/src/components/ui";
import { registerWebPushAction, unregisterWebPushAction } from "@/src/server/actions/devices";

type Support = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

async function swRegistration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
}

function deviceLabel() {
  const ua = navigator.userAgent;
  const browser = /edg\//i.test(ua) ? "Edge" : /chrome|crios/i.test(ua) ? "Chrome" : /firefox|fxios/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : "Navegador";
  const os = /android/i.test(ua) ? "Android" : isIos() ? "iPhone" : /mac os/i.test(ua) ? "Mac" : /windows/i.test(ua) ? "Windows" : /linux/i.test(ua) ? "Linux" : "";
  return [browser, os && `en ${os}`].filter(Boolean).join(" ");
}

/**
 * Activa Web Push en este dispositivo. Pide permiso SOLO después de que el usuario toca el botón.
 * En iPhone el push funciona solo con la app instalada (Compartir → Agregar a inicio, iOS 16.4+).
 */
export function EnablePushCard({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<Support>("checking");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: Support;
      if (!vapidPublicKey || !("serviceWorker" in navigator)) next = "unsupported";
      else if (!("PushManager" in window) || !("Notification" in window)) next = isIos() && !isStandalone() ? "ios-install" : "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        next = sub && Notification.permission === "granted" ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })().catch(() => {
      if (!cancelled) setState("unsupported");
    });
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  function enable() {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          toast.error("Sin permiso no podemos mandarte notificaciones.");
          return;
        }
        const reg = await swRegistration();
        await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!) }));
        const r = await registerWebPushAction(sub.toJSON(), deviceLabel());
        if (!r.ok) {
          toast.error(r.error);
          return;
        }
        setState("on");
        toast.success(r.message ?? "Notificaciones activadas");
        router.refresh();
      } catch (e) {
        console.error("[push] no se pudo activar", e);
        toast.error("No pudimos activar las notificaciones en este dispositivo.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) {
          await unregisterWebPushAction(sub.endpoint);
          await sub.unsubscribe();
        }
        setState("off");
        toast.success("Desactivaste las notificaciones en este dispositivo");
        router.refresh();
      } catch (e) {
        console.error("[push] no se pudo desactivar", e);
        toast.error("No pudimos desactivar las notificaciones.");
      }
    });
  }

  return (
    <Card className="space-y-3">
      <div>
        <p className="font-semibold">Notificaciones en este dispositivo</p>
        {state === "checking" && <p className="text-sm text-fg-muted">Revisando…</p>}
        {state === "on" && <p className="text-sm text-fg-muted">Activadas. Te avisamos al instante aunque no tengas la app abierta.</p>}
        {state === "off" && <p className="text-sm text-fg-muted">Activalas para enterarte al instante cuando tus amigos entrenan o reaccionan.</p>}
        {state === "denied" && (
          <p className="text-sm text-fg-muted">
            Bloqueaste las notificaciones para El Bravo. Habilitalas desde los ajustes del navegador y volvé a esta pantalla.
          </p>
        )}
        {state === "ios-install" && (
          <p className="text-sm text-fg-muted">
            En iPhone primero tenés que instalar la app: tocá <strong className="text-fg">Compartir</strong> → <strong className="text-fg">Agregar a inicio</strong>, abrila
            desde el ícono y volvé acá (iOS 16.4 o posterior).
          </p>
        )}
        {state === "unsupported" && <p className="text-sm text-fg-muted">Este navegador no soporta notificaciones push.</p>}
      </div>
      {state === "off" && (
        <Button fullWidth pending={pending} onClick={enable}>
          Activar notificaciones
        </Button>
      )}
      {state === "on" && (
        <Button variant="secondary" fullWidth pending={pending} onClick={disable}>
          Desactivar en este dispositivo
        </Button>
      )}
    </Card>
  );
}
