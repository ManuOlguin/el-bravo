/** Formatos y etiquetas del editor de series (puros, es-AR). */
import type { SetKind } from "./state";

export type PreviousSetLike = { reps: number | null; durationSeconds: number | null; weightKg: number | null };

export const KIND_ORDER: SetKind[] = ["normal", "warmup", "drop", "failure"];
export const KIND_LETTER: Record<Exclude<SetKind, "normal">, string> = { warmup: "W", drop: "D", failure: "F" };
export const KIND_LABEL: Record<SetKind, string> = { normal: "Normal", warmup: "Calentamiento", drop: "Drop set", failure: "Al fallo" };

export function nextKind(k: SetKind): SetKind {
  return KIND_ORDER[(KIND_ORDER.indexOf(k) + 1) % KIND_ORDER.length];
}

/** Etiqueta de cada serie: W/D/F para las especiales y el número para las normales (1, 2, 3…). */
export function setLabels(sets: { kind: SetKind }[]): string[] {
  let n = 0;
  return sets.map((s) => (s.kind === "normal" ? String(++n) : KIND_LETTER[s.kind]));
}

/** "42,5" (coma decimal, sin ceros de más). */
export function formatKg(kg: number): string {
  return (Math.round(kg * 100) / 100).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

/** "45 s", "1:30 min". */
export function formatSeconds(s: number): string {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}:${String(r).padStart(2, "0")} min` : `${m} min`;
}

/** Texto compacto de una serie: "40×10", "×12", "45 s", "20 kg · 45 s". */
export function setText(s: PreviousSetLike): string {
  const kg = s.weightKg !== null && s.weightKg > 0 ? formatKg(s.weightKg) : null;
  if (s.durationSeconds !== null && s.reps === null) return kg ? `${kg} kg · ${formatSeconds(s.durationSeconds)}` : formatSeconds(s.durationSeconds);
  if (s.reps === null) return kg ? `${kg} kg` : "—";
  return kg ? `${kg}×${s.reps}` : `×${s.reps}`;
}

/** "1.234 kg" */
export function formatVolume(kg: number): string {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(kg))} kg`;
}

export const REST_PRESETS = [0, 30, 45, 60, 90, 120, 180, 240] as const;

export function restLabel(s: number | null): string {
  if (s === null) return "Descanso: —";
  if (s === 0) return "Sin descanso";
  return `Descanso: ${formatSeconds(s)}`;
}
