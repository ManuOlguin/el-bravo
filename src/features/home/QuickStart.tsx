import Link from "next/link";
import { LinkButton } from "@/src/components/ui";
import { NAV_ITEMS } from "@/src/components/shell/nav-items";
import type { QuickRoutine } from "./queries";

/** Ruta de "Registrar" de la navegación (W2-1 la cambia a /workout/new): así la home no queda desfasada. */
export const LOG_WORKOUT_HREF = NAV_ITEMS.find((i) => i.id === "log")?.href ?? "/workout/new";

/** Botón principal "Registrar entrenamiento" + chips para empezar las rutinas más usadas (→ modo en vivo). */
export function QuickStart({ routines }: { routines: QuickRoutine[] }) {
  return (
    <section aria-label="Empezar a entrenar" className="space-y-3">
      <LinkButton href={LOG_WORKOUT_HREF} size="lg" fullWidth>
        <span aria-hidden="true" className="text-xl leading-none">
          ＋
        </span>
        Registrar entrenamiento
      </LinkButton>
      {routines.length > 0 && (
        <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" aria-label="Rutinas">
          {routines.map((r) => (
            <li key={r.id} className="shrink-0">
              <Link
                href={`/routines/${r.id}/live`}
                className="inline-flex h-9 max-w-[16rem] items-center gap-1.5 rounded-full border border-border bg-surface-2 px-4 text-sm font-semibold text-fg transition-[transform,background-color] duration-100 hover:bg-surface-3 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span aria-hidden="true" className="text-primary">
                  ▶
                </span>
                <span className="truncate">Empezar {r.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
