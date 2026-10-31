import { Pill } from "@/src/components/ui";
import type { RoutineVisibility } from "@/src/schemas/routine";

/** "N ejercicios · M series" (con singular). Compartido por la tarjeta, el detalle y el perfil. */
export function routineCountsLabel(exerciseCount: number, setCount: number): string {
  return `${exerciseCount} ${exerciseCount === 1 ? "ejercicio" : "ejercicios"} · ${setCount} ${setCount === 1 ? "serie" : "series"}`;
}

export function RoutineCounts({ exerciseCount, setCount, className }: { exerciseCount: number; setCount: number; className?: string }) {
  return <p className={className ?? "text-sm text-fg-muted"}>{routineCountsLabel(exerciseCount, setCount)}</p>;
}

/** Pastilla "Pública"; las privadas no llevan nada, salvo con `showPrivate` (lista propia: "Privada" neutra). */
export function VisibilityPill({ visibility, showPrivate = false }: { visibility: RoutineVisibility | undefined; showPrivate?: boolean }) {
  if (visibility === "public") return <Pill tone="primary">Pública</Pill>;
  if (visibility === "private" && showPrivate) return <Pill>Privada</Pill>;
  return null;
}

export function copiedFromLabel(userName: string): string {
  return `Basada en la rutina de ${userName}`;
}

/** "Basada en la rutina de X" cuando la rutina es una copia. */
export function CopiedFromNote({ userName, className }: { userName: string | null | undefined; className?: string }) {
  if (!userName) return null;
  return <p className={className ?? "text-xs text-fg-subtle"}>{copiedFromLabel(userName)}</p>;
}
