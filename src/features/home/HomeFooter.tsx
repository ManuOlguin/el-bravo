"use client";

import { useState, useSyncExternalStore } from "react";
import { Sheet, cn } from "@/src/components/ui";
import { CHANGELOG, CHANGELOG_VERSION, type ChangelogSection } from "./changelog";
import type { Quote } from "./quotes";

const SEEN_KEY = "elbravo:changelog-seen";
const TONE: Record<ChangelogSection["tone"], string> = {
  important: "bg-warning",
  new: "bg-primary",
  improved: "bg-silver",
  fixed: "bg-bronze",
};

function readSeen() {
  try {
    return window.localStorage.getItem(SEEN_KEY) === CHANGELOG_VERSION;
  } catch {
    return true;
  }
}
const subscribeNothing = () => () => undefined;

/** Pie de la home: la frase del día y el botón de "Novedades" (con punto verde hasta abrirlo). */
export function HomeFooter({ quote }: { quote: Quote }) {
  const [open, setOpen] = useState(false);
  const storedSeen = useSyncExternalStore(subscribeNothing, readSeen, () => true);
  const [seenNow, setSeenNow] = useState(false);
  const unseen = !storedSeen && !seenNow;

  const openChangelog = () => {
    setOpen(true);
    setSeenNow(true);
    try {
      window.localStorage.setItem(SEEN_KEY, CHANGELOG_VERSION);
    } catch {
      // sin storage: vuelve a marcarse como nuevo
    }
  };

  return (
    <footer className="space-y-4 px-2 pb-4 pt-2 text-center">
      <figure>
        <blockquote className="text-sm italic text-fg-muted">“{quote.quote}”</blockquote>
        <figcaption className="mt-1 text-xs text-fg-subtle">— {quote.author}</figcaption>
      </figure>
      <button
        type="button"
        onClick={openChangelog}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3 py-1.5 text-xs font-semibold text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", unseen ? "animate-pulse bg-primary" : "bg-fg-subtle")} />
        Novedades · {CHANGELOG_VERSION}
        {unseen && <span className="sr-only">(sin leer)</span>}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={`Novedades · ${CHANGELOG_VERSION}`}>
        <div className="space-y-5 text-left">
          {CHANGELOG.map((section) => (
            <section key={section.label} className="space-y-2">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-fg-subtle">
                <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", TONE[section.tone])} />
                {section.label}
              </h3>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.title} className="rounded-xl border border-border bg-surface-2 px-3 py-2.5">
                    <p className="text-sm font-bold">{item.title}</p>
                    <p className="mt-0.5 text-sm text-fg-muted">{item.desc}</p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Sheet>
    </footer>
  );
}
