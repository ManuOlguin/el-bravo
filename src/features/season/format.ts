// Formatos de la experiencia de temporada (puros; cliente y servidor).
import { addDays, formatLocalDate } from "@/src/lib/time";

const DAY_MS = 86_400_000;
const utcMs = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** Días de `from` a `to` (fechas locales "YYYY-MM-DD"); negativo si `to` es anterior. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcMs(to) - utcMs(from)) / DAY_MS);
}

/** "3 nov – 30 nov" */
export function formatSeasonRange(start: string, end: string): string {
  return `${formatLocalDate(start)} – ${formatLocalDate(end)}`;
}

/** Texto del tiempo restante de una temporada activa. */
export function timeLeftLabel(today: string, end: string): string {
  const n = daysBetween(today, end);
  if (n <= 0) return "Último día";
  if (n === 1) return "Termina mañana";
  return `Faltan ${n} días`;
}

/** Texto para una temporada que todavía no empezó. */
export function startsInLabel(today: string, start: string): string {
  const n = daysBetween(today, start);
  if (n <= 0) return "Empieza hoy";
  if (n === 1) return "Empieza mañana";
  return `Empieza en ${n} días`;
}

/** 1.5 → "×1,5" */
export function formatWeight(w: number): string {
  return `×${String(Math.round(w * 100) / 100).replace(".", ",")}`;
}

/** "×1,5 → 30 min cuentan como 45 min" */
export function weightExplanation(w: number, minutes = 30): string {
  if (w <= 0) return "No suma puntos";
  const eff = Math.round(minutes * w * 10) / 10;
  return `${formatWeight(w)} → ${minutes} min cuentan como ${String(eff).replace(".", ",")} min`;
}

export const MEDALS = ["🥇", "🥈", "🥉"] as const;

/** Medalla para los 3 primeros puestos, o null. */
export function medalOf(rank: number): string | null {
  return rank >= 1 && rank <= 3 ? MEDALS[rank - 1] : null;
}

/** Iniciales de los días de la semana (lunes primero). */
export const WEEKDAY_INITIALS = ["L", "M", "M", "J", "V", "S", "D"] as const;
export const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;

/** 0 = lunes … 6 = domingo, para una fecha local. */
export function weekdayIndex(date: string): number {
  const dow = new Date(utcMs(date)).getUTCDay(); // fecha local → medianoche UTC: getUTCDay es exacto
  return (dow + 6) % 7;
}

/** "semana del 3 nov" */
export function weekLabel(weekKey: string): string {
  return `semana del ${formatLocalDate(weekKey)}`;
}

/** Último día de la semana (domingo). */
export function weekEnd(weekKey: string): string {
  return addDays(weekKey, 6);
}

const NUMBER = new Intl.NumberFormat("es-AR");

/** "1 punto" / "3 puntos" (y similares). */
export function plural(n: number, one: string, many: string): string {
  return `${NUMBER.format(n)} ${n === 1 ? one : many}`;
}
