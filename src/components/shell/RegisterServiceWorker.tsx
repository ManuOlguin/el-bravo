"use client";
import { useEffect } from "react";

/** Registra `/sw.js` en producción, o en desarrollo con `NEXT_PUBLIC_ENABLE_SW=1`. */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const enabled = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "1";
    if (!enabled) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((err) => {
      console.error("[sw] no se pudo registrar el service worker", err);
    });
  }, []);
  return null;
}
