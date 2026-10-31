/** Helpers puros de presentación del feed de notificaciones. */
import { addDays, formatDate, formatLocalDate, localDateOf, type LocalDate } from "@/src/lib/time";

/** "recién", "hace 5 min", "hace 3 h", "hace 2 d" o la fecha corta (zona del usuario). */
export function relativeTime(iso: string, now: Date, tz: string): string {
  const instant = new Date(iso);
  const diffMin = Math.floor((now.getTime() - instant.getTime()) / 60_000);
  if (diffMin < 1) return "recién";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `hace ${diffD} d`;
  return formatDate(instant, tz, "short");
}

/** Etiqueta de un día local: "Hoy", "Ayer" o la fecha larga. */
export function dayLabel(day: LocalDate, today: LocalDate): string {
  if (day === today) return "Hoy";
  if (day === addDays(today, -1)) return "Ayer";
  return formatLocalDate(day, "long");
}

/** Agrupa (manteniendo el orden) por día local en la zona del usuario. */
export function groupByDay<T extends { createdAt: string }>(items: T[], now: Date, tz: string): { day: LocalDate; label: string; items: T[] }[] {
  const today = localDateOf(now, tz);
  const out: { day: LocalDate; label: string; items: T[] }[] = [];
  for (const item of items) {
    const day = localDateOf(new Date(item.createdAt), tz);
    const last = out[out.length - 1];
    if (last && last.day === day) last.items.push(item);
    else out.push({ day, label: dayLabel(day, today), items: [item] });
  }
  return out;
}

/** Parte un título en fragmentos para resaltar los nombres (primera aparición de cada uno). */
export function highlight(title: string, emphasis: string[]): { text: string; strong: boolean }[] {
  let parts: { text: string; strong: boolean }[] = [{ text: title, strong: false }];
  for (const word of emphasis) {
    if (!word) continue;
    let done = false;
    parts = parts.flatMap((p) => {
      if (done || p.strong) return [p];
      const i = p.text.indexOf(word);
      if (i < 0) return [p];
      done = true;
      return [
        { text: p.text.slice(0, i), strong: false },
        { text: word, strong: true },
        { text: p.text.slice(i + word.length), strong: false },
      ].filter((x) => x.text);
    });
  }
  return parts;
}

/** "9+" a partir de 10 para no romper el círculo de la campana. */
export function badgeCount(n: number): string {
  return n > 9 ? "9+" : String(n);
}
