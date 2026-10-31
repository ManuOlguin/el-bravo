"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/src/components/ui";
import { formatDuration } from "@/src/lib/time";
import { isResumable, liveStatus } from "./live-session";
import { formatClock } from "./rest-timer";
import { draftSummary, type WorkoutDraft } from "./state";
import { readDraft } from "./useDraftPersistence";

const PREFIX = "workout-draft:live:";
const LIVE_PATH = /^\/routines\/[^/]+\/live$/;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Found = { routineId: string; draft: WorkoutDraft; savedAt: number };

/** El entrenamiento en vivo más reciente guardado en este dispositivo (si vale la pena retomarlo). */
function findLiveDraft(nowMs: number): Found | null {
  let best: Found | null = null;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      const read = readDraft(key);
      if (!read || !isResumable(read.draft, nowMs, draftSummary(read.draft).setsDone)) continue;
      if (!best || read.savedAt > best.savedAt) best = { routineId: key.slice(PREFIX.length), ...read };
    }
  } catch {
    // sin storage: no hay aviso
  }
  return best;
}

/**
 * Aviso flotante en toda la app mientras hay un entrenamiento en vivo abierto (salvo en su propia
 * pantalla): cronómetro y "Volver". Si parece olvidado (más de 1 h sin tildar), lo dice.
 * Vive en este dispositivo (el borrador está en localStorage).
 */
export function LiveWorkoutBanner() {
  const pathname = usePathname();
  const [state, setState] = useState<{ found: Found | null; now: number } | null>(null);

  useEffect(() => {
    if (pathname && LIVE_PATH.test(pathname)) return;
    const refresh = () => {
      const now = Date.now();
      setState({ found: findLiveDraft(now), now });
    };
    refresh();
    const id = setInterval(refresh, 1000);
    window.addEventListener("storage", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("storage", refresh);
    };
  }, [pathname]);

  if (!state?.found || (pathname && LIVE_PATH.test(pathname))) return null;
  const { found, now } = state;
  const st = liveStatus(found.draft, now);
  const forgotten = st.stale;
  const name = found.draft.routineName || "Entrenamiento";

  return (
    <Link
      href={`/routines/${found.routineId}/live`}
      className={cn(
        "fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-screen-sm items-center gap-3 rounded-card border px-4 py-2.5 shadow-card backdrop-blur sm:bottom-4",
        forgotten ? "border-warning/50 bg-surface-2/95" : "border-primary/50 bg-surface-2/95"
      )}
    >
      <span aria-hidden="true" className={cn("h-2.5 w-2.5 shrink-0 rounded-full", forgotten ? "bg-warning" : "animate-pulse bg-primary")} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{forgotten ? `¿Terminaste «${name}»?` : `Entrenando · ${name}`}</span>
        <span className="block truncate text-xs text-fg-muted">
          {forgotten
            ? `Sin series hace ${formatDuration(Math.round(st.idleMs / 60_000))} · tocá para guardarlo o seguir`
            : `${formatClock(st.elapsedMs / 1000)} · ${plural(draftSummary(found.draft).setsDone, "serie tildada", "series tildadas")}`}
        </span>
      </span>
      <span className={cn("shrink-0 text-sm font-bold", forgotten ? "text-warning" : "text-primary")}>Volver ›</span>
    </Link>
  );
}
