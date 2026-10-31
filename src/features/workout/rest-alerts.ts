"use client";
/**
 * Avisos del fin del descanso (modo en vivo), pensados para el gym con el celular en el bolsillo:
 * - Sonido: se programa en el reloj del motor de audio al EMPEZAR el descanso, así suena a tiempo aunque
 *   el navegador frene los timers de JS (pestaña en segundo plano). En iPhone respeta el modo silencio.
 * - Notificación del sistema: si la app no está en pantalla (celular bloqueado, otra app) y hay permiso.
 *   En Android funciona con la pantalla bloqueada; en iPhone Safari congela la página al bloquear, así
 *   que ahí solo avisa con la app abierta.
 * Todo con try/catch: sin soporte, el descanso funciona igual (la barra y la vibración en pantalla).
 */
import type { RestTimerState } from "./RestTimer";

const SOUND_KEY = "elbravo:rest-sound";
const NOTIFY_ASKED_KEY = "elbravo:rest-notify-asked";
const STORE_PREFIX = "rest-timer:";
/** Un descanso que terminó hace más de esto no se restaura al recargar (ya no sirve avisar). */
const RESTORE_GRACE_MS = 30_000;

/* ───────── descanso guardado (sobrevive a recargas y a que el celular cierre la pestaña) ───────── */

export const restTimerKey = (draftKey: string) => `${STORE_PREFIX}${draftKey}`;

export function readRestTimer(key: string, nowMs: number): RestTimerState | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const t = JSON.parse(raw) as RestTimerState;
    if (typeof t?.id !== "number" || typeof t.startMs !== "number" || typeof t.totalS !== "number") return null;
    return t.startMs + t.totalS * 1000 + RESTORE_GRACE_MS < nowMs ? null : t;
  } catch {
    return null;
  }
}

export function writeRestTimer(key: string, timer: RestTimerState | null) {
  try {
    if (timer) window.localStorage.setItem(key, JSON.stringify(timer));
    else window.localStorage.removeItem(key);
  } catch {
    // sin storage: el descanso no sobrevive a una recarga
  }
}

/* ───────── sonido ───────── */

export function isRestSoundOn(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setRestSound(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // ídem
  }
}

let audio: AudioContext | null = null;

/** Crea o despierta el contexto de audio. Hay que llamarlo dentro de un toque (los navegadores lo exigen). */
export function primeRestAudio() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    audio = null;
  }
}

/** Tres pitidos dentro de `delayS` segundos. Devuelve cómo cancelarlos (saltar, ±15 s, destildar). */
export function scheduleRestBeeps(delayS: number): () => void {
  const ctx = audio;
  if (!ctx || !isRestSoundOn()) return () => undefined;
  try {
    const t0 = ctx.currentTime + Math.max(0, delayS);
    const oscillators = [0, 0.22, 0.44].map((dt, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = i === 2 ? 1320 : 880;
      gain.gain.setValueAtTime(0.0001, t0 + dt);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + dt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.17);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + dt);
      osc.stop(t0 + dt + 0.2);
      return osc;
    });
    return () =>
      oscillators.forEach((o) => {
        try {
          o.stop();
        } catch {
          // ya terminó
        }
      });
  } catch {
    return () => undefined;
  }
}

/* ───────── notificación del sistema ───────── */

export function canAskRestNotifications(): boolean {
  try {
    if (!("Notification" in window) || Notification.permission !== "default") return false;
    return window.localStorage.getItem(NOTIFY_ASKED_KEY) === null;
  } catch {
    return false;
  }
}

/** Pide permiso (una sola vez: si dice que no, no se vuelve a ofrecer). */
export async function askRestNotifications(): Promise<boolean> {
  try {
    window.localStorage.setItem(NOTIFY_ASKED_KEY, "1");
  } catch {
    // ídem
  }
  try {
    return (await Notification.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

export function dismissRestNotifications() {
  try {
    window.localStorage.setItem(NOTIFY_ASKED_KEY, "1");
  } catch {
    // ídem
  }
}

/** Solo si la app no está a la vista: con la app abierta ya avisan la barra, el sonido y la vibración. */
export async function notifyRestEnd(href: string) {
  try {
    if (document.visibilityState !== "hidden" || !("Notification" in window) || Notification.permission !== "granted") return;
    const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
      body: "Terminó el descanso. Tocá para volver.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: "rest-timer",
      renotify: true,
      vibrate: [200, 100, 200],
      data: { href },
    };
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification("¡A la próxima serie!", options);
    else new Notification("¡A la próxima serie!", options);
  } catch {
    // sin permiso / sin soporte
  }
}
