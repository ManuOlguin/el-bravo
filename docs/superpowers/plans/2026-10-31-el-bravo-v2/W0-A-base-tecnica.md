# W0-A — Base técnica (backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leé primero `00-roadmap.md` (Restricciones globales, Contratos §5.1–5.3, Propiedad de archivos §6.2).

**Goal:** dejar el repo con build verde, tests corriendo, una única fuente de tiempo con zona horaria, una capa de auth central (DAL + `proxy.ts`), un formato de resultado uniforme para Server Actions y tooling para trabajar en paralelo (una DB por worktree).

**Architecture:** módulos chicos y puros en `src/lib/time` y `src/server/http`, cubiertos por tests unitarios con Vitest. La capa de auth en `src/server/auth` es el único lugar que lee la cookie de sesión. `proxy.ts` (Next 16) hace un chequeo optimista y redirige a `/login`.

**Tech Stack:** Vitest 3, `server-only`, `jose`, Next 16 `proxy.ts`, `Intl.DateTimeFormat`.

**Spec:** `docs/superpowers/plans/2026-10-31-el-bravo-v2/00-roadmap.md`

**Rama/worktree:** `v2/w0-a-base` desde `rework/v2`. Puerto del dev server: 3001.

## Global Constraints
Ver `00-roadmap.md` §4. Este workstream **no** toca `prisma/schema.prisma`; eso es W0-C.

---

### Task 1: Vitest, scripts y DB por worktree

**Files:**
- Modify: `package.json` (scripts y devDependencies)
- Create: `vitest.config.ts`
- Create: `tests/setup/global-setup.ts`
- Create: `tests/setup/db.ts`
- Create: `tests/smoke.test.ts`
- Create: `scripts/db-worktree.sh`
- Modify: `prisma.config.ts`
- Modify: `.env.example`

**Interfaces:**
- Produce: `resetDb(): Promise<void>` en `tests/setup/db.ts` (trunca todas las tablas de la DB de test). También los scripts `npm test`, `npm run test:int`, `npm run typecheck` y `npm run db:worktree -- <id> <port>`.

- [ ] **Step 1: Instalar dependencias**

```bash
npm install -D vitest@^3 @vitest/coverage-v8@^3
npm install server-only
```

- [ ] **Step 2: Scripts en `package.json`**

Reemplazar el bloque `scripts` por:

```json
"scripts": {
  "dev": "next dev -p ${PORT:-3000}",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "lint:colors": "node scripts/check-colors.mjs",
  "typecheck": "tsc --noEmit",
  "test": "vitest run --project unit",
  "test:int": "vitest run --project integration",
  "test:watch": "vitest --project unit",
  "seed": "tsx prisma/seed.ts",
  "db:worktree": "bash scripts/db-worktree.sh"
}
```

- [ ] **Step 3: `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

const alias = { "@": path.resolve(__dirname) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
          exclude: ["**/*.int.test.ts", "node_modules/**"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["src/**/*.int.test.ts", "tests/**/*.int.test.ts"],
          environment: "node",
          globalSetup: ["tests/setup/global-setup.ts"],
          fileParallelism: false,
          testTimeout: 20000,
        },
      },
    ],
  },
});
```

- [ ] **Step 4: `prisma.config.ts` carga `.env.local` antes que `.env`**

```ts
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env.local" });
config();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

- [ ] **Step 5: Global setup de integración: apunta a la DB de test y la migra**

`tests/setup/global-setup.ts`:

```ts
import { execSync } from "node:child_process";
import { config } from "dotenv";

export default function setup() {
  config({ path: ".env.local" });
  config();
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("Falta DATABASE_URL_TEST (.env.local). Corré `npm run db:worktree -- <id> <port>`.");
  process.env.DATABASE_URL = url;
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
```

`tests/setup/db.ts`:

```ts
import { config } from "dotenv";
config({ path: ".env.local" });
config();
if (process.env.DATABASE_URL_TEST) process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

import { prisma } from "@/src/lib/db";

export async function resetDb() {
  const rows = await prisma.$queryRawUnsafe<{ t: string }[]>(
    "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name <> '_prisma_migrations'"
  );
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");
  for (const { t } of rows) await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${t}\``);
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
}

export { prisma };
```

- [ ] **Step 6: Smoke test**

`tests/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";
describe("vitest", () => {
  it("runs", () => expect(1 + 1).toBe(2));
});
```

Run: `npm test`
Expected: `1 passed`.

- [ ] **Step 7: Script de DB por worktree**

`scripts/db-worktree.sh`:

```bash
#!/usr/bin/env bash
# Uso: npm run db:worktree -- <id> <port>   (ej: w1-1 3011)
# Crea elbravo_<id> y elbravo_<id>_test, escribe .env.local, migra y siembra.
set -euo pipefail
ID="${1:?id requerido}"; PORT="${2:?port requerido}"
SAFE="$(echo "$ID" | tr '-' '_')"
MYSQL="${MYSQL_BIN:-/opt/homebrew/opt/mysql@8.4/bin/mysql}"
MAIN_ENV="${MAIN_ENV:-$(git rev-parse --path-format=absolute --git-common-dir)/../.env}"
# shellcheck disable=SC1090
source <(grep -E '^(DATABASE_URL|JWT_SECRET)=' "$MAIN_ENV" | sed 's/^/export /')
BASE="${DATABASE_URL%/*}"
"$MYSQL" -uroot -e "CREATE DATABASE IF NOT EXISTS elbravo_${SAFE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE DATABASE IF NOT EXISTS elbravo_${SAFE}_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
cat > .env.local <<EOF
DATABASE_URL="${BASE}/elbravo_${SAFE}"
DATABASE_URL_TEST="${BASE}/elbravo_${SAFE}_test"
JWT_SECRET=${JWT_SECRET}
PORT=${PORT}
EOF
npx prisma migrate deploy
npm run seed
echo "OK: elbravo_${SAFE} lista. Dev server: npm run dev (puerto ${PORT})"
```

`chmod +x scripts/db-worktree.sh`.

- [ ] **Step 8: `.env.example`: agregar al final**

```
# Base de datos de tests de integración (la crea `npm run db:worktree`)
DATABASE_URL_TEST="mysql://elbravo:CHANGE_ME@127.0.0.1:3306/elbravo_test"
```

- [ ] **Step 9: Verificar en el repo principal**

Run: `npm run db:worktree -- main 3000 && npm run test:int`
Expected: crea `elbravo_main_test`, migra y Vitest informa "No test files found" (exit 0 con `--passWithNoTests`). Si sale con código 1 porque no hay tests, agregar `passWithNoTests: true` al proyecto `integration`.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests scripts/db-worktree.sh prisma.config.ts .env.example
git commit -m "chore: add vitest, typecheck script and per-worktree databases"
```

---

### Task 2: Build verde (fix de errores de TypeScript y del bug de rutinas)

**Files:**
- Delete: `app/group/[id]/season/[seasonId]/page.tsx` (archivo de 0 bytes; W2-2 crea la página real)
- Delete: `src/lib/scoring/getUserSeasonStanding.ts` (no se usa y no compila); quitar su import en `app/group/[id]/page.tsx` si existe y reemplazar `userSeasonStanding` por un cálculo desde `seasonLeaderboard` (ver Step 3)
- Delete: `src/lib/scoring/upsertSeasonWeekProgress.ts` (no se usa)
- Modify: `src/lib/scoring/getSeasonLeaderboard.ts` (exportar `SeasonLeaderboardEntry` con `activeWeeks`/`perfectWeeks`)
- Modify: `app/group/[id]/page.tsx:600-651` (mapear `allowedActivityTypes` a `string[]` de nombres)
- Modify: `src/schemas/routine.ts`, `app/api/routine/create/route.ts:85-95`
- Modify: `src/components/RoutineForm.tsx:370` (cast)

**Interfaces:**
- Produce: `npm run typecheck` y `npm run build` en verde. Es un parche mínimo: W1-1 y W2-x reemplazan este código.

- [ ] **Step 1: Ver el estado actual**

Run: `npm run typecheck 2>&1 | grep "error TS"`
Expected: 5 errores (routine/create `.errors`, group page 418 y 651, RoutineForm 370, getUserSeasonStanding).

- [ ] **Step 2: Leaderboard: exportar el tipo y devolver las semanas**

En `src/lib/scoring/getSeasonLeaderboard.ts`, exportar:

```ts
export type SeasonLeaderboardEntry = {
  userId: string; name: string | null; email: string | null; photoUrl: string | null;
  points: number; rank: number; activeWeeks: number; perfectWeeks: number;
};
```

Al final de `getSeasonLeaderboard`, agregar `activeWeeks` y `perfectWeeks` leyendo `seasonWeekProgress`. Para cada `userId`, `activeWeeks` es la cantidad de filas con `activitiesCount > 0` y `perfectWeeks` la cantidad con `goalReached = true`. Usar un único `groupBy` por `userId` con `_count` filtrado, o dos `count` agrupados. El tipo de retorno es `Promise<SeasonLeaderboardEntry[]>`.

- [ ] **Step 3: Página de grupo**
- `app/group/[id]/page.tsx:418`: con el tipo exportado, `buildSeasonLeaderboardWithZeroPointMembers` recibe `SeasonLeaderboardEntry[]` y el error desaparece.
- Si `userSeasonStanding` venía de `getUserSeasonStanding`, reemplazarlo por:

```ts
const userSeasonStanding = seasonLeaderboard.find((e) => e.userId === user.id) ?? null;
```

- `:651`: donde se construyen las season cards (~600-625), mapear `allowedActivityTypes: season.allowedActivityTypeLinks.map((l) => l.activityCategory.name)`, así coincide con `SeasonCard.allowedActivityTypes: string[]` de `GroupPageClient.tsx:38`. Esto además corrige el chip que hoy dice "Otro".

- [ ] **Step 4: Rutinas (hotfix del "error al crear rutina")**

`src/schemas/routine.ts`: los ejercicios aceptan reps **o** duración, y peso opcional:

```ts
import { z } from "zod";

const routineExerciseSchema = z
  .object({
    exerciseId: z.string().min(1, "Elegí un ejercicio"),
    sets: z.coerce.number().int().min(1, "Mínimo 1 serie").max(50),
    reps: z.coerce.number().int().min(1).max(500).nullable().optional(),
    durationSeconds: z.coerce.number().int().min(1).max(36000).nullable().optional(),
    weightKg: z.coerce.number().min(0).max(1000).nullable().optional(),
  })
  .refine((e) => (e.reps ?? null) !== null || (e.durationSeconds ?? null) !== null, {
    message: "Cada ejercicio necesita repeticiones o tiempo",
    path: ["reps"],
  });

export const createRoutineSchema = z.object({
  name: z.string().trim().min(1, "Poné un nombre a la rutina").max(100, "Nombre demasiado largo"),
  exercises: z.array(routineExerciseSchema).min(1, "Agregá al menos un ejercicio"),
});
```

En `app/api/routine/create/route.ts`, en el `catch` del `ZodError`:

```ts
return NextResponse.json(
  { error: error.issues[0]?.message ?? "Datos inválidos", issues: error.issues },
  { status: 400 }
);
```

Y al crear `RoutineExercise`, usar los valores parseados (`reps ?? null`, `durationSeconds ?? null`, `weightKg ?? null`) en lugar de leer el body crudo.

En `RoutineForm.tsx`:
- Mover `setLoading(true)` al **inicio** del submit, antes de crear ejercicios nuevos, con `if (loading) return;` como guard.
- Después de crear cada ejercicio nuevo, actualizar el **estado** `exercises` con el id creado, no solo la copia local. Así un reintento no lo vuelve a crear.

- [ ] **Step 5: `RoutineForm.tsx:370`**

El cast inválido se corrige tipando el `map` con un type guard:

```ts
.filter((x): x is NonNullable<typeof x> => x !== null)
```

aplicado antes del cast, que se elimina.

- [ ] **Step 6: Verificar**

Run: `npm run typecheck && npm run build`
Expected: 0 errores; build OK.
Probar a mano con `npm run dev`: crear una rutina con "Plancha" (por tiempo) + "Press banca" con peso. Se guarda y, al editarla, muestra peso y tiempo.

- [ ] **Step 7: Commit**

```bash
git add -A app src
git commit -m "fix: make build pass and fix routine creation with timed exercises"
```

---

### Task 3: `src/lib/time`, la única fuente de tiempo

**Files:**
- Create: `src/lib/time/index.ts`
- Test: `src/lib/time/time.test.ts`

**Interfaces:**
- Produce: exactamente el contrato de `00-roadmap.md` §5.1.

- [ ] **Step 1: Tests que fallan**

`src/lib/time/time.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  DEFAULT_TZ, localDateOf, localTimeOf, weekKeyOf, weekKeyOfLocalDate, addDays, addWeeks,
  weekKeysBetween, daysInWeekWithin, zonedToUtc, formatDuration, dbDateToLocalDate, localDateToDbDate,
  formatDate,
} from "./index";

const AR = DEFAULT_TZ;

describe("localDateOf / localTimeOf", () => {
  it("convierte UTC a fecha local de Argentina (UTC-3)", () => {
    const i = new Date("2026-11-02T01:30:00Z"); // domingo 1/11 22:30 en AR
    expect(localDateOf(i, AR)).toBe("2026-11-01");
    expect(localTimeOf(i, AR)).toBe("22:30");
  });
  it("respeta otra zona", () => {
    expect(localDateOf(new Date("2026-11-02T01:30:00Z"), "UTC")).toBe("2026-11-02");
  });
});

describe("semanas (lunes a domingo)", () => {
  it("domingo 22:30 en AR pertenece a la semana que empezó el lunes anterior", () => {
    expect(weekKeyOf(new Date("2026-11-02T01:30:00Z"), AR)).toBe("2026-10-26");
  });
  it("lunes es su propia clave", () => {
    expect(weekKeyOfLocalDate("2026-10-26")).toBe("2026-10-26");
  });
  it("addDays / addWeeks cruzan meses y años", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addWeeks("2026-12-28", 1)).toBe("2027-01-04");
  });
  it("weekKeysBetween incluye la semana del inicio y la del fin", () => {
    expect(weekKeysBetween("2026-10-29", "2026-11-10")).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
  });
  it("daysInWeekWithin cuenta días de la semana dentro del rango", () => {
    expect(daysInWeekWithin("2026-10-26", "2026-10-29", "2026-12-31")).toBe(4); // jue..dom
    expect(daysInWeekWithin("2026-11-02", "2026-10-29", "2026-11-03")).toBe(2); // lun, mar
    expect(daysInWeekWithin("2026-11-09", "2026-10-29", "2026-11-03")).toBe(0);
  });
});

describe("zonedToUtc", () => {
  it("hora local AR → UTC (+3h)", () => {
    expect(zonedToUtc("2026-10-30", "18:00", AR).toISOString()).toBe("2026-10-30T21:00:00.000Z");
  });
  it("maneja horario de verano (Madrid)", () => {
    expect(zonedToUtc("2026-07-01", "10:00", "Europe/Madrid").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zonedToUtc("2026-12-01", "10:00", "Europe/Madrid").toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });
});

describe("formatos", () => {
  it("formatDuration", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(70)).toBe("1 h 10 min");
  });
  it("formatDate usa la zona indicada (no la del servidor)", () => {
    expect(formatDate(new Date("2026-11-02T01:30:00Z"), AR, "short")).toBe("1 nov");
  });
  it("columnas @db.Date ida y vuelta", () => {
    expect(dbDateToLocalDate(localDateToDbDate("2026-10-01"))).toBe("2026-10-01");
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `npx vitest run src/lib/time`
Expected: FAIL ("Cannot find module './index'").

- [ ] **Step 3: Implementación**

`src/lib/time/index.ts`:

```ts
export const DEFAULT_TZ = "America/Argentina/Buenos_Aires";
export type LocalDate = string;
export type WeekKey = string;

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

export function weekKeysBetween(start: LocalDate, end: LocalDate): WeekKey[] {
  const out: WeekKey[] = [];
  for (let w = weekKeyOfLocalDate(start); w <= end; w = addWeeks(w, 1)) out.push(w);
  return out;
}

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

export function zonedToUtc(date: LocalDate, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetMinutes(guess, tz) * 60000;
  const second = guess - offsetMinutes(first, tz) * 60000;
  return new Date(second);
}

export function formatDate(instant: Date, tz: string, style: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: tz, day: "numeric", month: style === "short" ? "short" : "long",
    ...(style === "long" ? { year: "numeric" } : {}),
  }).format(instant).replace(".", "");
}

export function formatDateTime(instant: Date, tz: string): string {
  return `${formatDate(instant, tz, "short")}, ${localTimeOf(instant, tz)}`;
}

export function formatLocalDate(date: LocalDate, style: "short" | "long" = "short"): string {
  return formatDate(new Date(`${date}T12:00:00Z`), "UTC", style);
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function dbDateToLocalDate(d: Date): LocalDate {
  return d.toISOString().slice(0, 10);
}

export function localDateToDbDate(d: LocalDate): Date {
  return new Date(`${d}T00:00:00.000Z`);
}
```

- [ ] **Step 4: Correr los tests**

Run: `npx vitest run src/lib/time`
Expected: PASS (todos). Si `formatDate` devuelve "1 nov." con punto en algún runtime, el `replace(".", "")` ya lo cubre. Si el ICU de Node usa otra abreviatura, ajustar **el test**, no la implementación.

- [ ] **Step 5: Commit**

```bash
git add src/lib/time
git commit -m "feat: add timezone-aware time utilities"
```

---

### Task 4: Resultado uniforme de acciones

**Files:**
- Create: `src/server/http/result.ts`
- Test: `src/server/http/result.test.ts`

**Interfaces:**
- Consume: `AuthError` de Task 5 (crear Task 5 primero si se ejecuta en otro orden, o definir `AuthError` en `src/server/auth/errors.ts`, que es lo que hace este plan).
- Produce: contrato §5.3.

- [ ] **Step 1: `src/server/auth/errors.ts`** (lo usan Task 4 y Task 5)

```ts
export type AuthErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND";
export class AuthError extends Error {
  constructor(public code: AuthErrorCode) {
    super(code);
    this.name = "AuthError";
  }
}
```

- [ ] **Step 2: Tests que fallan**

`src/server/http/result.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { ok, fail, parseInput, runAction } from "./result";
import { AuthError } from "@/src/server/auth/errors";

describe("parseInput", () => {
  const schema = z.object({ name: z.string().min(1, "Poné un nombre"), n: z.coerce.number().int() });
  it("devuelve data válida", () => {
    const r = parseInput(schema, { name: "a", n: "3" });
    expect(r).toEqual({ ok: true, data: { name: "a", n: 3 } });
  });
  it("mapea issues a fieldErrors con el primer mensaje como error", () => {
    const r = parseInput(schema, { name: "", n: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.result).toMatchObject({ ok: false, error: "Poné un nombre" });
      expect(r.result.ok === false && r.result.fieldErrors?.name).toEqual(["Poné un nombre"]);
      expect(r.result.ok === false && r.result.fieldErrors?.n?.length).toBe(1);
    }
  });
});

describe("runAction", () => {
  it("pasa resultados ok", async () => {
    expect(await runAction(async () => ok(1, "Listo"))).toEqual({ ok: true, data: 1, message: "Listo" });
  });
  it("traduce AuthError", async () => {
    expect(await runAction(async () => { throw new AuthError("UNAUTHENTICATED"); }))
      .toEqual({ ok: false, error: "Tenés que iniciar sesión." });
    expect(await runAction(async () => { throw new AuthError("FORBIDDEN"); }))
      .toEqual({ ok: false, error: "No tenés permiso para hacer esto." });
  });
  it("traduce P2002 de Prisma", async () => {
    const e = Object.assign(new Error("dup"), { code: "P2002" });
    expect(await runAction(async () => { throw e; })).toEqual({ ok: false, error: "Ya existe un registro con esos datos." });
  });
  it("errores desconocidos → mensaje genérico y log", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await runAction(async () => { throw new Error("boom"); }))
      .toEqual({ ok: false, error: "Algo salió mal. Probá de nuevo." });
    expect(spy).toHaveBeenCalled();
  });
  it("re-lanza los redirect/notFound de Next", async () => {
    const e = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/home;307;" });
    await expect(runAction(async () => { throw e; })).rejects.toBe(e);
  });
  it("fail arma el error", () => {
    expect(fail("x", { a: ["b"] })).toEqual({ ok: false, error: "x", fieldErrors: { a: ["b"] } });
  });
});
```

- [ ] **Step 3: Ver que falla**

Run: `npx vitest run src/server/http`
Expected: FAIL (no existe el módulo).

- [ ] **Step 4: Implementación**

`src/server/http/result.ts`:

```ts
import { z } from "zod";
import { AuthError } from "@/src/server/auth/errors";

export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return message === undefined ? { ok: true, data } : { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return fieldErrors ? { ok: false, error, fieldErrors } : { ok: false, error };
}

export function parseInput<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown
): { ok: true; data: z.infer<S> } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, result: fail(parsed.error.issues[0]?.message ?? "Datos inválidos", fieldErrors) };
}

const AUTH_MESSAGES: Record<AuthError["code"], string> = {
  UNAUTHENTICATED: "Tenés que iniciar sesión.",
  FORBIDDEN: "No tenés permiso para hacer esto.",
  NOT_FOUND: "No encontramos lo que buscabas.",
};

function isNextControlFlow(e: unknown) {
  const digest = (e as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND");
}

export async function runAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (isNextControlFlow(e)) throw e;
    if (e instanceof AuthError) return fail(AUTH_MESSAGES[e.code]);
    const code = (e as { code?: unknown })?.code;
    if (code === "P2002") return fail("Ya existe un registro con esos datos.");
    if (code === "P2025") return fail("No encontramos lo que buscabas.");
    console.error("[action]", e);
    return fail("Algo salió mal. Probá de nuevo.");
  }
}
```

- [ ] **Step 5: Correr los tests**

Run: `npx vitest run src/server/http`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/server/http src/server/auth/errors.ts
git commit -m "feat: add uniform ActionResult helpers for server actions"
```

---

### Task 5: Capa de auth (DAL) + `proxy.ts`

**Files:**
- Create: `src/server/auth/session.ts` (firmar/verificar JWT, cookie)
- Create: `src/server/auth/dal.ts`
- Create: `src/server/auth/policies.ts` (lógica pura de permisos)
- Test: `src/server/auth/policies.test.ts`
- Create: `proxy.ts`
- Modify: `src/lib/currentUser.ts` (pasa a ser un wrapper de compatibilidad sobre `getSession`)
- Modify: `src/lib/auth.ts` (re-exporta desde `session.ts`)

**Interfaces:**
- Produce: contrato §5.2 + `SESSION_COOKIE` + `setSessionCookie(userId, email)`/`clearSessionCookie()`.

- [ ] **Step 1: Test de políticas (lógica pura)**

`src/server/auth/policies.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { membershipRole } from "./policies";

describe("membershipRole", () => {
  it("null si no hay membresía", () => expect(membershipRole(null)).toBeNull());
  it("null si se fue o fue removido", () => {
    expect(membershipRole({ role: "admin", status: "accepted", leftAt: new Date() })).toBeNull();
    expect(membershipRole({ role: "member", status: "removed", leftAt: null })).toBeNull();
  });
  it("rol si está aceptado y activo", () => {
    expect(membershipRole({ role: "admin", status: "accepted", leftAt: null })).toBe("admin");
  });
});
```

Run: `npx vitest run src/server/auth`
Expected: FAIL.

- [ ] **Step 2: `src/server/auth/policies.ts`**

```ts
export type MembershipLike = { role: "admin" | "member"; status: "pending" | "accepted" | "rejected" | "removed"; leftAt: Date | null };

export function membershipRole(m: MembershipLike | null): "admin" | "member" | null {
  if (!m || m.leftAt || m.status !== "accepted") return null;
  return m.role;
}
```

Run: `npx vitest run src/server/auth`
Expected: PASS.

- [ ] **Step 3: `src/server/auth/session.ts`**

```ts
import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = process.env.JWT_COOKIE_NAME || "elbravo_token";
const MAX_AGE_S = 60 * 60 * 24 * 30;

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("Missing JWT_SECRET");
  return new TextEncoder().encode(s);
}

export async function signSessionToken(p: { userId: string; email: string; ver?: number }) {
  return new SignJWT({ email: p.email, ver: p.ver ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, secret());
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") throw new Error("Invalid token");
  return { userId: payload.sub, email: payload.email, ver: typeof payload.ver === "number" ? payload.ver : 0 };
}

export async function setSessionCookie(p: { userId: string; email: string; ver?: number }) {
  const token = await signSessionToken(p);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE_S,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
```

Reescribir `src/lib/auth.ts` como un re-export: `export { signSessionToken as signAuthToken, verifySessionToken as verifyAuthToken } from "@/src/server/auth/session";`. Revisar con grep a sus consumidores (`app/api/auth/*`) y adaptar `{ sub, email }` → `{ userId, email }` donde haga falta.

- [ ] **Step 4: `src/server/auth/dal.ts`**

```ts
import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { DEFAULT_TZ } from "@/src/lib/time";
import { SESSION_COOKIE, verifySessionToken } from "./session";
import { AuthError } from "./errors";
import { membershipRole } from "./policies";

export { AuthError } from "./errors";
export type SessionUser = { id: string; email: string; name: string | null; photoUrl: string | null; timezone: string };

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { userId } = await verifySessionToken(token);
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, photoUrl: true, timezone: true, isActive: true },
    });
    if (!u || !u.isActive) return null;
    return { id: u.id, email: u.email, name: u.name, photoUrl: u.photoUrl, timezone: u.timezone ?? DEFAULT_TZ };
  } catch {
    return null;
  }
});

export async function requireUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new AuthError("UNAUTHENTICATED");
  return s;
}

export async function requirePageUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) {
    const path = (await headers()).get("x-pathname") ?? "/home";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return s;
}

export async function requireGroupMember(groupId: string) {
  const user = await requireUser();
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
    select: { role: true, status: true, leftAt: true },
  });
  const role = membershipRole(m);
  if (!role) throw new AuthError(m ? "FORBIDDEN" : "NOT_FOUND");
  return { user, role };
}

export async function requireGroupAdmin(groupId: string): Promise<SessionUser> {
  const { user, role } = await requireGroupMember(groupId);
  if (role !== "admin") throw new AuthError("FORBIDDEN");
  return user;
}
```

Nota: W0-C agrega `tokenVersion` y W1-4 compara `ver` contra `tokenVersion` dentro de `getSession`. Acá no.

- [ ] **Step 5: `proxy.ts` (raíz del repo)**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC = [/^\/login$/, /^\/register$/, /^\/api\/auth\/(login|register)$/, /^\/api\/health$/, /^\/api\/cron\//];
const AUTH_PAGES = [/^\/login$/, /^\/register$/];
const COOKIE = process.env.JWT_COOKIE_NAME || "elbravo_token";

async function isLoggedIn(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token || !process.env.JWT_SECRET) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const loggedIn = await isLoggedIn(req);
  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-pathname", pathname + search);

  if (AUTH_PAGES.some((r) => r.test(pathname)) && loggedIn) {
    return NextResponse.redirect(new URL("/home", req.url));
  }
  if (PUBLIC.some((r) => r.test(pathname)) || loggedIn) {
    return NextResponse.next({ request: { headers: reqHeaders } });
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Tenés que iniciar sesión." }, { status: 401 });
  }
  const url = new URL("/login", req.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|txt)$).*)"],
};
```

`/login` tiene que respetar `?next=`. En `app/login/page.tsx`, después del login exitoso navegar a `searchParams.get("next") ?? "/home"`, solo si empieza con `/` y no con `//`.

- [ ] **Step 6: Compatibilidad**

`src/lib/currentUser.ts`:

```ts
import { getSession } from "@/src/server/auth/dal";
/** @deprecated usar getSession/requireUser/requirePageUser de src/server/auth/dal */
export async function getCurrentUser() {
  return getSession();
}
```

Ojo: antes devolvía `createdAt`. Buscar con `grep -rn "createdAt" app src | grep -i "user\.createdAt"` y, si algún consumidor lo usa, agregar `createdAt` a `SessionUser` y al `select`.

- [ ] **Step 7: Verificar**

Run: `npm run typecheck && npm test && npm run build`
Expected: verde.

Probar a mano con `npm run dev`:
- Logueado, `/login` redirige a `/home`.
- Deslogueado, `/profile` redirige a `/login?next=%2Fprofile` y, tras loguearte, vuelve a `/profile`.
- `curl -s localhost:3001/api/routine/list` sin cookie devuelve 401 JSON.

- [ ] **Step 8: Commit**

```bash
git add src/server/auth src/lib/auth.ts src/lib/currentUser.ts proxy.ts app/login
git commit -m "feat: add central auth DAL and Next 16 proxy"
```

---

### Task 6: Guardas de calidad (colores hardcodeados, alert/confirm, links)

**Files:**
- Create: `scripts/check-colors.mjs`
- Create: `scripts/color-baseline.json`
- Modify: `eslint.config.mjs`

**Interfaces:**
- Produce: `npm run lint:colors`. Falla si algún archivo **supera** su cantidad de hex de la baseline o si un archivo nuevo tiene hex. W3 deja la baseline en `{}`.

- [ ] **Step 1: `scripts/check-colors.mjs`**

```js
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "src"];
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const baselinePath = "scripts/color-baseline.json";
const update = process.argv.includes("--update");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts|jsx|js)$/.test(p)) out.push(p);
  }
  return out;
}

const counts = {};
for (const root of ROOTS) for (const f of walk(root)) {
  const n = (readFileSync(f, "utf8").match(HEX) || []).length;
  if (n) counts[f] = n;
}

if (update) {
  writeFileSync(baselinePath, JSON.stringify(counts, null, 2) + "\n");
  console.log(`Baseline actualizada: ${Object.keys(counts).length} archivos`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const offenders = Object.entries(counts).filter(([f, n]) => n > (baseline[f] ?? 0));
if (offenders.length) {
  console.error("Colores hex hardcodeados nuevos (usá tokens de app/globals.css):");
  for (const [f, n] of offenders) console.error(`  ${f}: ${n} (baseline ${baseline[f] ?? 0})`);
  process.exit(1);
}
console.log("lint:colors OK");
```

Run: `node scripts/check-colors.mjs --update && npm run lint:colors`
Expected: crea la baseline con los archivos actuales; después "lint:colors OK".

Cuando un workstream limpia un archivo, corre `--update` para bajar su número. Nunca se sube.

- [ ] **Step 2: ESLint**

Agregar al export de `eslint.config.mjs` un bloque de reglas:

```js
{
  rules: {
    "no-alert": "warn",
    "@next/next/no-html-link-for-pages": "error",
    "no-restricted-syntax": ["warn",
      { selector: "CallExpression[callee.property.name='toLocaleString'][arguments.length<2]", message: "Usá src/lib/time (formatDate/formatDateTime) con timeZone explícita." },
      { selector: "CallExpression[callee.property.name='toLocaleDateString'][arguments.length<2]", message: "Usá src/lib/time con timeZone explícita." }
    ],
  },
},
```

(`no-alert` queda en `warn` hasta W3, que lo pasa a `error`.)

- [ ] **Step 3: Verificar**

Run: `npm run lint`
Expected: los errores previos (`no-explicit-any`, etc.) siguen. Las reglas nuevas tienen que aparecer como warnings, y `no-html-link-for-pages` como error donde aplique.

Hay que **corregir los errores nuevos** de `no-html-link-for-pages`: reemplazar esos `<a href="/...">` por `<Link>`. Son pocos, ya que la regla solo marca links a páginas existentes.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-colors.mjs scripts/color-baseline.json eslint.config.mjs app src
git commit -m "chore: add color, alert and date-format guards"
```

---

### Verificación final de W0-A

- [ ] `npm run typecheck && npm run lint && npm test && npm run lint:colors && npm run build`: todo verde. `lint` puede dejar warnings, pero no errores nuevos.
- [ ] `npm run test:int` corre (aunque todavía no haya tests).
- [ ] Probar a mano login/logout, el redirect con `next` y una rutina con un ejercicio por tiempo.
- [ ] Pedir review y merge a `rework/v2`.
