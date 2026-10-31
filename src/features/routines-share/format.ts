/**
 * Formato de texto de rutinas de El Bravo (fase 1 del spec 2026-10-31): legible, para pasarse por
 * WhatsApp. `parseRoutineText` es tolerante con lo que escribe la gente; `routineToText` (Task 3)
 * escribe el formato canónico. Puro, sin I/O.
 */
import type { RoutineForEditor } from "@/src/schemas/routine";
import type { SetKind } from "@/src/features/workout/state";
import type { ParsedExercise, ParsedRoutine, ParsedSet } from "./types";

const MAX_SETS = 30;
const KIND_PREFIX: Record<string, SetKind> = { w: "warmup", d: "drop", f: "failure" };
/** "Nombre — series": guión largo/medio/corto con espacios, o dos puntos seguidos de espacio ("Entreno 18:00" no separa). */
const SEPARATOR = String.raw`(?:\s[—–-]\s|:\s+)`;
const EXERCISE_LINE = new RegExp(`^(.+?)\\s*${SEPARATOR}(.+)$`);
const SEPARATOR_G = new RegExp(SEPARATOR, "g");
const REST = /\s*·\s*desc(?:anso)?\.?\s*(\d+)\s*(?:s|seg|segundos|")?\s*$/i;
const NUM = "(\\d+(?:[.,]\\d+)?)";

const num = (v: string) => Number(v.replace(",", "."));
const set = (o: Partial<ParsedSet>): ParsedSet => ({ kind: "normal", reps: null, durationSeconds: null, weightKg: null, ...o });
const clampInt = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(n)));

/** "45s", "45 seg", "1:30", "20:00" → segundos. */
function parseDuration(v: string): number | null {
  const mmss = v.match(/^(\d+):(\d{2})$/);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  const secs = v.match(/^(\d+)\s*(?:s|seg|segundos|")$/i);
  return secs ? Number(secs[1]) : null;
}

/** Una serie suelta: "[W|D|F] 10 @ 50 kg" o "[W|D|F] 45s" o "máx". */
function parseOneSet(raw: string): ParsedSet | null {
  let t = raw.trim();
  let kind: SetKind = "normal";
  const pre = t.match(/^([wdf])\s+/i);
  if (pre) {
    kind = KIND_PREFIX[pre[1].toLowerCase()];
    t = t.slice(pre[0].length);
  }
  // "máx" = sin reps fijas (el tipo sale del prefijo); "fallo" = al fallo. Ambos admiten "@ peso".
  const open = t.match(new RegExp(`^(m[aá]x|fallo)(?:\\s*@\\s*${NUM}\\s*(?:kgs?)?)?$`, "i"));
  if (open) {
    const weightKg = open[2] ? Math.min(1000, num(open[2])) : null;
    return set({ kind: /^fallo$/i.test(open[1]) ? "failure" : kind, weightKg });
  }
  const dur = parseDuration(t);
  if (dur !== null) return set({ kind, durationSeconds: clampInt(dur, 1, 36000) });
  const m = t.match(new RegExp(`^(\\d+)(?:\\s*(?:reps?)?)?(?:\\s*@\\s*${NUM}\\s*(?:kgs?)?)?$`, "i"));
  if (!m) return null;
  return set({ kind, reps: clampInt(Number(m[1]), 1, 1000), weightKg: m[2] ? Math.min(1000, num(m[2])) : null });
}

/** "4×8 @ 60 kg" / "3×45s" / "3×máx" / "10 @ 50, 8 @ 55" → series. */
function parseSets(spec: string): ParsedSet[] | null {
  const repeated = spec.match(/^(\d+)\s*[x×*]\s*(.+)$/i);
  if (repeated) {
    const one = parseOneSet(repeated[2]);
    if (!one) return null;
    return Array.from({ length: Math.min(MAX_SETS, Math.max(1, Number(repeated[1]))) }, () => ({ ...one }));
  }
  const parts = spec.split(/,\s+|;\s*/).filter(Boolean);
  const sets = parts.map(parseOneSet);
  return sets.every((x): x is ParsedSet => x !== null) && sets.length > 0 ? sets.slice(0, MAX_SETS) : null;
}

function parseExerciseLine(line: string): ParsedExercise | null {
  let rest: number | null = null;
  const r = line.match(REST);
  if (r) {
    rest = clampInt(Number(r[1]), 0, 3600);
    line = line.slice(0, r.index).trim();
  }
  const split = splitNameAndSets(line);
  return split ? { name: split.name.replace(/\s+/g, " "), restSeconds: rest, sets: split.sets } : null;
}

/**
 * Parte "nombre <sep> series" donde el nombre puede tener guiones. Primero el último " — " (lo que escribe El Bravo),
 * después el primer separador tolerante y, si las series no se entienden, cada separador de derecha a izquierda.
 */
function splitNameAndSets(line: string): { name: string; sets: ParsedSet[] } | null {
  const attempt = (name: string, spec: string) => {
    const sets = name.trim() ? parseSets(spec.trim()) : null;
    return sets ? { name: name.trim(), sets } : null;
  };
  const em = line.lastIndexOf(" — ");
  if (em >= 0) {
    const r = attempt(line.slice(0, em), line.slice(em + 3));
    if (r) return r;
  }
  const m = line.match(EXERCISE_LINE);
  if (!m) return null;
  const first = attempt(m[1], m[2]);
  if (first) return first;
  const seps = [...line.matchAll(SEPARATOR_G)];
  for (let k = seps.length - 1; k >= 0; k--) {
    const sep = seps[k];
    const r = attempt(line.slice(0, sep.index), line.slice(sep.index + sep[0].length));
    if (r) return r;
  }
  return null;
}

const stripDecoration = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "").trim();

export function parseRoutineText(text: string): ParsedRoutine {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let name = "";
  let notes: string | null = null;
  const exercises: ParsedExercise[] = [];
  const unparsedLines: string[] = [];
  for (const [idx, line] of lines.entries()) {
    if (/^hecho con el bravo/i.test(line)) continue;
    const notesMatch = line.match(/^notas?:\s*(.+)$/i);
    if (notesMatch) {
      notes = notesMatch[1].trim();
      continue;
    }
    // La primera línea con 🏋 es el título aunque parezca un ejercicio ("🏋️ Fuerza: 5x5").
    if (idx === 0 && line.startsWith("🏋")) {
      name = stripDecoration(line).slice(0, 100);
      continue;
    }
    const ex = parseExerciseLine(line);
    if (ex) exercises.push(ex);
    else if (!name && exercises.length === 0) name = stripDecoration(line).slice(0, 100);
    else unparsedLines.push(line);
  }
  return { name: name || "Rutina importada", notes, exercises, unparsedLines };
}

/** Alcanza para importar sin IA: al menos un ejercicio y casi todo entendido (≤ 1 línea suelta). */
export function looksLikeBravoFormat(p: ParsedRoutine): boolean {
  return p.exercises.length > 0 && p.unparsedLines.length <= 1;
}

const fmtNum = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const PREFIX: Partial<Record<SetKind, string>> = { warmup: "W ", drop: "D ", failure: "F " };

type TargetSet = RoutineForEditor["exercises"][number]["sets"][number];

/** Una serie en el formato de texto ("W 10 @ 50 kg", "45s", "máx"). `withKind: false` omite el prefijo W/D/F (la vista de lectura ya lo muestra aparte). */
export function oneSetText(s: TargetSet, withKind = true): string {
  const prefix = withKind ? (PREFIX[s.kind] ?? "") : "";
  if (s.targetDurationSeconds) {
    const d = s.targetDurationSeconds;
    return `${prefix}${d >= 60 && d % 60 !== 0 ? `${Math.floor(d / 60)}:${String(d % 60).padStart(2, "0")}` : d >= 60 ? `${d / 60}:00` : `${d}s`}`;
  }
  const weight = s.targetWeightKg !== null ? ` @ ${fmtNum(s.targetWeightKg)} kg` : "";
  return `${prefix}${s.targetReps === null ? "máx" : s.targetReps}${weight}`;
}

function setsText(sets: TargetSet[]): string {
  const first = oneSetText(sets[0]);
  if (sets.every((s) => oneSetText(s) === first)) return `${sets.length}×${first}`;
  return sets.map((s) => oneSetText(s)).join(", ");
}

export function routineToText(r: RoutineForEditor, opts: { url?: string } = {}): string {
  const lines = [`🏋️ ${r.name}`];
  if (r.notes?.trim()) lines.push(`Notas: ${r.notes.trim().replace(/\s*\n\s*/g, " ")}`);
  lines.push("");
  for (const e of r.exercises) {
    lines.push(`${e.exercise.name} — ${setsText(e.sets)}${e.restSeconds ? ` · desc ${e.restSeconds}s` : ""}`);
  }
  lines.push("", opts.url ? `Hecho con El Bravo · ${opts.url}` : "Hecho con El Bravo");
  return lines.join("\n");
}
