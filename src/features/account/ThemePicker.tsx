"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/src/components/ui";
import { DEFAULT_THEME, THEMES, applyTheme, readTheme } from "@/src/lib/themes";

/** El tema es un atributo de <html>: se observa para que el selector refleje cambios hechos en otro lado. */
function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

/** Mini pantalla con los colores del tema (se pinta con `data-theme`, sin repetir la paleta acá). */
function Preview({ theme }: { theme: string }) {
  return (
    <span data-theme={theme} aria-hidden="true" className="block overflow-hidden rounded-xl border border-border bg-bg p-2">
      <span className="mb-1.5 flex items-center justify-between">
        <span className="h-1.5 w-8 rounded-full bg-fg-muted" />
        <span className="h-3 w-3 rounded-full bg-surface-3" />
      </span>
      <span className="block space-y-1.5 rounded-lg border border-border bg-surface-1 p-2">
        <span className="block h-1.5 w-3/4 rounded-full bg-fg-subtle" />
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-3 w-3 rounded-full bg-primary-gradient" />
          ))}
          <span className="h-3 w-3 rounded-full bg-surface-3" />
        </span>
        <span className="block h-4 rounded-md bg-primary-gradient" />
      </span>
    </span>
  );
}

/** Apariencia: elegir entre los temas (se guarda en este dispositivo). */
export function ThemePicker() {
  const current = useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);
  return (
    <section aria-labelledby="theme-title" className="space-y-2">
      <h2 id="theme-title" className="px-1 text-xs font-bold uppercase tracking-wide text-fg-subtle">
        Apariencia
      </h2>
      <div role="radiogroup" aria-labelledby="theme-title" className="grid grid-cols-2 gap-3">
        {THEMES.map((t) => {
          const selected = current === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => applyTheme(t.id)}
              className={cn(
                "space-y-2 rounded-card border-2 p-2 text-left transition-colors",
                selected ? "border-primary bg-primary/5" : "border-border bg-surface-1 hover:bg-surface-2"
              )}
            >
              <Preview theme={t.id} />
              <span className="block px-1">
                <span className="block text-sm font-bold">{t.name}</span>
                <span className="block text-xs text-fg-muted">{t.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="px-1 text-xs text-fg-subtle">Se guarda en este dispositivo.</p>
    </section>
  );
}
