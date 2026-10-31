import Link from "next/link";
import { GROUP_LABEL } from "@/src/features/exercises";
import {
  CopiedFromNote,
  VisibilityPill,
  routineCountsLabel,
} from "@/src/features/workout/RoutineMeta";
import type { RoutineSummary } from "@/src/server/routines/service";

/** Rutinas del perfil: las públicas (ajeno) o todas con etiqueta Pública/Privada (propio). Cada una abre `/routines/[id]`. */
export function ProfileRoutines({
  routines,
  isOwner,
}: {
  routines: RoutineSummary[];
  isOwner: boolean;
}) {
  if (routines.length === 0) {
    return (
      <p className="text-sm text-fg-muted">
        Todavía no tenés rutinas.{" "}
        <Link
          href="/routines/new"
          className="font-semibold text-primary hover:underline"
        >
          Crear una
        </Link>
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface-1">
      {routines.map((r) => (
        <li key={r.id}>
          <Link
            href={`/routines/${r.id}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.name}</p>
              <p className="truncate text-sm text-fg-muted">
                {routineCountsLabel(r.exerciseCount, r.setCount)}
                {r.groupKeys.length > 0 &&
                  ` · ${r.groupKeys.map((k) => GROUP_LABEL[k] ?? k).join(", ")}`}
              </p>
              <CopiedFromNote
                userName={r.copiedFromUserName}
                className="truncate text-xs text-fg-subtle"
              />
            </div>
            {isOwner && (
              <VisibilityPill visibility={r.visibility} showPrivate />
            )}{" "}
          </Link>
        </li>
      ))}
    </ul>
  );
}
