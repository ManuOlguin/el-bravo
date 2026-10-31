# Fase 1 — Formato de texto, compartir e importar texto: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pasarse rutinas por WhatsApp con un texto legible que El Bravo escribe ("Compartir") y lee ("Importar"), creando los ejercicios que falten al guardar.

**Architecture:** Lector y escritor puros del formato (`src/features/routines-share/format.ts`) + asociación a ejercicios del catálogo (`match.ts`) + soporte en el editor de rutinas para ejercicios "pendientes" (id `new:<tempId>`) que `createRoutine`/`updateRoutine` crean en la misma transacción. Sin LLM en esta fase.

**Tech Stack:** Next.js 16, React 19, Prisma 7 (MySQL/TiDB), Zod 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-31-rutinas-compartibles-ia-design.md` (Fase 1) · Índice e interfaces compartidas: `docs/superpowers/plans/2026-10-31-rutinas/README.md`.

## Global Constraints

- UI en español rioplatense; colores solo con tokens (sin hex en componentes).
- Formato: `Nombre — 4×8 @ 60 kg · desc 90s`; `N×Ns`/`N×m:ss` por tiempo; `N×máx` sin reps fijas; lista `10 @ 50 kg, 8 @ 55 kg` para series distintas; prefijos `W`/`D`/`F` para calentamiento/drop/fallo.
- Decimal con coma (`62,5`); separador de lista `, ` (coma + espacio) o `;`.
- Los ejercicios nuevos se crean **recién al guardar la rutina**, privados del usuario, en la misma transacción.
- `Exercise.name` único **por dueño** (`@@unique([createdByUserId, name])`).
- Toda Server Action exige sesión (`requireUser`).

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `prisma/schema.prisma`, `prisma/migrations/*_exercise_name_per_owner/` | Unicidad de nombre por dueño |
| `src/server/exercises/create.ts`, `src/server/actions/exercises.ts` | Quitar `name_taken` (ya no puede pasar) |
| `src/features/routines-share/types.ts` | Tipos compartidos (README) |
| `src/features/routines-share/format.ts` (+ `.test.ts`) | `parseRoutineText`, `looksLikeBravoFormat`, `routineToText` |
| `src/features/routines-share/match.ts` (+ `.test.ts`) | `matchImport`, `importDraftToRoutine`, `isPendingExerciseId` |
| `src/schemas/routine.ts` | `newExercises` en `RoutineInput` |
| `src/server/routines/service.ts` (+ `service.int.test.ts`) | Crear ejercicios pendientes en la transacción |
| `src/features/workout/RoutineEditorScreen.tsx`, `ExerciseBlock.tsx`, `WorkoutEditor.tsx`, `state.ts` | Editor con ejercicios pendientes |
| `src/features/routines-share/ShareRoutineButton.tsx`, `src/features/workout/RoutineCard.tsx` | Compartir |
| `app/routines/import/page.tsx`, `src/features/routines-share/ImportScreen.tsx`, `ImportReview.tsx` | Importar |
| `app/routines/page.tsx` | Link "Importar" |
| `e2e/routine-share.spec.ts` | E2E compartir → importar |

---

### Task 1: Nombre de ejercicio único por dueño

**Files:**
- Modify: `prisma/schema.prisma` (model `Exercise`)
- Create: `prisma/migrations/<timestamp>_exercise_name_per_owner/migration.sql`
- Modify: `src/server/exercises/create.ts`, `src/server/actions/exercises.ts`
- Test: `src/server/actions/exercises.int.test.ts`

**Interfaces:** Produces: `Exercise` con `@@unique([createdByUserId, name])` (Prisma genera `createdByUserId_name` como unique input).

- [ ] **Step 1: Test que falla** — en `src/server/actions/exercises.int.test.ts`, agregar:

```ts
it("dos usuarios pueden tener un ejercicio propio con el mismo nombre", async () => {
  const { user, other, muscle } = await fixtures(); // usar los fixtures existentes del archivo (usuario, otro usuario, un músculo)
  as(user);
  const a = await createExerciseAction({ name: "Remo Hammer", measureType: "reps", equipment: "machine", tracksWeight: true, muscles: [{ muscleId: muscle.id, percentage: 100 }] });
  as(other);
  const b = await createExerciseAction({ name: "Remo Hammer", measureType: "reps", equipment: "machine", tracksWeight: true, muscles: [{ muscleId: muscle.id, percentage: 100 }] });
  expect(a.ok && b.ok).toBe(true);
});
```
(Adaptar nombres de helpers a los que ya usa el archivo: revisar su `beforeEach`/`as()`.)

- [ ] **Step 2:** `npm run test:int -- src/server/actions/exercises.int.test.ts` → FAIL (`name_taken`).

- [ ] **Step 3: Schema** — en `model Exercise`: cambiar `name String @unique @db.VarChar(100)` por `name String @db.VarChar(100)` y agregar `@@unique([createdByUserId, name])` junto al `@@index([createdByUserId])`.

- [ ] **Step 4: Migración**

```bash
npx prisma migrate dev --name exercise_name_per_owner
npx prisma generate
```
Abrir el `migration.sql` generado y reemplazar `` `exercise` `` por `` `Exercise` `` en todas las sentencias. Actualizar el checksum en las DBs locales:

```bash
F=$(ls prisma/migrations/*_exercise_name_per_owner/migration.sql); SUM=$(shasum -a 256 "$F" | cut -d' ' -f1); NAME=$(basename $(dirname "$F"))
source <(grep -E '^DATABASE_URL' .env.local | sed -E 's|DATABASE_URL="?mysql://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/([^"?]*).*|U=\1; P=\2; H=\3|')
for db in $(mysql -u"$U" -p"$P" -h"$H" -N -e "SELECT table_schema FROM information_schema.tables WHERE table_name='_prisma_migrations'"); do mysql -u"$U" -p"$P" -h"$H" "$db" -e "UPDATE _prisma_migrations SET checksum='$SUM' WHERE migration_name='$NAME'"; done
npx prisma migrate status   # "Database schema is up to date!"
```

- [ ] **Step 5: Quitar `name_taken`** — en `src/server/exercises/create.ts`: borrar la variante `| { ok: false; reason: "name_taken" }` del tipo y, en el `catch`, la línea `if (await prisma.exercise.findFirst({ where: { name } ...` (con nombre único por dueño, el único choque posible es un duplicado visible, que ya se devuelve como `duplicate`). En `src/server/actions/exercises.ts`, borrar el `case "name_taken":`.

- [ ] **Step 6:** `npm run typecheck && npm run test:int -- src/server/actions/exercises.int.test.ts` → PASS.

- [ ] **Step 7: Commit**

```bash
git add prisma src/server/exercises/create.ts src/server/actions/exercises.ts src/server/actions/exercises.int.test.ts
git commit -m "feat(exercises): exercise names unique per owner (needed for routine import)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Lector del formato (`parseRoutineText`, `looksLikeBravoFormat`)

**Files:**
- Create: `src/features/routines-share/types.ts` (contenido exacto del README, sección "Interfaces compartidas")
- Create: `src/features/routines-share/format.ts`
- Test: `src/features/routines-share/format.test.ts`

**Interfaces:** Produces `parseRoutineText(text: string): ParsedRoutine` y `looksLikeBravoFormat(p: ParsedRoutine): boolean`.

- [ ] **Step 1: Tests que fallan**

```ts
import { describe, expect, it } from "vitest";
import { looksLikeBravoFormat, parseRoutineText } from "./format";

const s = (reps: number | null, weightKg: number | null = null, kind = "normal", durationSeconds: number | null = null) => ({ kind, reps, weightKg, durationSeconds });

describe("parseRoutineText", () => {
  it("lee el formato que escribe El Bravo", () => {
    const p = parseRoutineText(`🏋️ Pecho y espalda
Notas: llegar al fallo en la última

Press de banca — 4×8 @ 60 kg · desc 90s
Remo con barra — 10 @ 50 kg, 8 @ 55 kg, 6 @ 62,5 kg
Plancha — 3×45s
Dominadas — 3×máx

Hecho con El Bravo · https://elbravo.vercel.app/routines/abc`);
    expect(p.name).toBe("Pecho y espalda");
    expect(p.notes).toBe("llegar al fallo en la última");
    expect(p.exercises).toEqual([
      { name: "Press de banca", restSeconds: 90, sets: [s(8, 60), s(8, 60), s(8, 60), s(8, 60)] },
      { name: "Remo con barra", restSeconds: null, sets: [s(10, 50), s(8, 55), s(6, 62.5)] },
      { name: "Plancha", restSeconds: null, sets: [s(null, null, "normal", 45), s(null, null, "normal", 45), s(null, null, "normal", 45)] },
      { name: "Dominadas", restSeconds: null, sets: [s(null, null, "failure"), s(null, null, "failure"), s(null, null, "failure")] },
    ]);
    expect(p.unparsedLines).toEqual([]);
    expect(looksLikeBravoFormat(p)).toBe(true);
  });

  it("es tolerante: x/X/*, guión o dos puntos, sin kg, tiempo m:ss, prefijos W/D/F", () => {
    const p = parseRoutineText(`Piernas
sentadilla - 3x10 @ 80
Peso muerto: 3 X 5 @ 100kg
Bici: 1x20:00
Prensa — W 15 @ 50, 10 @ 120 kg, D 8 @ 90 kg`);
    expect(p.exercises.map((e) => e.name)).toEqual(["sentadilla", "Peso muerto", "Bici", "Prensa"]);
    expect(p.exercises[0].sets[0]).toEqual(s(10, 80));
    expect(p.exercises[1].sets).toHaveLength(3);
    expect(p.exercises[2].sets).toEqual([s(null, null, "normal", 1200)]);
    expect(p.exercises[3].sets).toEqual([s(15, 50, "warmup"), s(10, 120), s(8, 90, "drop")]);
  });

  it("un texto libre no es formato El Bravo", () => {
    const p = parseRoutineText(`Día 1: hacé 4 series de banca pesada, después remo y terminá con abs.
Descansá bien entre series.`);
    expect(looksLikeBravoFormat(p)).toBe(false);
  });

  it("limita series a 30 y reps/tiempo a rangos válidos", () => {
    const p = parseRoutineText(`X\nBanca — 99×8`);
    expect(p.exercises[0].sets).toHaveLength(30);
  });
});
```

- [ ] **Step 2:** `npx vitest run --project unit src/features/routines-share/format.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementación**

```ts
// src/features/routines-share/format.ts
/**
 * Formato de texto de rutinas de El Bravo (fase 1 del spec 2026-10-31): legible, para pasarse por
 * WhatsApp. `parseRoutineText` es tolerante con lo que escribe la gente; `routineToText` (Task 3)
 * escribe el formato canónico. Puro, sin I/O.
 */
import type { SetKind } from "@/src/features/workout/state";
import type { ParsedExercise, ParsedRoutine, ParsedSet } from "./types";

const MAX_SETS = 30;
const KIND_PREFIX: Record<string, SetKind> = { w: "warmup", d: "drop", f: "failure" };
/** "Nombre — series" (guión largo/medio/corto con espacios, o dos puntos). */
const EXERCISE_LINE = /^(.+?)\s*(?:\s[—–-]\s|:\s*)(.+)$/;
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
  if (/^(m[aá]x|fallo)$/i.test(t)) return set({ kind: "failure" });
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
  const m = line.match(EXERCISE_LINE);
  if (!m) return null;
  const sets = parseSets(m[2].trim());
  if (!sets) return null;
  return { name: m[1].trim().replace(/\s+/g, " "), restSeconds: rest, sets };
}

const stripDecoration = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, "").trim();

export function parseRoutineText(text: string): ParsedRoutine {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let name = "";
  let notes: string | null = null;
  const exercises: ParsedExercise[] = [];
  const unparsedLines: string[] = [];
  for (const line of lines) {
    if (/^hecho con el bravo/i.test(line)) continue;
    const notesMatch = line.match(/^notas?:\s*(.+)$/i);
    if (notesMatch) {
      notes = notesMatch[1].trim();
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
```

- [ ] **Step 4:** `npx vitest run --project unit src/features/routines-share/format.test.ts` → PASS. (Si algún caso de los tests falla, ajustar la regex correspondiente, no el test: los tests son el contrato del formato.)

- [ ] **Step 5: Commit**

```bash
git add src/features/routines-share
git commit -m "feat(routines): tolerant parser for the El Bravo routine text format

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Escritor del formato (`routineToText`) con ida y vuelta

**Files:** Modify `src/features/routines-share/format.ts`; Test `format.test.ts`.

**Interfaces:** Consumes `RoutineForEditor` (`src/schemas/routine.ts`). Produces `routineToText(r, { url? })`.

- [ ] **Step 1: Tests que fallan** (agregar a `format.test.ts`)

```ts
import type { RoutineForEditor } from "@/src/schemas/routine";
import { routineToText } from "./format";

const ex = (name: string, o: Partial<{ measureType: "reps" | "duration"; tracksWeight: boolean }> = {}) => ({
  id: name, name, nameEn: null, measureType: o.measureType ?? "reps", equipment: "barbell" as const, tracksWeight: o.tracksWeight ?? true, primaryGroupKey: null, mediaUrl: null,
});
const rs = (targetReps: number | null, targetWeightKg: number | null = null, kind: "normal" | "warmup" | "drop" | "failure" = "normal", targetDurationSeconds: number | null = null) =>
  ({ kind, targetReps, targetWeightKg, targetDurationSeconds, restSeconds: null });

const ROUTINE: RoutineForEditor = {
  id: "r1", name: "Pecho y espalda", notes: "llegar al fallo",
  exercises: [
    { exercise: ex("Press de banca"), restSeconds: 90, notes: null, sets: [rs(8, 60), rs(8, 60), rs(8, 60), rs(8, 60)] },
    { exercise: ex("Remo con barra"), restSeconds: null, notes: null, sets: [rs(10, 50), rs(8, 55), rs(6, 62.5)] },
    { exercise: ex("Plancha", { measureType: "duration", tracksWeight: false }), restSeconds: null, notes: null, sets: [rs(null, null, "normal", 45), rs(null, null, "normal", 45)] },
    { exercise: ex("Dominadas", { tracksWeight: false }), restSeconds: null, notes: null, sets: [rs(null, null, "failure"), rs(null, null, "failure")] },
    { exercise: ex("Prensa"), restSeconds: null, notes: null, sets: [rs(15, 50, "warmup"), rs(10, 120)] },
  ],
};

describe("routineToText", () => {
  it("escribe el formato canónico", () => {
    expect(routineToText(ROUTINE, { url: "https://elbravo.vercel.app/routines/r1" })).toBe(`🏋️ Pecho y espalda
Notas: llegar al fallo

Press de banca — 4×8 @ 60 kg · desc 90s
Remo con barra — 10 @ 50 kg, 8 @ 55 kg, 6 @ 62,5 kg
Plancha — 2×45s
Dominadas — 2×máx
Prensa — W 15 @ 50 kg, 10 @ 120 kg

Hecho con El Bravo · https://elbravo.vercel.app/routines/r1`);
  });

  it("ida y vuelta: leer lo escrito devuelve las mismas series", () => {
    const p = parseRoutineText(routineToText(ROUTINE));
    expect(p.name).toBe(ROUTINE.name);
    expect(p.exercises.map((e) => [e.name, e.restSeconds, e.sets.map((x) => [x.kind, x.reps, x.weightKg, x.durationSeconds])])).toEqual(
      ROUTINE.exercises.map((e) => [e.exercise.name, e.restSeconds, e.sets.map((x) => [x.kind, x.targetReps, x.targetWeightKg, x.targetDurationSeconds])])
    );
  });

  it("sin url, el pie no lleva link", () => {
    expect(routineToText(ROUTINE).trimEnd().split("\n").at(-1)).toBe("Hecho con El Bravo");
  });
});
```

- [ ] **Step 2:** correr → FAIL (`routineToText` no existe).

- [ ] **Step 3: Implementación** (agregar a `format.ts`)

```ts
import type { RoutineForEditor } from "@/src/schemas/routine";

const fmtNum = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const PREFIX: Partial<Record<SetKind, string>> = { warmup: "W ", drop: "D ", failure: "F " };

type TargetSet = RoutineForEditor["exercises"][number]["sets"][number];

function oneSetText(s: TargetSet): string {
  if (s.targetDurationSeconds) {
    const d = s.targetDurationSeconds;
    return `${PREFIX[s.kind] ?? ""}${d >= 60 && d % 60 !== 0 ? `${Math.floor(d / 60)}:${String(d % 60).padStart(2, "0")}` : d >= 60 ? `${d / 60}:00` : `${d}s`}`;
  }
  if (s.targetReps === null) return s.kind === "failure" ? "máx" : `${PREFIX[s.kind] ?? ""}máx`;
  return `${PREFIX[s.kind] ?? ""}${s.targetReps}${s.targetWeightKg !== null ? ` @ ${fmtNum(s.targetWeightKg)} kg` : ""}`;
}

function setsText(sets: TargetSet[]): string {
  const first = oneSetText(sets[0]);
  const allSame = sets.every((s) => oneSetText(s) === first);
  // "4×F 8" no se lee bien: las series iguales con prefijo (salvo máx) van como lista.
  if (allSame && (sets[0].kind === "normal" || first === "máx")) return `${sets.length}×${first}`;
  return sets.map(oneSetText).join(", ");
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
```
Nota: `Dominadas — 2×máx` vuelve como `kind: "failure"`, igual que el original (`rs(null, null, "failure")`). Con 20:00 el escritor pone `20:00` y el lector lo lee como 1200 s.

- [ ] **Step 4:** correr `format.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git commit -am "feat(routines): routineToText writer with round-trip tests"` (+ Co-Authored-By).

---

### Task 4: Asociación a ejercicios (`matchImport`, `importDraftToRoutine`)

**Files:** Create `src/features/routines-share/match.ts`; Test `match.test.ts`.

**Interfaces:**
- Consumes: `ParsedRoutine`, `CatalogEntry[]` (de `useExerciseCatalog()`), `normalize`/`searchExercises` de `src/features/exercises/search.ts`.
- Produces: `PENDING_PREFIX`, `isPendingExerciseId`, `matchImport(parsed, catalog, hints?)`, `importDraftToRoutine(draft)`, `newExerciseFromName(name, tempId, sets)`.

- [ ] **Step 1: Tests que fallan**

```ts
import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "@/src/features/exercises/types";
import { importDraftToRoutine, isPendingExerciseId, matchImport } from "./match";
import { parseRoutineText } from "./format";

const cat = (name: string, o: Partial<CatalogEntry> = {}): CatalogEntry => ({
  id: name.toLowerCase().replace(/\s+/g, "-"), name, nameEn: null, measureType: "reps", equipment: "barbell", tracksWeight: true,
  primaryGroupKey: "chest", mediaUrl: null, aliases: [], groupKeys: ["chest"], isMine: false, ...o,
});
const CATALOG = [cat("Press de Banca", { nameEn: "Bench Press", aliases: ["banca"] }), cat("Sentadillas", { nameEn: "Squat" }), cat("Plancha", { measureType: "duration", tracksWeight: false })];

describe("matchImport", () => {
  it("encuentra por nombre exacto, alias, inglés o un error de tipeo; el resto es nuevo", () => {
    const d = matchImport(parseRoutineText(`X\nbanca — 3×8\nSquat — 3×5 @ 100 kg\nPlanch — 3×45s\nRemo Hammer — 3×12`), CATALOG);
    expect(d.items.map((i) => (i.match.kind === "found" ? i.match.exercise.name : `nuevo:${i.match.draft.name}`))).toEqual([
      "Press de Banca", "Sentadillas", "Plancha", "nuevo:Remo Hammer",
    ]);
  });

  it("un ejercicio nuevo infiere el tipo y si usa peso por sus series", () => {
    const d = matchImport(parseRoutineText(`X\nWall sit — 3×60s\nMuscle up — 3×5\nPress Arnold — 3×10 @ 14 kg`), CATALOG);
    const drafts = d.items.map((i) => (i.match.kind === "new" ? i.match.draft : null));
    expect(drafts.map((x) => [x?.measureType, x?.tracksWeight, x?.source, x?.muscles])).toEqual([
      ["duration", false, "user", []], ["reps", false, "user", []], ["reps", true, "user", []],
    ]);
  });

  it("el mismo ejercicio nuevo dos veces comparte tempId", () => {
    const d = matchImport(parseRoutineText(`X\nRemo Hammer — 3×12\nRemo hammer — 2×10`), CATALOG);
    const ids = d.items.map((i) => (i.match.kind === "new" ? i.match.draft.tempId : ""));
    expect(ids[0]).toBe(ids[1]);
  });

  it("los hints (fase 3) completan el ejercicio nuevo", () => {
    const d = matchImport(parseRoutineText(`X\nRemo Hammer — 3×12`), CATALOG, new Map([["remo hammer", { equipment: "machine", muscles: [{ muscleSlug: "dorsal", percentage: 100 }], source: "ai" }]]));
    expect(d.items[0].match).toMatchObject({ kind: "new", draft: { equipment: "machine", source: "ai", muscles: [{ muscleSlug: "dorsal", percentage: 100 }] } });
  });

  it("importDraftToRoutine arma un RoutineForEditor con ids new: para los nuevos", () => {
    const r = importDraftToRoutine(matchImport(parseRoutineText(`Mi rutina\nbanca — 2×8 @ 60\nRemo Hammer — 3×12`), CATALOG));
    expect(r.name).toBe("Mi rutina");
    expect(r.exercises[0].exercise.id).toBe("press-de-banca");
    expect(isPendingExerciseId(r.exercises[1].exercise.id)).toBe(true);
    expect(r.exercises[0].sets[0]).toEqual({ kind: "normal", targetReps: 8, targetWeightKg: 60, targetDurationSeconds: null, restSeconds: null });
  });
});
```

- [ ] **Step 2:** correr → FAIL.

- [ ] **Step 3: Implementación**

```ts
// src/features/routines-share/match.ts
/** Asocia los ejercicios de una rutina leída (texto o IA) al catálogo visible del usuario; lo que no está, es nuevo. Puro. */
import { normalize, searchExercises } from "@/src/features/exercises/search";
import type { CatalogEntry, ExerciseSummary } from "@/src/features/exercises/types";
import type { RoutineForEditor } from "@/src/schemas/routine";
import type { ImportDraft, ImportItem, NewExerciseDraft, ParsedRoutine, ParsedSet } from "./types";

export const PENDING_PREFIX = "new:";
export const isPendingExerciseId = (id: string) => id.startsWith(PENDING_PREFIX);

const summary = (e: CatalogEntry): ExerciseSummary => ({
  id: e.id, name: e.name, nameEn: e.nameEn, measureType: e.measureType, equipment: e.equipment,
  tracksWeight: e.tracksWeight, primaryGroupKey: e.primaryGroupKey, mediaUrl: e.mediaUrl,
});

/** Solo aceptamos coincidencias fuertes: exacta (nombre, inglés o alias) o la PRIMERA de la búsqueda si es ≥ 4 letras. */
function findInCatalog(name: string, catalog: CatalogEntry[]): CatalogEntry | null {
  const q = normalize(name);
  const exact = catalog.find((e) => normalize(e.name) === q || (e.nameEn && normalize(e.nameEn) === q) || e.aliases.includes(q));
  if (exact) return exact;
  if (q.length < 4) return null;
  const [top] = searchExercises(catalog, name);
  return top && (normalize(top.name).startsWith(q) || q.startsWith(normalize(top.name)) || normalize(top.name).length - q.length <= 1) ? top : null;
}

export function newExerciseFromName(name: string, tempId: string, sets: ParsedSet[]): NewExerciseDraft {
  const duration = sets.length > 0 && sets.every((s) => s.durationSeconds !== null);
  return {
    tempId, name: name.trim().replace(/\s+/g, " ").slice(0, 100), nameEn: null,
    measureType: duration ? "duration" : "reps", equipment: "other", tracksWeight: sets.some((s) => s.weightKg !== null),
    muscles: [], source: "user",
  };
}

export function matchImport(parsed: ParsedRoutine, catalog: CatalogEntry[], hints?: Map<string, Partial<NewExerciseDraft>>): ImportDraft {
  const pending = new Map<string, NewExerciseDraft>();
  const items: ImportItem[] = parsed.exercises.map((e, i) => {
    const found = findInCatalog(e.name, catalog);
    let match: ImportItem["match"];
    if (found) match = { kind: "found", exercise: summary(found) };
    else {
      const key = normalize(e.name);
      let draft = pending.get(key);
      if (!draft) {
        draft = { ...newExerciseFromName(e.name, `t${pending.size + 1}`, e.sets), ...(hints?.get(key) ?? {}) };
        pending.set(key, draft);
      }
      match = { kind: "new", draft };
    }
    return { key: `i${i}`, sourceName: e.name, match, restSeconds: e.restSeconds, sets: e.sets };
  });
  return { name: parsed.name, notes: parsed.notes, items };
}

/** Borrador listo para `RoutineEditorScreen`; los nuevos llevan id `new:<tempId>` y `primaryGroupKey` del músculo mayor si se conoce. */
export function importDraftToRoutine(d: ImportDraft): RoutineForEditor {
  return {
    id: "", name: d.name, notes: d.notes,
    exercises: d.items.map((i) => ({
      exercise: i.match.kind === "found"
        ? i.match.exercise
        : { id: `${PENDING_PREFIX}${i.match.draft.tempId}`, name: i.match.draft.name, nameEn: i.match.draft.nameEn, measureType: i.match.draft.measureType,
            equipment: i.match.draft.equipment, tracksWeight: i.match.draft.tracksWeight, primaryGroupKey: null, mediaUrl: null },
      restSeconds: i.restSeconds, notes: null,
      sets: i.sets.map((s) => ({ kind: s.kind, targetReps: s.reps, targetWeightKg: s.weightKg, targetDurationSeconds: s.durationSeconds, restSeconds: null })),
    })),
  };
}
```

- [ ] **Step 4:** correr `match.test.ts` → PASS. Si "Planch" no matchea "Plancha" por el ranking de `searchExercises`, ajustar la condición de `findInCatalog` (no el test).

- [ ] **Step 5: Commit** — `feat(routines): match imported exercises to the catalog; pending ids for new ones`.

---

### Task 5: Guardar rutinas con ejercicios nuevos (server)

**Files:**
- Modify: `src/schemas/routine.ts`, `src/server/routines/service.ts`
- Test: `src/server/routines/service.int.test.ts`

**Interfaces:**
- Produces: `newExerciseInputSchema`, `RoutineInput.newExercises?: NewExerciseInput[]`; `createRoutine`/`updateRoutine` aceptan `exerciseId: "new:<tempId>"`.
- Consumes: `PENDING_PREFIX` (Task 4), `slugify` (`prisma/seed/slugify.ts`), `normalize`.

- [ ] **Step 1: Tests que fallan** (agregar a `service.int.test.ts`, usando sus `fixtures()`)

```ts
it("crea los ejercicios nuevos en la misma transacción y los usa", async () => {
  const { user, bench, chest } = await fixtures();
  const { routineId } = await createRoutine(user.id, {
    name: "Importada",
    newExercises: [{ tempId: "t1", name: "Remo Hammer", nameEn: null, measureType: "reps", equipment: "machine", tracksWeight: true, muscles: [{ muscleSlug: chest.slug, percentage: 100 }], source: "user" }],
    exercises: [
      { exerciseId: bench.id, restSeconds: null, notes: null, sets: [{ kind: "normal", targetReps: 8, targetDurationSeconds: null, targetWeightKg: 60, restSeconds: null }] },
      { exerciseId: "new:t1", restSeconds: null, notes: null, sets: [{ kind: "normal", targetReps: 12, targetDurationSeconds: null, targetWeightKg: null, restSeconds: null }] },
    ],
  });
  const created = await prisma.exercise.findFirstOrThrow({ where: { name: "Remo Hammer" }, include: { muscles: true } });
  expect(created.createdByUserId).toBe(user.id);
  expect(created.muscles).toHaveLength(1);
  const r = await getRoutineForEditor(user.id, routineId);
  expect(r.exercises.map((e) => e.exercise.id)).toEqual([bench.id, created.id]);
});

it("si ya tengo uno visible con ese nombre, lo reusa en vez de duplicar", async () => {
  const { user, bench } = await fixtures();
  await createRoutine(user.id, {
    name: "X",
    newExercises: [{ tempId: "t1", name: "press de banca", nameEn: null, measureType: "reps", equipment: "barbell", tracksWeight: true, muscles: [], source: "user" }],
    exercises: [{ exerciseId: "new:t1", restSeconds: null, notes: null, sets: [{ kind: "normal", targetReps: 5, targetDurationSeconds: null, targetWeightKg: null, restSeconds: null }] }],
  });
  expect(await prisma.exercise.count({ where: { createdByUserId: user.id } })).toBe(0);
  expect(await prisma.routineExercise.findFirstOrThrow({ select: { exerciseId: true } })).toEqual({ exerciseId: bench.id });
});

it("un new: sin su definición falla y no deja nada creado", async () => {
  const { user } = await fixtures();
  await expect(createRoutine(user.id, {
    name: "X", exercises: [{ exerciseId: "new:t9", restSeconds: null, notes: null, sets: [{ kind: "normal", targetReps: 5, targetDurationSeconds: null, targetWeightKg: null, restSeconds: null }] }],
  })).rejects.toThrow();
  expect(await prisma.routine.count()).toBe(0);
});
```
(Los fixtures del archivo crean `bench` con nombre "Press de banca" y un músculo `chest`; si los nombres difieren, adaptar.)

- [ ] **Step 2:** `npm run test:int -- src/server/routines/service.int.test.ts` → FAIL.

- [ ] **Step 3: Schema** (`src/schemas/routine.ts`)

```ts
import { EQUIPMENT } from "@/src/features/exercises/types";

export const newExerciseInputSchema = z.object({
  tempId: z.string().regex(/^[a-z0-9]{1,20}$/i),
  name: z.string().trim().min(2, "El nombre del ejercicio nuevo es muy corto").max(100),
  nameEn: z.string().trim().max(100).nullable().default(null),
  measureType: z.enum(["reps", "duration"]),
  equipment: z.enum(EQUIPMENT),
  tracksWeight: z.boolean(),
  muscles: z.array(z.object({ muscleSlug: z.string().min(1).max(60), percentage: z.number().int().min(1).max(100) })).max(8).default([]),
  source: z.enum(["user", "ai"]).default("user"),
});
export type NewExerciseInput = z.infer<typeof newExerciseInputSchema>;
```
y en `routineInputSchema` agregar `newExercises: z.array(newExerciseInputSchema).max(40).optional()`.

- [ ] **Step 4: Service** (`src/server/routines/service.ts`) — antes de `assertExercisesVisible`, resolver los pendientes:

```ts
import { slugify } from "@/prisma/seed/slugify";
import { normalize } from "@/src/features/exercises/search";
import { PENDING_PREFIX } from "@/src/features/routines-share/match";

/**
 * Crea (o reusa, si ya hay uno visible con el mismo nombre normalizado) los ejercicios nuevos de la rutina
 * y reemplaza los ids `new:<tempId>`. Corre dentro de la transacción de la rutina.
 */
async function resolvePendingExercises(tx: Tx, userId: string, input: RoutineInput): Promise<RoutineInput> {
  const pending = input.exercises.filter((e) => e.exerciseId.startsWith(PENDING_PREFIX));
  if (pending.length === 0) return input;
  const defs = new Map((input.newExercises ?? []).map((n) => [n.tempId, n]));
  const visible = await tx.exercise.findMany({ where: visibleTo(userId), select: { id: true, name: true } });
  const byName = new Map(visible.map((v) => [normalize(v.name), v.id]));
  const slugs = await tx.muscle.findMany({ select: { id: true, slug: true } });
  const muscleId = new Map(slugs.map((m) => [m.slug, m.id]));
  const resolved = new Map<string, string>();
  for (const p of pending) {
    const tempId = p.exerciseId.slice(PENDING_PREFIX.length);
    if (resolved.has(tempId)) continue;
    const def = defs.get(tempId);
    if (!def) throw new RoutineError("Falta la definición de un ejercicio nuevo. Volvé a importar la rutina.");
    const existing = byName.get(normalize(def.name));
    if (existing) {
      resolved.set(tempId, existing);
      continue;
    }
    const muscles = def.muscles.filter((m) => muscleId.has(m.muscleSlug));
    const total = muscles.reduce((s, m) => s + m.percentage, 0);
    const created = await tx.exercise.create({
      data: {
        slug: `${slugify(def.name).slice(0, 60) || "ejercicio"}-${Math.random().toString(36).slice(2, 8)}`,
        name: def.name.trim().replace(/\s+/g, " "),
        nameEn: def.nameEn,
        measureType: def.measureType,
        equipment: def.equipment,
        tracksWeight: def.tracksWeight,
        createdByUserId: userId,
        // Porcentajes renormalizados a 100 (la IA puede no sumar exacto).
        muscles: { create: muscles.map((m, i) => ({ muscleId: muscleId.get(m.muscleSlug)!, percentage: i === 0 ? 100 - muscles.slice(1).reduce((s, x) => s + Math.round((x.percentage * 100) / total), 0) : Math.round((m.percentage * 100) / total) })) },
      },
      select: { id: true },
    });
    resolved.set(tempId, created.id);
    byName.set(normalize(def.name), created.id);
  }
  return {
    ...input,
    newExercises: undefined,
    exercises: input.exercises.map((e) => (e.exerciseId.startsWith(PENDING_PREFIX) ? { ...e, exerciseId: resolved.get(e.exerciseId.slice(PENDING_PREFIX.length))! } : e)),
  };
}
```
En `createRoutine` y `updateRoutine`, dentro de la transacción: `const resolved = await resolvePendingExercises(tx, userId, input);` y usar `resolved` en `assertExercisesVisible` y `writeExercises`. (Ojo: el campo `source` se guarda recién en la fase 3, cuando exista `Exercise.source`.)

- [ ] **Step 5:** correr los tests de integración de rutinas → PASS; `npm run typecheck`.

- [ ] **Step 6: Commit** — `feat(routines): create pending exercises inside the routine save transaction`.

---

### Task 6: Editor con ejercicios pendientes

**Files:**
- Modify: `src/features/workout/RoutineEditorScreen.tsx`, `src/features/workout/ExerciseBlock.tsx`, `src/features/workout/WorkoutEditor.tsx`
- Test: `src/features/workout/state.test.ts` (no cambia el reducer; se prueba en E2E de la Task 9)

**Interfaces:**
- Produces: `RoutineEditorScreen({ routine?, initial?, pendingExercises? })` — `initial` precarga una rutina NUEVA (guarda con `createRoutineAction`); `pendingExercises: NewExerciseDraft[]` se mandan como `newExercises` al guardar (solo los que siguen referenciados en el borrador).
- Consumes: `isPendingExerciseId` (Task 4).

- [ ] **Step 1: `RoutineEditorScreen`**

```tsx
export function RoutineEditorScreen({ routine, initial, pendingExercises = [] }: { routine?: RoutineForEditor; initial?: RoutineForEditor; pendingExercises?: NewExerciseDraft[] }) {
  // ...
  const [draft, dispatch] = useReducer(workoutReducer, undefined, () => {
    const base = routine ?? initial;
    return base ? draftFromRoutine(base, "plan", NOW) : newDraft("plan", NOW);
  });
  // en onSave, después de `input = toRoutineInput(draft)`:
  const used = new Set(input.exercises.map((e) => e.exerciseId));
  const newExercises = pendingExercises.filter((p) => used.has(`${PENDING_PREFIX}${p.tempId}`));
  const body = newExercises.length ? { ...input, newExercises } : input;
  // y llamar a createRoutineAction(body) / updateRoutineAction(routine.id, body)
```
Título: `routine ? "Editar rutina" : initial ? "Revisá la rutina importada" : "Nueva rutina"`. Con `initial`, `back="/routines/import"`.

- [ ] **Step 2: `ExerciseBlock`** — junto al nombre: si `isPendingExerciseId(ex.exercise.id)`, en vez de `<ExerciseInfoButton>` mostrar `<Pill tone="primary">Nuevo</Pill>` con `title="Se crea al guardar la rutina"`.

- [ ] **Step 3: `WorkoutEditor`** — en el efecto de "Anterior", filtrar `missing` con `.filter((id) => !isPendingExerciseId(id))` antes de llamar a `loadPrevious`.

- [ ] **Step 4:** `npm run typecheck && npm run lint && npm test` → PASS.

- [ ] **Step 5: Commit** — `feat(routines): routine editor supports pending (to-be-created) exercises`.

---

### Task 7: Compartir una rutina como texto

**Files:**
- Create: `src/features/routines-share/ShareRoutineButton.tsx`
- Modify: `src/features/workout/RoutineCard.tsx`

**Interfaces:** Consumes `getRoutineForEditorAction(routineId)` (`src/server/actions/routines.ts`), `routineToText` (Task 3).

- [ ] **Step 1: Componente**

```tsx
"use client";
import { useTransition } from "react";
import { Button, toast } from "@/src/components/ui";
import { getRoutineForEditorAction } from "@/src/server/actions/routines";
import { routineToText } from "./format";

/** Comparte la rutina como texto El Bravo: hoja nativa del celular (WhatsApp, etc.) o, si no hay, copia al portapapeles. */
export function ShareRoutineButton({ routineId, url, size = "sm" }: { routineId: string; url?: string; size?: "sm" | "md" }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size={size}
      variant="secondary"
      pending={pending}
      onClick={() =>
        start(async () => {
          const r = await getRoutineForEditorAction(routineId);
          if (!r.ok) return void toast.error(r.error);
          const text = routineToText(r.data, { url });
          try {
            if (navigator.share) await navigator.share({ title: r.data.name, text });
            else {
              await navigator.clipboard.writeText(text);
              toast.success("Rutina copiada: pegala en WhatsApp");
            }
          } catch (e) {
            if ((e as { name?: string }).name !== "AbortError") toast.error("No pudimos compartir la rutina.");
          }
        })
      }
    >
      Compartir
    </Button>
  );
}
```
(`url` lo pasa la fase 2 cuando la rutina es pública; en la fase 1 queda sin link.)

- [ ] **Step 2:** En `RoutineCard`, agregar `<ShareRoutineButton routineId={routine.id} />` junto a las acciones existentes (Editar / Empezar).

- [ ] **Step 3:** `npm run typecheck && npm run lint` → PASS.

- [ ] **Step 4: Commit** — `feat(routines): share a routine as El Bravo text`.

---

### Task 8: Importar texto (pantalla + revisión)

**Files:**
- Create: `app/routines/import/page.tsx`, `src/features/routines-share/ImportScreen.tsx`, `src/features/routines-share/ImportReview.tsx`
- Modify: `app/routines/page.tsx` (botón "Importar" en el header y en el estado vacío)

**Interfaces:** Consumes `parseRoutineText`, `looksLikeBravoFormat`, `matchImport`, `importDraftToRoutine`, `useExerciseCatalog`, `ExercisePicker`, `RoutineEditorScreen({ initial, pendingExercises })`. Produces `ImportReview({ draft, onChange, onContinue })` (lo reusa la fase 3).

- [ ] **Step 1: Página**

```tsx
// app/routines/import/page.tsx
import type { Metadata } from "next";
import { requirePageUser } from "@/src/server/auth/dal";
import { ImportScreen } from "@/src/features/routines-share/ImportScreen";

export const metadata: Metadata = { title: "Importar rutina" };

export default async function ImportRoutinePage() {
  await requirePageUser();
  return <ImportScreen />;
}
```

- [ ] **Step 2: `ImportScreen`** — tres pasos en estado local: `paste` → `review` → `edit`.

```tsx
"use client";
import { useState } from "react";
import { Button, Card, PageHeader, Textarea, toast } from "@/src/components/ui";
import { useExerciseCatalog } from "@/src/features/exercises/useExerciseCatalog";
import { RoutineEditorScreen } from "@/src/features/workout/RoutineEditorScreen";
import { looksLikeBravoFormat, parseRoutineText } from "./format";
import { importDraftToRoutine, matchImport } from "./match";
import { ImportReview } from "./ImportReview";
import type { ImportDraft, NewExerciseDraft } from "./types";

const MAX_CHARS = 8000;

/** Importar: pegar texto → revisar ejercicios (encontrados / nuevos) → editor. La IA se suma en la fase 3. */
export function ImportScreen() {
  const { catalog, loading } = useExerciseCatalog();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [editing, setEditing] = useState(false);

  if (draft && editing) {
    const pending = [...new Map(draft.items.flatMap((i) => (i.match.kind === "new" ? [[i.match.draft.tempId, i.match.draft] as const] : []))).values()] as NewExerciseDraft[];
    return <RoutineEditorScreen initial={importDraftToRoutine(draft)} pendingExercises={pending} />;
  }
  if (draft) return <ImportReview draft={draft} onChange={setDraft} onBack={() => setDraft(null)} onContinue={() => setEditing(true)} />;

  const read = () => {
    const parsed = parseRoutineText(text);
    if (!looksLikeBravoFormat(parsed)) return void toast.error("No pudimos leer la rutina. Pegala en el formato de El Bravo (ej.: «Press de banca — 4×8 @ 60 kg»).");
    setDraft(matchImport(parsed, catalog));
  };

  return (
    <div className="mx-auto max-w-screen-sm space-y-4 pb-24">
      <PageHeader title="Importar rutina" subtitle="Pegá una rutina que te pasaron por WhatsApp." back="/routines" />
      <Card className="space-y-3">
        <Textarea rows={12} value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))} placeholder={"🏋️ Pecho y espalda\nPress de banca — 4×8 @ 60 kg\nRemo con barra — 3×10 @ 50 kg"} aria-label="Rutina en texto" />
        <p className="text-right text-xs text-fg-subtle">{text.length}/{MAX_CHARS}</p>
        <Button fullWidth size="lg" disabled={!text.trim() || loading} onClick={read}>Leer rutina</Button>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: `ImportReview`** — lista los ítems; cada uno con estado y acciones.

```tsx
"use client";
import { useState } from "react";
import { Button, Card, Input, PageHeader, Pill } from "@/src/components/ui";
import { ExercisePicker } from "@/src/features/exercises/ExercisePicker";
import type { ImportDraft, ImportItem } from "./types";
import { newExerciseFromName } from "./match";

/** Revisión previa al editor: ✓ encontrado / ✨ nuevo; cambiar el ejercicio asociado o renombrar el nuevo. */
export function ImportReview({ draft, onChange, onBack, onContinue }: { draft: ImportDraft; onChange(d: ImportDraft): void; onBack(): void; onContinue(): void }) {
  const [picking, setPicking] = useState<string | null>(null);
  const setItem = (key: string, patch: (i: ImportItem) => ImportItem) => onChange({ ...draft, items: draft.items.map((i) => (i.key === key ? patch(i) : i)) });
  // El mismo ejercicio nuevo puede aparecer en varios ítems (mismo tempId): renombrar los cambia a todos.
  const renameNew = (tempId: string, name: string) =>
    onChange({ ...draft, items: draft.items.map((i) => (i.match.kind === "new" && i.match.draft.tempId === tempId ? { ...i, match: { kind: "new", draft: { ...i.match.draft, name } } } : i)) });
  const news = new Set(draft.items.flatMap((i) => (i.match.kind === "new" ? [i.match.draft.tempId] : []))).size;
  return (
    <div className="mx-auto max-w-screen-sm space-y-4 pb-24">
      <PageHeader title="Revisá los ejercicios" subtitle={news ? `${news} ${news === 1 ? "ejercicio nuevo se va a crear" : "ejercicios nuevos se van a crear"} al guardar.` : "Encontramos todos los ejercicios."} />
      <ul className="space-y-2" aria-label="Ejercicios importados">
        {draft.items.map((i) => (
          <li key={i.key}>
            <Card className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-fg-subtle">Decía: «{i.sourceName}» · {i.sets.length} series</span>
                {i.match.kind === "found" ? <Pill tone="primary">✓ Encontrado</Pill> : <Pill tone="gold">✨ Nuevo</Pill>}
              </div>
              {i.match.kind === "found" ? (
                <p className="font-bold">{i.match.exercise.name}</p>
              ) : (
                <Input aria-label={`Nombre del ejercicio nuevo «${i.sourceName}»`} value={i.match.draft.name}
                  onChange={(e) => renameNew(i.match.kind === "new" ? i.match.draft.tempId : "", e.target.value)} />
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPicking(i.key)}>Cambiar ejercicio</Button>
                {i.match.kind === "found" && (
                  <Button size="sm" variant="ghost" onClick={() => setItem(i.key, (it) => ({ ...it, match: { kind: "new", draft: newExerciseFromName(it.sourceName, `u${it.key}`, it.sets) } }))}>Es otro (crear nuevo)</Button>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack}>Volver</Button>
        <Button fullWidth size="lg" onClick={onContinue}>Continuar</Button>
      </div>
      <ExercisePicker open={picking !== null} onClose={() => setPicking(null)} title="Elegí el ejercicio"
        onConfirm={(ex) => { if (picking && ex[0]) setItem(picking, (it) => ({ ...it, match: { kind: "found", exercise: ex[0] } })); setPicking(null); }} />
    </div>
  );
}
```
(Revisar la firma real de `onConfirm` de `ExercisePicker` y de `Pill`/`tone`; ajustar.)

- [ ] **Step 4:** En `app/routines/page.tsx`, en `actions` del `PageHeader` (y en el `EmptyState`), agregar `<LinkButton href="/routines/import" size="sm" variant="secondary">Importar</LinkButton>`.

- [ ] **Step 5:** `npm run typecheck && npm run lint && npm run lint:colors` → PASS. Probar a mano en `npm run dev`: compartir una rutina demo, pegar el texto en Importar, revisar, guardar.

- [ ] **Step 6: Commit** — `feat(routines): import a routine from El Bravo text with a review step`.

---

### Task 9: E2E compartir → importar

**Files:** Create `e2e/routine-share.spec.ts`.

- [ ] **Step 1: Test**

```ts
import { expect, test } from "@playwright/test";
import { login } from "./fixtures/helpers";

test("importar una rutina en texto: encuentra los conocidos, crea el nuevo al guardar", async ({ page }) => {
  await login(page, "sofi");
  await page.goto("/routines/import");
  await page.getByLabel("Rutina en texto").fill(`🏋️ Rutina de Juan
Press de banca — 4×8 @ 60 kg · desc 90s
Plancha — 3×45s
Remo en máquina Hammer — 3×12`);
  await page.getByRole("button", { name: "Leer rutina" }).click();
  const list = page.getByRole("list", { name: "Ejercicios importados" });
  await expect(list.getByText("✓ Encontrado")).toHaveCount(2);
  await expect(list.getByText("✨ Nuevo")).toHaveCount(1);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Nuevo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Guardar|Crear rutina/ }).click();
  await expect(page).toHaveURL(/\/routines$/);
  await expect(page.getByRole("listitem").filter({ hasText: "Rutina de Juan" })).toContainText("3 ejercicios");
});
```
(Usar un usuario E2E que no tenga ese ejercicio propio; `sofi` no se usa en otros specs. Ajustar el nombre del botón de guardar al real de `RoutineEditorScreen`.)

- [ ] **Step 2:** con el dev server parado: `npx playwright test e2e/routine-share.spec.ts` → PASS.

- [ ] **Step 3: Commit** — `test(e2e): import routine from text`.

---

### Task 10: Gates y publicación (con OK del dueño)

- [ ] **Step 1:** `npm run typecheck && npm run lint && npm run lint:colors && npm test && npm run test:int`; parar el dev server; `npm run test:e2e` → todo verde.
- [ ] **Step 2:** Pedir OK al dueño. Con el OK: migrar producción y recién después push.

```bash
export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.production.local | sed -E 's/^DATABASE_URL="?([^"]*)"?$/\1/')"
npx prisma migrate deploy
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code && echo OK
git push origin HEAD:main
```
- [ ] **Step 3:** Esperar el deploy (Vercel → Ready), `curl https://elbravo.vercel.app/api/health` → 200.
