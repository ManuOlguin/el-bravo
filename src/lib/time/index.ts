/**
 * Única fuente de tiempo de la app (ver roadmap D4).
 * - Instantes: `Date` en UTC (lo que se guarda en la DB).
 * - Fechas locales: strings "YYYY-MM-DD" (`LocalDate`), siempre relativas a una zona horaria explícita.
 * - Semanas: lunes a domingo; la clave es la fecha local del lunes (`WeekKey`).
 * Sin dependencias: todo con `Intl.DateTimeFormat`. Nunca usar `setHours`/`getDay`/`getDate`
 * ni `toLocaleString` sin `timeZone` en código de dominio.
 */
export const DEFAULT_TZ = "America/Argentina/Buenos_Aires";
export type LocalDate = string; // "YYYY-MM-DD"
export type WeekKey = string; // "YYYY-MM-DD" del lunes local

const DAY_MS = 86_400_000;
const partsCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    });
    partsCache.set(tz, f);
  }
  return f;
}

function zonedParts(instant: Date, tz: string) {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(instant)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  if (out.hour === 24) out.hour = 0; // algunos ICU devuelven "24" a medianoche
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

const pad = (n: number) => String(n).padStart(2, "0");
const toUtcMidnight = (d: LocalDate) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
};
const fromUtcMs = (ms: number): LocalDate => new Date(ms).toISOString().slice(0, 10);

export function localDateOf(instant: Date, tz: string): LocalDate {
  const p = zonedParts(instant, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function localTimeOf(instant: Date, tz: string): string {
  const p = zonedParts(instant, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function addDays(date: LocalDate, n: number): LocalDate {
  return fromUtcMs(toUtcMidnight(date) + n * DAY_MS);
}

export function weekKeyOfLocalDate(date: LocalDate): WeekKey {
  const dow = new Date(toUtcMidnight(date)).getUTCDay(); // 0 = domingo
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

export function weekKeyOf(instant: Date, tz: string): WeekKey {
  return weekKeyOfLocalDate(localDateOf(instant, tz));
}

export function addWeeks(week: WeekKey, n: number): WeekKey {
  return addDays(week, n * 7);
}

/** Claves de todas las semanas que tocan el rango [start, end] (inclusivo). */
export function weekKeysBetween(start: LocalDate, end: LocalDate): WeekKey[] {
  const out: WeekKey[] = [];
  for (let w = weekKeyOfLocalDate(start); w <= end; w = addWeeks(w, 1)) out.push(w);
  return out;
}

/** Cuántos días (0..7) de la semana `week` caen dentro de [start, end]. */
export function daysInWeekWithin(week: WeekKey, start: LocalDate, end: LocalDate): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(week, i);
    if (d >= start && d <= end) n++;
  }
  return n;
}

function offsetMinutes(instantMs: number, tz: string): number {
  const p = zonedParts(new Date(instantMs), tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(instantMs / 1000) * 1000) / 60000);
}

/** Fecha + hora locales ("HH:mm") en `tz` → instante UTC. */
export function zonedToUtc(date: LocalDate, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetMinutes(guess, tz) * 60000;
  const second = guess - offsetMinutes(first, tz) * 60000;
  return new Date(second);
}

/** "1 nov" (short) o "1 de noviembre de 2026" (long), en es-AR y en la zona indicada. */
export function formatDate(instant: Date, tz: string, style: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: tz, day: "numeric", month: style === "short" ? "short" : "long",
    ...(style === "long" ? { year: "numeric" } : {}),
  }).format(instant).replace(/\./g, "");
}

/** "1 nov, 22:30" */
export function formatDateTime(instant: Date, tz: string): string {
  return `${formatDate(instant, tz, "short")}, ${localTimeOf(instant, tz)}`;
}

export function formatLocalDate(date: LocalDate, style: "short" | "long" = "short"): string {
  return formatDate(new Date(`${date}T12:00:00Z`), "UTC", style);
}

/** "45 min", "1 h", "1 h 10 min" */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Columnas `@db.Date`: Prisma las devuelve como medianoche UTC. */
export function dbDateToLocalDate(d: Date): LocalDate {
  return d.toISOString().slice(0, 10);
}

export function localDateToDbDate(d: LocalDate): Date {
  return new Date(`${d}T00:00:00.000Z`);
}
