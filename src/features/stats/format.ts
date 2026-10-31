/** Formatos numéricos compartidos por perfil y stats (es-AR). */
import { localDateOf, type LocalDate } from "@/src/lib/time";

const int = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

export const formatInt = (n: number) => int.format(n);
export const formatDecimal = (n: number) => oneDecimal.format(n);

/** "12 h", "1,5 h", "45 min" — para totales grandes de tiempo. */
export function formatHours(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  return `${oneDecimal.format(Math.round((minutes / 60) * 10) / 10)} h`;
}

/** "1.234 kg", "12,3 t" a partir de 10.000 kg. */
export function formatKg(kg: number): string {
  if (kg >= 10_000) return `${oneDecimal.format(Math.round(kg / 100) / 10)} t`;
  return `${int.format(kg)} kg`;
}

const monthFmt = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });

/** "2026-10" → "octubre de 2026". */
export function formatMonthKey(month: string): string {
  return monthFmt.format(new Date(`${month}-15T12:00:00Z`));
}

/** Agrupa (manteniendo el orden) por mes local "YYYY-MM" en la zona `tz`. */
export function groupByMonth<T extends { startedAt: Date }>(items: T[], tz: string): { month: string; label: string; items: T[] }[] {
  const out: { month: string; label: string; items: T[] }[] = [];
  for (const item of items) {
    const month = (localDateOf(item.startedAt, tz) as LocalDate).slice(0, 7);
    const last = out[out.length - 1];
    if (last && last.month === month) last.items.push(item);
    else out.push({ month, label: formatMonthKey(month), items: [item] });
  }
  return out;
}
