"use client";
import { useEffect, useRef, useState } from "react";
import { Button, IconButton } from "@/src/components/ui/Button";

const DISMISS_KEY = "elbravo:install-dismissed-at";
const SHOWN_KEY = "elbravo:install-shown"; // sessionStorage: una vez por sesión del navegador
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const SHOW_DELAY_MS = 2500;

type BeforeInstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Mode = "android" | "ios" | null;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari() {
  const nav = navigator as Navigator & { standalone?: boolean };
  const ua = nav.userAgent;
  const iDevice = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && nav.maxTouchPoints > 1);
  // `standalone` solo existe en Safari de iOS; otros navegadores de iOS no pueden "Agregar a inicio".
  return iDevice && nav.standalone === false && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function wasShownThisSession() {
  try {
    return sessionStorage.getItem(SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberShown() {
  try {
    sessionStorage.setItem(SHOWN_KEY, "1");
  } catch {
    // Sin storage: no pasa nada, como mucho se vuelve a mostrar.
  }
}

function wasDismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

function rememberDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // Sin storage (modo privado): se vuelve a mostrar en la próxima visita.
  }
}

function ShareIcon() {
  return (
    <svg
      className="inline-block align-[-3px]"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
    </svg>
  );
}

/**
 * Tarjeta descartable para instalar la PWA.
 * Android/Chrome: usa `beforeinstallprompt`. iOS Safari: explica "Compartir → Agregar a inicio".
 * Solo en celulares (en desktop no se ofrece) y como mucho una vez por sesión del navegador.
 * Si se descarta, no vuelve a aparecer por 30 días. Nunca aparece si la app ya corre instalada.
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<Mode>(null);
  const [pending, setPending] = useState(false);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || wasDismissedRecently() || wasShownThisSession()) return;
    const ios = isIosSafari();
    if (!ios && !isAndroid()) return;

    const show = (m: Exclude<Mode, null>) => {
      rememberShown();
      setMode(m);
    };

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      show("android");
    };
    const onInstalled = () => {
      deferred.current = null;
      setMode(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const timer = ios ? window.setTimeout(() => show("ios"), SHOW_DELAY_MS) : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!mode) return null;

  const dismiss = () => {
    rememberDismiss();
    setMode(null);
  };

  const install = async () => {
    const e = deferred.current;
    if (!e) return dismiss();
    setPending(true);
    try {
      await e.prompt();
      const choice = await e.userChoice;
      deferred.current = null;
      if (choice.outcome === "accepted") setMode(null);
      else dismiss();
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby="install-prompt-title"
      className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 mx-auto max-w-sm animate-modal-in rounded-card border border-border bg-surface-2 p-4 shadow-card sm:bottom-4"
    >
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- ícono estático chico */}
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p id="install-prompt-title" className="text-sm font-bold">
            Instalá El Bravo en tu celular
          </p>
          {mode === "ios" ? (
            <p className="mt-1 text-xs text-fg-muted">
              Tocá Compartir <ShareIcon /> → <span className="font-semibold text-fg">Agregar a inicio</span>.
            </p>
          ) : (
            <p className="mt-1 text-xs text-fg-muted">Abrila como app, en pantalla completa y sin la barra del navegador.</p>
          )}
        </div>
        <IconButton label="Cerrar" onClick={dismiss} className="-mr-2 -mt-2 h-9 w-9">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </IconButton>
      </div>
      {mode === "android" && (
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={dismiss}>
            Ahora no
          </Button>
          <Button size="sm" pending={pending} onClick={install}>
            Instalar
          </Button>
        </div>
      )}
    </div>
  );
}
