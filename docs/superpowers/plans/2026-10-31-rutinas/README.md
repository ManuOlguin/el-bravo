# Rutinas compartibles, importación con IA y curaduría — planes

**Spec:** [`docs/superpowers/specs/2026-10-31-rutinas-compartibles-ia-design.md`](../../specs/2026-10-31-rutinas-compartibles-ia-design.md)

Cuatro planes, uno por fase. Cada fase se publica sola y en orden (las migraciones van a producción antes del push, con `prisma migrate deploy` usando `DATABASE_URL` de `.env.production.local`, como hasta ahora).

| Fase | Plan | Depende de | Necesita en Vercel |
|---|---|---|---|
| 1 | [Formato de texto, compartir e importar texto](fase-1-formato-texto.md) | — | — |
| 2 | [Rutinas públicas y copiar](fase-2-publicas-copiar.md) | 1 | — |
| 3 | [Importar con IA](fase-3-importar-ia.md) | 1 | `OPENAI_API_KEY` (y opcional `OPENAI_MODEL`) |
| 4 | [Curaduría del catálogo](fase-4-curaduria.md) | 1, 3 (cliente OpenAI) | `OPENAI_API_KEY`, `ADMIN_EMAILS` |

## Convenciones del repo (valen para todas las fases)

- Next.js 16 App Router, React 19, Tailwind 4 (solo tokens de `app/globals.css`; `npm run lint:colors` prohíbe hex en componentes), Prisma 7 + MySQL (TiDB en producción), Zod 4, Vitest (`npm test` unit, `npm run test:int` integración contra MySQL local), Playwright (`npm run test:e2e`, construye y levanta su propio server: **parar el dev server antes**).
- UI y textos en español rioplatense. Componentes en `src/components/ui` (`Button`, `Card`, `Sheet`, `Field`, `Input`, `Textarea`, `toast`, `useConfirm`…).
- Server Actions devuelven `ActionResult` (`ok`/`fail`/`parseInput`/`runAction` de `src/server/http/result.ts`); toda acción exige sesión con `requireUser()` (lo verifica `src/server/actions/auth-coverage.test.ts`).
- Migraciones: `npx prisma migrate dev --name <nombre>` y después **reescribir en el SQL los nombres de tabla en PascalCase** (`` `Exercise` ``, no `` `exercise` ``: el MySQL local tiene `lower_case_table_names=1`) y actualizar el checksum en las DBs locales (ver fase 1, Task 1).
- Gates antes de cada commit de cierre de fase: `npm run typecheck && npm run lint && npm run lint:colors && npm test && npm run test:int` y, con el dev server parado, `npm run test:e2e`.
- Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Push a `main` de `ManuOlguin/el-bravo` = deploy a producción (elbravo.vercel.app): solo con OK del dueño.

## Interfaces compartidas entre fases

Definidas en la fase 1; las fases 2–4 las consumen tal cual.

```ts
// src/features/routines-share/types.ts
import type { SetKind } from "@/src/features/workout/state";
import type { Equipment, ExerciseSummary } from "@/src/features/exercises/types";

export type ParsedSet = { kind: SetKind; reps: number | null; durationSeconds: number | null; weightKg: number | null };
export type ParsedExercise = { name: string; restSeconds: number | null; sets: ParsedSet[] };
export type ParsedRoutine = { name: string; notes: string | null; exercises: ParsedExercise[]; unparsedLines: string[] };

/** Ejercicio que todavía no existe: se crea al guardar la rutina. */
export type NewExerciseDraft = {
  tempId: string; // id temporal; en el editor el ejercicio lleva id `new:<tempId>`
  name: string;
  nameEn: string | null;
  measureType: "reps" | "duration";
  equipment: Equipment;
  tracksWeight: boolean;
  muscles: { muscleSlug: string; percentage: number }[]; // puede venir vacío (fase 1); la IA lo completa (fase 3)
  source: "user" | "ai";
};

export type ImportMatch = { kind: "found"; exercise: ExerciseSummary } | { kind: "new"; draft: NewExerciseDraft };
export type ImportItem = { key: string; sourceName: string; match: ImportMatch; restSeconds: number | null; sets: ParsedSet[] };
export type ImportDraft = { name: string; notes: string | null; items: ImportItem[] };
```

```ts
// src/features/routines-share/format.ts (puro)
export function parseRoutineText(text: string): ParsedRoutine;
export function looksLikeBravoFormat(p: ParsedRoutine): boolean;
export function routineToText(r: RoutineForEditor, opts?: { url?: string }): string;

// src/features/routines-share/match.ts (puro)
export const PENDING_PREFIX = "new:";
export const isPendingExerciseId = (id: string) => id.startsWith(PENDING_PREFIX);
export function matchImport(parsed: ParsedRoutine, catalog: CatalogEntry[], hints?: Map<string, Partial<NewExerciseDraft>>): ImportDraft;
export function importDraftToRoutine(d: ImportDraft): RoutineForEditor; // ids `new:<tempId>` para los nuevos
```

```ts
// src/schemas/routine.ts — RoutineInput gana ejercicios nuevos (fase 1)
newExercises?: NewExerciseInput[]; // { tempId, name, nameEn, measureType, equipment, tracksWeight, muscles: { muscleSlug, percentage }[], source }
// y exercises[].exerciseId puede ser `new:<tempId>` si ese tempId está en newExercises.
// createRoutine / updateRoutine crean esos ejercicios (privados del usuario) en la MISMA transacción.
```
