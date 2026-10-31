# Fase 4: Curaduría del catálogo. Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un admin de El Bravo (por `ADMIN_EMAILS`) vea los ejercicios que crean los usuarios agrupados y ordenados por uso, le pida a la IA una sugerencia por grupo (promover / sinónimo de / ignorar) y aplique a mano la decisión: los propios se fusionan en el oficial (rutinas e historial incluidos) y se avisa a sus creadores.

**Architecture:** Acceso por email (`src/server/auth/admin.ts`). Agrupamiento puro + loader (`src/server/curation/groups.ts`), análisis con IA cacheado por hash de grupo (`analyze.ts` + modelo `ExerciseCurationSuggestion`), aplicación transaccional e idempotente (`apply.ts`), Server Actions de admin (`src/server/actions/curation.ts`) y página `/admin/ejercicios`. La IA **nunca** aplica nada: solo sugiere y prellena el formulario.

**Tech Stack:** Next.js 16, React 19, Prisma 7 (MySQL/TiDB), Zod 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-31-rutinas-compartibles-ia-design.md` (Fase 4, R5, R6, Pruebas, Migraciones) · Índice y convenciones: `docs/superpowers/plans/2026-10-31-rutinas/README.md`.

## Consumes (de fases anteriores)

- **Fase 1:** `Exercise` con `@@unique([createdByUserId, name])` (la unicidad del catálogo oficial, `createdByUserId = null`, se valida en código).
- **Fase 3** (`fase-3-importar-ia.md`, Tasks 1–2; si al implementar algo quedó con otro nombre, adaptar los imports, no la lógica):

```ts
// src/server/ai/openai.ts
export type AiErrorCode = "timeout" | "rate_limited" | "quota_exceeded" | "auth" | "bad_request" | "unavailable" | "refused" | "truncated" | "invalid_output";
export class AiError extends Error { readonly code: AiErrorCode; readonly status: number | null; constructor(code, message, status?) }
export type JsonSchema = Record<string, unknown>;
export type AiJsonRequest = { system: string; user: string; schemaName: string; schema: JsonSchema; maxOutputTokens?: number };
export interface AiClient { readonly model: string; generateJson(req: AiJsonRequest): Promise<string> } // JSON como TEXTO
export function isAiEnabled(env?: Record<string, string | undefined>): boolean;
export function getAiClient(env?: Record<string, string | undefined>): AiClient | null; // null sin OPENAI_API_KEY
```
`generateJson` devuelve texto: acá se hace `JSON.parse` (si falla → `AiError("invalid_output")`) y se valida con Zod. En los tests de integración se reemplaza `getAiClient` con `vi.mock` (como la fase 3); en los de `analyze` se pasa un `AiClient` falso.
`Exercise.source`: enum Prisma `ExerciseSource { catalog user ai }`, default `user` (fase 3, Task 1).

## Global Constraints

- UI en español rioplatense; colores solo con tokens (sin hex en componentes).
- Toda Server Action exige sesión **primero** (`requireUser()` adentro de `requireAdmin()`): sin sesión responde "Tenés que iniciar sesión." (lo verifica `src/server/actions/auth-coverage.test.ts`). Con sesión y sin ser admin: "No encontramos lo que buscabas." (equivale a 404; no se revela que existe). La página `/admin/ejercicios` responde `notFound()`.
- La IA solo sugiere. Promover / sinónimo / ignorar los dispara el admin, con los datos que él editó.
- Todo cambio de datos en **una transacción**, con lock de las filas (`FOR UPDATE`) y acciones idempotentes (repetir no duplica ni vuelve a notificar).
- A OpenAI se mandan nombres de ejercicios, músculos y conteos de uso; **nunca** nombres ni emails de usuarios.
- Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Decisiones de diseño (resueltas en este plan)

| Tema | Decisión |
|---|---|
| "Uso" de un grupo | `users` = creadores distintos (un ejercicio propio solo lo usa su dueño; copiar rutinas lo duplica), `routines` = rutinas distintas, `workouts` = entrenamientos distintos. Orden: users ↓, routines ↓, workouts ↓, key ↑. |
| Agrupamiento | Unión de: mismo nombre normalizado (`normalize`), misma clave por `nameEn`/alias, o distancia de edición ≤ 1 entre claves de **5 letras o más** (evita juntar "curl" con "curo"). Es transitivo (union-find). |
| `groupKey` | El nombre normalizado más repetido del grupo (empate: el menor alfabéticamente). Estable cuando se suman variantes. |
| `groupHash` | sha256 de los miembros ordenados (id, nombre, nombre en inglés, equipamiento, tipo, peso, músculos). **No** incluye el uso: que crezca el uso no obliga a pagar otro análisis. |
| Ignorar | `curationStatus = ignored` + `curationIgnoredUsers` = usuarios del grupo en ese momento. Un grupo con ignorados se oculta mientras `users ≤ max(curationIgnoredUsers)`; si se suma **otro usuario** vuelve con la etiqueta "Volvió: más usuarios". Una variante nueva del mismo usuario no lo revive. |
| Rutina con dos fusionados | `RoutineExercise`/`ActivityExercise` no tienen unique por `(rutina, ejercicio)`: las dos posiciones pasan a apuntar al oficial y se conservan (mismas series). No se fusionan series. |
| Alias al fusionar | Nombre, `nameEn` y alias de cada propio, normalizados; sin el nombre del oficial ni los que ya tiene; `createMany({ skipDuplicates: true })`. Se guardan con `locale = "curated"` y el seed deja de borrarlos al recargar el catálogo. |
| Choque de nombre oficial | Al promover: si el nombre canónico (normalizado) es el nombre **o un alias** de un oficial → error "usá «Es sinónimo de»". |
| Homónimos fuera del grupo | Al promover se fusionan también los propios (de cualquier usuario) cuyo nombre normalizado es igual al canónico: si no, esos usuarios verían duplicado el ejercicio. |
| Slug del oficial | Se crea con un slug temporal y, después de borrar los propios, se le asigna `slugify(nombre)` (con `-2`, `-3`… si hace falta): así no choca con el slug del propio que reemplaza. |
| Textos | `description` + `instructions = { steps, reviewed: false }` (el formato que ya usa la columna Json, ver `src/server/exercises/instructions.ts`). Sin pasos → `instructions = null`. |
| Notificación | `exercise_promoted` a cada creador, también para "sinónimo de" (`data.kind = "promote" \| "alias"`). `dedupeKey = exercise_promoted:<id del primer propio del creador>:<creador>`. No se suma a los tipos configurables de Ajustes (es rara); respeta los defaults (in-app y push). Se manda **después** del commit. |
| Recalcular | Después del commit: `recomputeUserBadges` de los dueños de entrenamientos afectados y `recomputeSeason` de las temporadas **no finalizadas** donde son miembros. (Corrección al spec: los puntos base no dependen del ejercicio, pero los **premios divertidos** sí, por las series por grupo muscular de `loadAwardContext`.) |
| 404 en acciones | `notFound()` dentro de una Server Action no es un camino soportado para responder 404; las acciones lanzan `AuthError("NOT_FOUND")` y `runAction` devuelve el "No encontramos lo que buscabas." estándar. La página sí usa `notFound()`. |

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `src/server/auth/admin.ts` (+ `admin.test.ts`) | `adminEmails`, `isAdmin`, `requireAdmin` (acciones), `requireAdminPage` (páginas) |
| `prisma/schema.prisma`, `prisma/migrations/*_exercise_curation/` | `Exercise.curationStatus`, `curationIgnoredUsers`, `ExerciseCurationSuggestion`, `NotificationType.exercise_promoted` |
| `src/server/notifications/rules.ts` (+ `rules.test.ts`) | Texto de `exercise_promoted` |
| `src/features/exercises/types.ts`, `prisma/seed/exercises.ts` | `CURATED_ALIAS_LOCALE`; el seed conserva los alias curados |
| `src/server/curation/groups.ts` (+ `groups.test.ts`) | Agrupamiento puro, `visibleGroups`, `toGroupView`, loader |
| `src/schemas/curation.ts` | Zod de los datos del oficial y de los inputs de las acciones |
| `src/server/curation/analyze.ts` (+ `analyze.test.ts`, `analyze.int.test.ts`, `__fixtures__/ai-responses.ts`) | Prompt, JSON Schema estricto, validación, caché por hash |
| `src/server/curation/apply.ts` (+ `apply.int.test.ts`) | Promover, sinónimo, ignorar; fusión; efectos posteriores |
| `src/server/actions/curation.ts` (+ `curation.int.test.ts`) | Server Actions de admin |
| `app/admin/ejercicios/page.tsx`, `src/features/curation/{types.ts,CurationScreen.tsx,GroupCard.tsx,PromoteForm.tsx}` | Pantalla |
| `app/settings/page.tsx` | Link "Curaduría del catálogo" (solo admins) |
| `e2e/admin.spec.ts` | No-admin ve 404 |
| `docs/release-v2.md`, `scripts/prod/check-env.mjs`, `.env.example` | `ADMIN_EMAILS` |

---

### Task 1: Acceso de admin (`ADMIN_EMAILS`)

**Files:**
- Create: `src/server/auth/admin.ts`
- Test: `src/server/auth/admin.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `requirePageUser`, `SessionUser` (`src/server/auth/dal.ts`), `AuthError` (`src/server/auth/errors.ts`).
- Produces: `adminEmails(): Set<string>`, `isAdmin(user: { email: string } | null | undefined): boolean`, `requireAdmin(): Promise<SessionUser>`, `requireAdminPage(): Promise<SessionUser>`.

- [ ] **Step 1: Test que falla**

```ts
// src/server/auth/admin.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const session = vi.hoisted(() => ({ user: null as null | { id: string; email: string } }));
vi.mock("@/src/server/auth/dal", async () => {
  const { AuthError } = await import("@/src/server/auth/errors");
  const full = () => ({ ...session.user!, name: null, photoUrl: null, timezone: "America/Argentina/Buenos_Aires" });
  return {
    requireUser: async () => {
      if (!session.user) throw new AuthError("UNAUTHENTICATED");
      return full();
    },
    requirePageUser: async () => {
      if (!session.user) throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
      return full();
    },
  };
});
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Object.assign(new Error("NEXT_NOT_FOUND"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  },
}));

import { isAdmin, requireAdmin, requireAdminPage } from "./admin";

afterEach(() => {
  delete process.env.ADMIN_EMAILS;
  session.user = null;
});

describe("isAdmin", () => {
  it("lee ADMIN_EMAILS separada por comas, sin espacios ni mayúsculas", () => {
    process.env.ADMIN_EMAILS = " Admin@Bravo.test , otra@bravo.test,,";
    expect(isAdmin({ email: "admin@bravo.test" })).toBe(true);
    expect(isAdmin({ email: "OTRA@bravo.test" })).toBe(true);
    expect(isAdmin({ email: "nadie@bravo.test" })).toBe(false);
  });

  it("sin la variable nadie es admin", () => {
    expect(isAdmin({ email: "admin@bravo.test" })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

describe("requireAdmin / requireAdminPage", () => {
  it("acciones: sin sesión pide login; logueado sin ser admin → NOT_FOUND; admin pasa", async () => {
    await expect(requireAdmin()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    session.user = { id: "u1", email: "comun@bravo.test" };
    await expect(requireAdmin()).rejects.toMatchObject({ code: "NOT_FOUND" });
    process.env.ADMIN_EMAILS = "comun@bravo.test";
    await expect(requireAdmin()).resolves.toMatchObject({ id: "u1" });
  });

  it("página: no admin → 404", async () => {
    session.user = { id: "u1", email: "comun@bravo.test" };
    await expect(requireAdminPage()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    process.env.ADMIN_EMAILS = "comun@bravo.test";
    await expect(requireAdminPage()).resolves.toMatchObject({ id: "u1" });
  });
});
```

- [ ] **Step 2:** `npx vitest run --project unit src/server/auth/admin.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementación**

```ts
// src/server/auth/admin.ts
import "server-only";
import { notFound } from "next/navigation";
import { requirePageUser, requireUser, type SessionUser } from "./dal";
import { AuthError } from "./errors";

/**
 * Admins del catálogo (spec rutinas R5): emails de `ADMIN_EMAILS`, separados por coma. Sin roles en la DB.
 * Se lee en cada llamada (barato, y los tests pueden cambiar la variable).
 */
export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdmin(user: { email: string } | null | undefined): boolean {
  return !!user && adminEmails().has(user.email.trim().toLowerCase());
}

/**
 * Para Server Actions: sin sesión → `AuthError("UNAUTHENTICATED")` ("Tenés que iniciar sesión.");
 * con sesión sin ser admin → `AuthError("NOT_FOUND")` ("No encontramos lo que buscabas.", como un 404).
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!isAdmin(user)) throw new AuthError("NOT_FOUND");
  return user;
}

/** Para páginas: sin sesión → /login; sin ser admin → 404 (no se revela que la página existe). */
export async function requireAdminPage(): Promise<SessionUser> {
  const user = await requirePageUser();
  if (!isAdmin(user)) notFound();
  return user;
}
```

- [ ] **Step 4:** `npx vitest run --project unit src/server/auth/admin.test.ts` → PASS; `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/server/auth/admin.ts src/server/auth/admin.test.ts
git commit -m "feat(admin): catalog admins by ADMIN_EMAILS (404 for everyone else)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Migración (estado de curaduría, sugerencias, notificación) y texto de la notificación

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_exercise_curation/migration.sql`
- Modify: `src/server/notifications/rules.ts`, `src/server/notifications/rules.test.ts`

**Interfaces:** Produces: enums `ExerciseCurationStatus` (`pending | ignored`), `ExerciseCurationDecision` (`promote | alias_of | skip`); `Exercise.curationStatus`, `Exercise.curationIgnoredUsers`; modelo `ExerciseCurationSuggestion { id, groupKey @unique, groupHash, decision, payload Json, createdAt, updatedAt }`; `NotificationType.exercise_promoted`; `renderNotification("exercise_promoted", { kind, exerciseName, catalogName })`.

- [ ] **Step 1: Test que falla** (agregar en `src/server/notifications/rules.test.ts`, dentro del `describe` de `renderNotification`, junto a los demás casos que usan `base`)

```ts
it("exercise_promoted: promovido y sinónimo", () => {
  expect(renderNotification("exercise_promoted", { ...base, kind: "promote", exerciseName: "remo hammer", catalogName: "Remo en máquina Hammer" }, "ana")).toMatchObject({
    icon: "📚",
    title: "Tu ejercicio «remo hammer» ahora es parte del catálogo",
    body: "Se llama «Remo en máquina Hammer». Tus rutinas y tu historial ya lo usan.",
    href: "/routines",
  });
  expect(renderNotification("exercise_promoted", { ...base, kind: "alias", exerciseName: "Banca plana", catalogName: "Press de Banca" }, "ana")).toMatchObject({
    title: "Tu ejercicio «Banca plana» ahora es «Press de Banca» del catálogo",
    body: "Tus rutinas y tu historial ya lo usan.",
  });
});
```

- [ ] **Step 2: Schema.** En `prisma/schema.prisma`:

En la sección ENUMS, agregar:

```prisma
enum ExerciseCurationStatus {
  pending
  ignored
}

enum ExerciseCurationDecision {
  promote
  alias_of
  skip
}
```

En `enum NotificationType`, agregar **al final** (TiDB solo permite agregar valores de ENUM al final):

```prisma
  exercise_promoted // tu ejercicio propio pasó al catálogo (promovido o sinónimo de uno oficial)
```

En `model Exercise`, después de `createdByUserId`:

```prisma
  curationStatus       ExerciseCurationStatus @default(pending) // curaduría (fase 4 rutinas): solo aplica a los propios
  curationIgnoredUsers Int? // usuarios distintos del grupo al ignorarlo: si crece, el grupo vuelve a aparecer
```

En la sección EJERCICIOS Y RUTINAS, después de `ExerciseMuscle`:

```prisma
// Sugerencia de la IA para un grupo de ejercicios propios (fase 4 rutinas). Se reusa mientras el grupo
// no cambie (`groupHash`); la IA nunca aplica nada sola.
model ExerciseCurationSuggestion {
  id        String                   @id @default(cuid())
  groupKey  String                   @unique @db.VarChar(100)
  groupHash String                   @db.Char(64)
  decision  ExerciseCurationDecision
  payload   Json // CurationSuggestion (src/server/curation/analyze.ts)
  createdAt DateTime                 @default(now())
  updatedAt DateTime                 @updatedAt
}
```

- [ ] **Step 3: Migración**

```bash
npx prisma migrate dev --name exercise_curation
npx prisma generate
```
Pasar los nombres de tabla a PascalCase (el MySQL local tiene `lower_case_table_names=1`) y revisar:

```bash
F=$(ls prisma/migrations/*_exercise_curation/migration.sql)
sed -i '' -E 's/`exercise`/`Exercise`/g; s/`notification`/`Notification`/g; s/`notificationpreference`/`NotificationPreference`/g; s/`exercisecurationsuggestion`/`ExerciseCurationSuggestion`/g' "$F"
cat "$F"
```
Tiene que quedar así (los valores del ENUM de `type` son los actuales + `'exercise_promoted'` al final, en las dos tablas):

```sql
-- AlterTable
ALTER TABLE `Exercise` ADD COLUMN `curationIgnoredUsers` INTEGER NULL,
    ADD COLUMN `curationStatus` ENUM('pending', 'ignored') NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE `Notification` MODIFY `type` ENUM('first_workout_of_week', 'weekly_goal_met', 'streak_milestone', 'badge_level_up', 'rank_overtaken', 'season_started', 'season_results_published', 'new_follower', 'member_joined', 'weekly_digest', 'friend_workout', 'reaction_received', 'exercise_promoted') NOT NULL;

-- AlterTable
ALTER TABLE `NotificationPreference` MODIFY `type` ENUM('first_workout_of_week', 'weekly_goal_met', 'streak_milestone', 'badge_level_up', 'rank_overtaken', 'season_started', 'season_results_published', 'new_follower', 'member_joined', 'weekly_digest', 'friend_workout', 'reaction_received', 'exercise_promoted') NOT NULL;

-- CreateTable
CREATE TABLE `ExerciseCurationSuggestion` (
    `id` VARCHAR(191) NOT NULL,
    `groupKey` VARCHAR(100) NOT NULL,
    `groupHash` CHAR(64) NOT NULL,
    `decision` ENUM('promote', 'alias_of', 'skip') NOT NULL,
    `payload` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExerciseCurationSuggestion_groupKey_key`(`groupKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
(Si la fase 3 todavía no está mergeada y Prisma mete en esta migración cambios de `Exercise.source`, parar: la fase 4 va después de la 3.)

Actualizar el checksum en las DBs locales:

```bash
F=$(ls prisma/migrations/*_exercise_curation/migration.sql); SUM=$(shasum -a 256 "$F" | cut -d' ' -f1); NAME=$(basename $(dirname "$F"))
source <(grep -E '^DATABASE_URL' .env.local | sed -E 's|DATABASE_URL="?mysql://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/([^"?]*).*|U=\1; P=\2; H=\3|')
for db in $(mysql -u"$U" -p"$P" -h"$H" -N -e "SELECT table_schema FROM information_schema.tables WHERE table_name='_prisma_migrations'"); do mysql -u"$U" -p"$P" -h"$H" "$db" -e "UPDATE _prisma_migrations SET checksum='$SUM' WHERE migration_name='$NAME'"; done
npx prisma migrate status   # "Database schema is up to date!"
```

- [ ] **Step 4:** `npm run typecheck` → FAIL en `renderNotification` (el `switch` ya no es exhaustivo). Agregar el caso en `src/server/notifications/rules.ts`, antes de `case "weekly_digest":`

```ts
    case "exercise_promoted": {
      const mine = str(data.exerciseName) ?? "tu ejercicio";
      const official = str(data.catalogName) ?? mine;
      const body = "Tus rutinas y tu historial ya lo usan.";
      if (data.kind === "alias") {
        return { icon: "📚", title: `Tu ejercicio «${mine}» ahora es «${official}» del catálogo`, body, href: "/routines", emphasis: [mine, official] };
      }
      return {
        icon: "📚",
        title: `Tu ejercicio «${mine}» ahora es parte del catálogo`,
        body: official !== mine ? `Se llama «${official}». ${body}` : body,
        href: "/routines",
        emphasis: [mine],
      };
    }
```

- [ ] **Step 5:** `npm run typecheck && npx vitest run --project unit src/server/notifications/rules.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma src/server/notifications/rules.ts src/server/notifications/rules.test.ts
git commit -m "feat(curation): curation status, AI suggestions table and exercise_promoted notification

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Agrupamiento (`src/server/curation/groups.ts`)

**Files:**
- Create: `src/server/curation/groups.ts`
- Test: `src/server/curation/groups.test.ts`

**Interfaces:**
- Consumes: `normalize`, `levenshteinWithin1` (`src/features/exercises/search.ts`), `prisma`.
- Produces: `CurationExercise`, `CurationGroup`, `CurationGroupView`, `groupExercises(list)`, `visibleGroups(groups)`, `toGroupView(g)`, `loadCurationExercises()`, `loadCurationGroups()`.

- [ ] **Step 1: Tests que fallan**

```ts
// src/server/curation/groups.test.ts
import { describe, expect, it } from "vitest";
import { groupExercises, visibleGroups, type CurationExercise } from "./groups";

const ex = (id: string, name: string, o: Partial<CurationExercise> = {}): CurationExercise => ({
  id, name, nameEn: null, createdByUserId: `u-${id}`, creatorName: null, source: "user",
  equipment: "machine", measureType: "reps", tracksWeight: true, muscles: [], aliases: [],
  curationStatus: "pending", curationIgnoredUsers: null, routineIds: [], activityIds: [], ...o,
});
const ids = (gs: ReturnType<typeof groupExercises>) => gs.map((g) => g.members.map((m) => m.id).sort());

describe("groupExercises", () => {
  it("agrupa por nombre normalizado (mayúsculas, acentos, signos)", () => {
    expect(ids(groupExercises([ex("a", "Remo Hammer"), ex("b", "remo hámmer"), ex("c", "Remo-Hammer!"), ex("d", "Sentadilla búlgara")]))).toEqual([
      ["a", "b", "c"],
      ["d"],
    ]);
  });

  it("une nombres a distancia ≤ 1 (de 5 letras o más), también en cadena", () => {
    const g = groupExercises([ex("a", "Remo Hammer"), ex("b", "Remo Hamer"), ex("c", "Remo Hamr"), ex("d", "Curl"), ex("e", "Curo")]);
    expect(ids(g)).toEqual([["a", "b", "c"], ["d"], ["e"]]);
  });

  it("une por nombre en inglés o alias", () => {
    const g = groupExercises([
      ex("a", "Remo Hammer", { nameEn: "Hammer Row" }),
      ex("b", "hammer row"),
      ex("c", "Remo unilateral", { aliases: ["remo hammer a una mano"] }),
      ex("d", "Remo hammer a una mano"),
    ]);
    expect(ids(g).sort()).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("no une ejercicios distintos con más de una letra de diferencia", () => {
    expect(ids(groupExercises([ex("a", "Press Arnold"), ex("b", "Press Militar")]))).toHaveLength(2);
  });

  it("uso: usuarios distintos, rutinas y entrenamientos sin repetir; ordena por uso", () => {
    const g = groupExercises([
      ex("a", "Remo Hammer", { createdByUserId: "ana", creatorName: "Ana", routineIds: ["r1"], activityIds: ["w1", "w2"], source: "ai" }),
      ex("b", "Remo Hamer", { createdByUserId: "ana", creatorName: "Ana", routineIds: ["r1"], activityIds: ["w2", "w3"] }),
      ex("c", "Vuelos laterales", { createdByUserId: "beto" }),
      ex("d", "vuelos laterales", { createdByUserId: "caro" }),
    ]);
    expect(g.map((x) => [x.key, x.usage])).toEqual([
      ["vuelos laterales", { users: 2, routines: 0, workouts: 0 }],
      ["remo hamer", { users: 1, routines: 1, workouts: 3 }],
    ]);
    expect(g[1]).toMatchObject({ creators: [{ id: "ana", name: "Ana" }], aiCount: 1, names: ["Remo Hamer", "Remo Hammer"] });
  });

  it("key = nombre normalizado más repetido; hash estable sin importar el orden y distinto si cambia el grupo", () => {
    const a = ex("a", "Remo Hammer");
    const b = ex("b", "remo hammer");
    const [g1] = groupExercises([a, b]);
    const [g2] = groupExercises([b, a]);
    expect(g1.key).toBe("remo hammer");
    expect(g1.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(g2.hash).toBe(g1.hash);
    const [g3] = groupExercises([a, b, ex("c", "Remo Hamer")]);
    expect(g3.key).toBe("remo hammer");
    expect(g3.hash).not.toBe(g1.hash);
    const [g4] = groupExercises([a, { ...b, muscles: [{ slug: "espalda", percentage: 100 }] }]);
    expect(g4.hash).not.toBe(g1.hash);
    const [g5] = groupExercises([{ ...a, activityIds: ["w9"] }, b]);
    expect(g5.hash).toBe(g1.hash); // el uso no invalida la sugerencia
  });
});

describe("visibleGroups", () => {
  const ign = (users: number) => ({ curationStatus: "ignored" as const, curationIgnoredUsers: users });

  it("un grupo ignorado se oculta hasta que lo usa otro usuario; una variante del mismo usuario no lo revive", () => {
    const base = [ex("a", "Remo Hammer", { createdByUserId: "ana", ...ign(1) })];
    expect(visibleGroups(groupExercises(base))).toEqual([]);
    expect(visibleGroups(groupExercises([...base, ex("b", "Remo Hamer", { createdByUserId: "ana" })]))).toEqual([]);
    const back = visibleGroups(groupExercises([...base, ex("c", "remo hammer", { createdByUserId: "beto" })]));
    expect(back.map((g) => g.status)).toEqual(["resurfaced"]);
  });

  it("sin ignorados el grupo está pendiente", () => {
    expect(visibleGroups(groupExercises([ex("a", "Remo Hammer")])).map((g) => g.status)).toEqual(["pending"]);
  });
});
```

- [ ] **Step 2:** `npx vitest run --project unit src/server/curation/groups.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementación**

```ts
// src/server/curation/groups.ts
/**
 * Curaduría del catálogo (fase 4 rutinas): agrupa los ejercicios PROPIOS (`createdByUserId != null`) que
 * probablemente son el mismo ejercicio. `groupExercises` es puro; `loadCurationGroups` lee la DB.
 * Sin "server-only": los tests unitarios importan la parte pura (el cliente de Prisma es perezoso).
 */
import { createHash } from "node:crypto";
import { prisma } from "@/src/lib/db";
import { levenshteinWithin1, normalize } from "@/src/features/exercises/search";
import type { Equipment, MeasureType } from "@/src/features/exercises/types";

export type ExerciseSource = "catalog" | "user" | "ai";

export type CurationExercise = {
  id: string;
  name: string;
  nameEn: string | null;
  createdByUserId: string;
  creatorName: string | null;
  source: ExerciseSource;
  equipment: Equipment;
  measureType: MeasureType;
  tracksWeight: boolean;
  muscles: { slug: string; percentage: number }[];
  /** Alias ya normalizados (así se guardan en `ExerciseAlias`). */
  aliases: string[];
  curationStatus: "pending" | "ignored";
  curationIgnoredUsers: number | null;
  /** Rutinas y entrenamientos distintos que lo usan. */
  routineIds: string[];
  activityIds: string[];
};

export type CurationGroup = {
  /** Nombre normalizado más repetido (empate: el menor). Identifica la sugerencia guardada. */
  key: string;
  /** sha256 de los miembros (sin el uso): si cambia, la sugerencia queda desactualizada. */
  hash: string;
  /** Más usados primero. */
  members: CurationExercise[];
  names: string[];
  creators: { id: string; name: string | null }[];
  aiCount: number;
  usage: { users: number; routines: number; workouts: number };
  /** `resurfaced`: estaba ignorado y ahora lo usan más usuarios. */
  status: "pending" | "ignored" | "resurfaced";
};

export type CurationMemberView = Omit<CurationExercise, "routineIds" | "activityIds"> & { routines: number; workouts: number };
export type CurationGroupView = Omit<CurationGroup, "members"> & { members: CurationMemberView[] };

/** Las claves de menos letras solo se unen si son iguales ("curl" ≠ "curo"). */
const MIN_TYPO_LENGTH = 5;

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function keysOf(e: CurationExercise): string[] {
  const keys = [normalize(e.name), e.nameEn ? normalize(e.nameEn) : "", ...e.aliases.map(normalize)];
  return [...new Set(keys.filter(Boolean))];
}

function groupKeyOf(members: CurationExercise[]): string {
  const count = new Map<string, number>();
  for (const m of members) {
    const k = normalize(m.name) || m.id;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]))[0][0].slice(0, 100);
}

function groupHashOf(members: CurationExercise[]): string {
  const lines = members
    .map((m) =>
      [
        m.id,
        m.name,
        m.nameEn ?? "",
        m.equipment,
        m.measureType,
        m.tracksWeight ? "1" : "0",
        [...m.muscles].sort((a, b) => cmp(a.slug, b.slug)).map((x) => `${x.slug}:${x.percentage}`).join(","),
      ].join("|")
    )
    .sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

function statusOf(members: CurationExercise[], users: number): CurationGroup["status"] {
  const ignored = members.filter((m) => m.curationStatus === "ignored");
  if (ignored.length === 0) return "pending";
  const threshold = Math.max(...ignored.map((m) => m.curationIgnoredUsers ?? 0));
  return users > threshold ? "resurfaced" : "ignored";
}

export function groupExercises(list: CurationExercise[]): CurationGroup[] {
  const parent = list.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };

  // 1) Misma clave: nombre normalizado, nombre en inglés o alias.
  const byKey = new Map<string, number>();
  list.forEach((e, i) => {
    for (const k of keysOf(e)) {
      const j = byKey.get(k);
      if (j === undefined) byKey.set(k, i);
      else union(i, j);
    }
  });
  // 2) Claves a distancia de edición ≤ 1 (O(K²) sobre claves distintas; `levenshteinWithin1` corta enseguida).
  const keys = [...byKey.keys()].filter((k) => k.length >= MIN_TYPO_LENGTH);
  for (let a = 0; a < keys.length; a++) {
    for (let b = a + 1; b < keys.length; b++) {
      if (levenshteinWithin1(keys[a], keys[b])) union(byKey.get(keys[a])!, byKey.get(keys[b])!);
    }
  }

  const buckets = new Map<number, CurationExercise[]>();
  list.forEach((e, i) => {
    const r = find(i);
    buckets.set(r, [...(buckets.get(r) ?? []), e]);
  });

  const groups: CurationGroup[] = [...buckets.values()].map((raw) => {
    const members = [...raw].sort(
      (a, b) => b.routineIds.length + b.activityIds.length - (a.routineIds.length + a.activityIds.length) || cmp(a.name, b.name) || cmp(a.id, b.id)
    );
    const users = new Set(members.map((m) => m.createdByUserId)).size;
    return {
      key: groupKeyOf(members),
      hash: groupHashOf(members),
      members,
      names: [...new Set(members.map((m) => m.name))].sort(cmp),
      creators: [...new Map(members.map((m) => [m.createdByUserId, { id: m.createdByUserId, name: m.creatorName }])).values()],
      aiCount: members.filter((m) => m.source === "ai").length,
      usage: {
        users,
        routines: new Set(members.flatMap((m) => m.routineIds)).size,
        workouts: new Set(members.flatMap((m) => m.activityIds)).size,
      },
      status: statusOf(members, users),
    };
  });

  return groups.sort(
    (a, b) => b.usage.users - a.usage.users || b.usage.routines - a.usage.routines || b.usage.workouts - a.usage.workouts || cmp(a.key, b.key)
  );
}

/** Lo que se muestra: pendientes y los ignorados que volvieron porque los usan más usuarios. */
export function visibleGroups<G extends Pick<CurationGroup, "status">>(groups: G[]): G[] {
  return groups.filter((g) => g.status !== "ignored");
}

/** Versión liviana para el cliente: conteos en vez de listas de ids. */
export function toGroupView(g: CurationGroup): CurationGroupView {
  return {
    ...g,
    members: g.members.map(({ routineIds, activityIds, ...m }) => ({ ...m, routines: routineIds.length, workouts: activityIds.length })),
  };
}

export async function loadCurationExercises(): Promise<CurationExercise[]> {
  const rows = await prisma.exercise.findMany({
    where: { createdByUserId: { not: null } },
    select: {
      id: true,
      name: true,
      nameEn: true,
      createdByUserId: true,
      source: true,
      equipment: true,
      measureType: true,
      tracksWeight: true,
      curationStatus: true,
      curationIgnoredUsers: true,
      createdBy: { select: { name: true } },
      aliases: { select: { alias: true } },
      muscles: { select: { percentage: true, muscle: { select: { slug: true } } } },
      routines: { select: { routineId: true } },
      activities: { select: { activityId: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    nameEn: r.nameEn,
    createdByUserId: r.createdByUserId!,
    creatorName: r.createdBy?.name ?? null,
    source: r.source,
    equipment: r.equipment,
    measureType: r.measureType,
    tracksWeight: r.tracksWeight,
    muscles: r.muscles.map((m) => ({ slug: m.muscle.slug, percentage: m.percentage })),
    aliases: r.aliases.map((a) => a.alias),
    curationStatus: r.curationStatus,
    curationIgnoredUsers: r.curationIgnoredUsers,
    routineIds: [...new Set(r.routines.map((x) => x.routineId))],
    activityIds: [...new Set(r.activities.map((x) => x.activityId))],
  }));
}

export async function loadCurationGroups(): Promise<CurationGroup[]> {
  return groupExercises(await loadCurationExercises());
}
```

- [ ] **Step 4:** `npx vitest run --project unit src/server/curation/groups.test.ts` → PASS; `npm run typecheck`. (Si un test de agrupamiento falla, revisar la lógica, no el test: son el contrato.)

- [ ] **Step 5: Commit**

```bash
git add src/server/curation/groups.ts src/server/curation/groups.test.ts
git commit -m "feat(curation): group user-created exercises by name, typo and alias, ranked by usage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Respuesta de la IA: prompt, JSON Schema estricto y validación (puro)

**Files:**
- Create: `src/schemas/curation.ts`
- Create: `src/server/curation/analyze.ts` (parte pura; la Task 5 agrega la parte con DB)
- Create: `src/server/curation/__fixtures__/ai-responses.ts`
- Test: `src/server/curation/analyze.test.ts`

**Interfaces:**
- Consumes: `EQUIPMENT` (`src/features/exercises/types.ts`), `normalize`, `CurationExercise`/`CurationGroup` (Task 3), `AiError`, `JsonSchema` (fase 3).
- Produces: `catalogExerciseDataSchema`, `CatalogExerciseData`, `promoteGroupInputSchema`, `aliasGroupInputSchema`, `ignoreGroupInputSchema` (y sus tipos); `CurationSuggestion`, `CurationAiError`, `CURATION_SYSTEM`, `buildCurationPrompt`, `curationJsonSchema`, `parseCurationResponse`, `normalizePercentages`, `curationErrorMessage`.

- [ ] **Step 1: Schemas de input** (los usan la validación de la IA, `apply.ts` y las acciones)

```ts
// src/schemas/curation.ts
import { z } from "zod";
import { EQUIPMENT } from "@/src/features/exercises/types";

/** Datos del ejercicio oficial que crea "Promover" (sugeridos por la IA y editados por el admin). */
export const catalogExerciseDataSchema = z
  .object({
    name: z.string().trim().min(2, "El nombre es muy corto").max(100, "El nombre es muy largo (máximo 100 letras)"),
    nameEn: z
      .string()
      .trim()
      .max(100, "El nombre en inglés es muy largo")
      .nullable()
      .transform((v) => v || null),
    equipment: z.enum(EQUIPMENT, { error: "Elegí el equipamiento" }),
    measureType: z.enum(["reps", "duration"]),
    tracksWeight: z.boolean(),
    muscles: z
      .array(z.object({ muscleSlug: z.string().min(1).max(60), percentage: z.number().int().min(1).max(100) }))
      .min(1, "Elegí al menos un músculo")
      .max(8, "Máximo 8 músculos"),
    description: z.string().trim().max(1000, "La descripción es muy larga"),
    steps: z.array(z.string().trim().min(3, "Cada paso necesita al menos 3 letras").max(300)).max(5, "Máximo 5 pasos"),
  })
  .superRefine((v, ctx) => {
    const slugs = v.muscles.map((m) => m.muscleSlug);
    if (new Set(slugs).size !== slugs.length) ctx.addIssue({ code: "custom", path: ["muscles"], message: "No repitas músculos" });
    const sum = v.muscles.reduce((s, m) => s + m.percentage, 0);
    if (sum !== 100) ctx.addIssue({ code: "custom", path: ["muscles"], message: `Los porcentajes tienen que sumar 100 % (ahora suman ${sum} %)` });
    if (v.steps.length > 0 && v.steps.length < 3) ctx.addIssue({ code: "custom", path: ["steps"], message: "Poné entre 3 y 5 pasos (o ninguno)" });
  });
export type CatalogExerciseData = z.infer<typeof catalogExerciseDataSchema>;

const exerciseIds = z.array(z.string().min(1).max(64)).min(1, "El grupo está vacío").max(200);
const groupKey = z.string().min(1).max(100);

export const promoteGroupInputSchema = z.object({ groupKey, exerciseIds, data: catalogExerciseDataSchema });
export const aliasGroupInputSchema = z.object({ groupKey, exerciseIds, targetExerciseId: z.string().min(1).max(64) });
export const ignoreGroupInputSchema = z.object({ exerciseIds });
export type PromoteGroupInput = z.infer<typeof promoteGroupInputSchema>;
export type AliasGroupInput = z.infer<typeof aliasGroupInputSchema>;
export type IgnoreGroupInput = z.infer<typeof ignoreGroupInputSchema>;
```

- [ ] **Step 2: Fixtures de respuestas** (lo que devolvería OpenAI con el JSON Schema de abajo)

```ts
// src/server/curation/__fixtures__/ai-responses.ts
export const STEPS = [
  "Sentate con el pecho apoyado en el respaldo.",
  "Tirá de las manijas llevando los codos hacia atrás.",
  "Volvé despacio hasta estirar los brazos.",
  "Evitá: despegar el pecho del apoyo.",
];

export const PROMOTE_OK = {
  decision: "promote",
  promote: {
    name: "  Remo en máquina   Hammer ",
    nameEn: "Hammer Strength Row",
    equipment: "machine",
    measureType: "reps",
    tracksWeight: true,
    muscles: [
      { muscleSlug: "espalda", percentage: 70 },
      { muscleSlug: "biceps", percentage: 20 },
      { muscleSlug: "trapecio", percentage: 20 },
    ],
    description: "Remo sentado en máquina de palancas independientes.",
    steps: STEPS,
  },
  aliasOf: null,
  skipReason: null,
};

/** Un músculo inventado y uno repetido: se descartan / suman y se renormaliza. */
export const PROMOTE_MESSY_MUSCLES = {
  ...PROMOTE_OK,
  promote: { ...PROMOTE_OK.promote, muscles: [{ muscleSlug: "dorsales", percentage: 50 }, { muscleSlug: "espalda", percentage: 30 }, { muscleSlug: "espalda", percentage: 20 }] },
};
export const PROMOTE_MANY_STEPS = { ...PROMOTE_OK, promote: { ...PROMOTE_OK.promote, steps: [...STEPS, "Paso extra uno.", "Paso extra dos."] } };
export const PROMOTE_FEW_STEPS = { ...PROMOTE_OK, promote: { ...PROMOTE_OK.promote, steps: STEPS.slice(0, 2) } };
export const PROMOTE_WITHOUT_DATA = { decision: "promote", promote: null, aliasOf: null, skipReason: null };
export const ALIAS_OK = { decision: "alias_of", promote: null, aliasOf: "press de banca", skipReason: null };
export const ALIAS_INVENTED = { decision: "alias_of", promote: null, aliasOf: "Press banca con cadenas", skipReason: null };
export const SKIP_OK = { decision: "skip", promote: null, aliasOf: null, skipReason: "  Es el nombre de una rutina, no un ejercicio. " };
export const WRONG_SHAPE = { decision: "promote" };
export const WRONG_DECISION = { decision: "merge", promote: null, aliasOf: null, skipReason: null };
```

- [ ] **Step 3: Tests que fallan**

```ts
// src/server/curation/analyze.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildCurationPrompt, curationJsonSchema, normalizePercentages, parseCurationResponse, CurationAiError } from "./analyze";
import * as F from "./__fixtures__/ai-responses";

const CTX = {
  muscleSlugs: ["espalda", "biceps", "trapecio", "pecho"],
  catalog: [
    { id: "c1", name: "Press de Banca" },
    { id: "c2", name: "Sentadillas" },
  ],
};

describe("parseCurationResponse", () => {
  it("promote: limpia el nombre y normaliza los porcentajes a 100", () => {
    expect(parseCurationResponse(F.PROMOTE_OK, CTX)).toEqual({
      decision: "promote",
      data: {
        name: "Remo en máquina Hammer",
        nameEn: "Hammer Strength Row",
        equipment: "machine",
        measureType: "reps",
        tracksWeight: true,
        muscles: [
          { muscleSlug: "espalda", percentage: 64 },
          { muscleSlug: "biceps", percentage: 18 },
          { muscleSlug: "trapecio", percentage: 18 },
        ],
        description: "Remo sentado en máquina de palancas independientes.",
        steps: F.STEPS,
      },
    });
  });

  it("promote: descarta músculos que no existen y suma los repetidos", () => {
    const r = parseCurationResponse(F.PROMOTE_MESSY_MUSCLES, CTX);
    expect(r.decision === "promote" && r.data.muscles).toEqual([{ muscleSlug: "espalda", percentage: 100 }]);
  });

  it("promote: más de 5 pasos se recortan; menos de 3 es inválido", () => {
    const r = parseCurationResponse(F.PROMOTE_MANY_STEPS, CTX);
    expect(r.decision === "promote" && r.data.steps).toHaveLength(5);
    expect(() => parseCurationResponse(F.PROMOTE_FEW_STEPS, CTX)).toThrow(CurationAiError);
    expect(() => parseCurationResponse(F.PROMOTE_WITHOUT_DATA, CTX)).toThrow(CurationAiError);
  });

  it("alias_of: el nombre tiene que existir en el catálogo (se compara normalizado)", () => {
    expect(parseCurationResponse(F.ALIAS_OK, CTX)).toEqual({ decision: "alias_of", target: { id: "c1", name: "Press de Banca" } });
    expect(() => parseCurationResponse(F.ALIAS_INVENTED, CTX)).toThrow(/no está en el catálogo/);
  });

  it("skip: guarda el motivo", () => {
    expect(parseCurationResponse(F.SKIP_OK, CTX)).toEqual({ decision: "skip", reason: "Es el nombre de una rutina, no un ejercicio." });
  });

  it("forma inválida → CurationAiError", () => {
    expect(() => parseCurationResponse(F.WRONG_SHAPE, CTX)).toThrow(CurationAiError);
    expect(() => parseCurationResponse(F.WRONG_DECISION, CTX)).toThrow(CurationAiError);
    expect(() => parseCurationResponse("hola", CTX)).toThrow(CurationAiError);
  });
});

describe("normalizePercentages", () => {
  it("escala a 100 y corrige el redondeo en el mayor", () => {
    expect(normalizePercentages([{ percentage: 20 }, { percentage: 70 }, { percentage: 20 }]).map((m) => m.percentage)).toEqual([64, 18, 18]);
    expect(normalizePercentages([{ percentage: 1 }, { percentage: 1 }, { percentage: 1 }]).map((m) => m.percentage)).toEqual([34, 33, 33]);
    expect(normalizePercentages([])).toEqual([]);
  });
});

describe("curationJsonSchema", () => {
  /** Salida estructurada estricta de OpenAI: todo objeto con additionalProperties:false y todas sus propiedades en required. */
  function assertStrict(node: unknown, path = "$"): void {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "object") {
      expect(n.additionalProperties, path).toBe(false);
      expect([...(n.required as string[])].sort(), path).toEqual(Object.keys(n.properties as object).sort());
    }
    for (const [k, v] of Object.entries(n)) assertStrict(v, `${path}.${k}`);
  }

  it("es estricto y limita los músculos a los slugs reales", () => {
    const s = curationJsonSchema(CTX.muscleSlugs);
    assertStrict(s);
    expect(JSON.stringify(s)).toContain('"enum":["espalda","biceps","trapecio","pecho"]');
  });
});

describe("buildCurationPrompt", () => {
  it("manda nombres, datos y catálogo, pero nunca quién los creó", () => {
    // Un miembro real trae más campos (creador incluido); el prompt no los usa.
    const member = { name: "Remo Hammer", nameEn: null, equipment: "machine" as const, measureType: "reps" as const, tracksWeight: true, muscles: [{ slug: "espalda", percentage: 100 }], creatorName: "Ana Secreta" };
    const p = buildCurationPrompt(
      { members: [member], usage: { users: 3, routines: 4, workouts: 9 } },
      [{ name: "Press de Banca", nameEn: "Bench Press" }],
      [{ slug: "espalda", name: "Espalda" }]
    );
    expect(p).toContain("«Remo Hammer»");
    expect(p).toContain("espalda 100%");
    expect(p).toContain("- Press de Banca (Bench Press)");
    expect(p).toContain("3 usuarios, 4 rutinas, 9 entrenamientos");
    expect(p).not.toContain("Ana");
  });
});
```

- [ ] **Step 4:** `npx vitest run --project unit src/server/curation/analyze.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 5: Implementación (parte pura)**

```ts
// src/server/curation/analyze.ts
/**
 * Curaduría con IA (fase 4 rutinas, R6): a pedido del admin, la LLM sugiere qué hacer con un grupo de
 * ejercicios propios: `promote`, `alias_of` o `skip`. La sugerencia se guarda por grupo y se reusa
 * mientras el grupo no cambie (`groupHash`). La IA nunca aplica nada: eso lo hace el admin (apply.ts).
 */
import { z } from "zod";
import { normalize } from "@/src/features/exercises/search";
import { EQUIPMENT } from "@/src/features/exercises/types";
import { AiError, type AiErrorCode, type JsonSchema } from "@/src/server/ai/openai";
import { catalogExerciseDataSchema, type CatalogExerciseData } from "@/src/schemas/curation";
import type { CurationExercise, CurationGroup } from "./groups";

export type CurationSuggestion =
  | { decision: "promote"; data: CatalogExerciseData }
  | { decision: "alias_of"; target: { id: string; name: string } }
  | { decision: "skip"; reason: string };

/** Respuesta inválida o inutilizable de la IA (mensaje es-AR para el admin). No se guarda. */
export class CurationAiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CurationAiError";
  }
}

/** Los que el dueño tiene que ver en los logs de Vercel (key, saldo, pedido mal armado, caída). */
const LOGGED_AI_CODES: ReadonlySet<AiErrorCode> = new Set(["auth", "quota_exceeded", "bad_request", "unavailable"]);

/**
 * Mensaje mostrable de un error de IA; null si es otro error. Lo ve solo el admin: se muestra el detalle
 * técnico de `AiError` (código y mensaje de la fase 3) para que sepa si es la key, el saldo o un timeout.
 */
export function curationErrorMessage(e: unknown): string | null {
  if (e instanceof CurationAiError) return e.message;
  if (e instanceof AiError) {
    if (LOGGED_AI_CODES.has(e.code)) console.error("[curation-ai]", e.code, e.status ?? "-", e.message);
    return `La IA falló (${e.code}): ${e.message}`;
  }
  return null;
}

export const CURATION_SYSTEM = `Sos el curador del catálogo de ejercicios de El Bravo, una app de gimnasio en español rioplatense.
Te paso un GRUPO de ejercicios que crearon usuarios (nombres parecidos: probablemente son el mismo ejercicio) y el CATÁLOGO oficial.
Elegí UNA decisión:
- "alias_of": el grupo es un ejercicio que YA está en el catálogo con otro nombre. En "aliasOf" poné el nombre EXACTO como figura en el catálogo.
- "promote": es un ejercicio real y útil que no está en el catálogo. Completá "promote": nombre canónico en español (como se dice en un gimnasio argentino, con mayúscula inicial), nombre en inglés, equipamiento, si se mide por repeticiones ("reps") o por tiempo ("duration"), si usa peso, músculos con porcentaje (solo de la lista de slugs, sumando 100), una descripción de una oración y de 3 a 5 pasos cortos en segunda persona (vos); el último empieza con "Evitá:".
- "skip": no es un ejercicio (texto suelto, nombre de rutina, demasiado ambiguo). Explicá el motivo en "skipReason" en una oración.
Los campos que no correspondan a tu decisión van en null.`;

type PromptMember = Pick<CurationExercise, "name" | "nameEn" | "equipment" | "measureType" | "tracksWeight" | "muscles">;

/** Texto del usuario para la LLM. Solo datos de ejercicios: nada que identifique a las personas. */
export function buildCurationPrompt(
  group: { members: PromptMember[]; usage: CurationGroup["usage"] },
  catalog: { name: string; nameEn: string | null }[],
  muscles: { slug: string; name: string }[]
): string {
  return [
    "GRUPO:",
    ...group.members.map(
      (m) =>
        `- «${m.name}»${m.nameEn ? ` (en: ${m.nameEn})` : ""} · ${m.equipment} · ${m.measureType === "duration" ? "por tiempo" : "por repeticiones"}` +
        `${m.tracksWeight ? " · con peso" : ""} · músculos: ${m.muscles.map((x) => `${x.slug} ${x.percentage}%`).join(", ") || "sin cargar"}`
    ),
    `Uso: ${group.usage.users} usuarios, ${group.usage.routines} rutinas, ${group.usage.workouts} entrenamientos.`,
    "",
    `MÚSCULOS (usá estos slugs): ${muscles.map((m) => `${m.slug} (${m.name})`).join(", ")}`,
    "",
    "CATÁLOGO OFICIAL:",
    ...catalog.map((c) => `- ${c.name}${c.nameEn ? ` (${c.nameEn})` : ""}`),
  ].join("\n");
}

/** JSON Schema para la salida estructurada estricta de OpenAI (todo required; lo que no aplica, null). */
export function curationJsonSchema(muscleSlugs: string[]): JsonSchema {
  const nullable = (s: object) => ({ anyOf: [s, { type: "null" }] });
  return {
    type: "object",
    additionalProperties: false,
    required: ["decision", "promote", "aliasOf", "skipReason"],
    properties: {
      decision: { type: "string", enum: ["promote", "alias_of", "skip"] },
      promote: nullable({
        type: "object",
        additionalProperties: false,
        required: ["name", "nameEn", "equipment", "measureType", "tracksWeight", "muscles", "description", "steps"],
        properties: {
          name: { type: "string" },
          nameEn: { type: ["string", "null"] },
          equipment: { type: "string", enum: [...EQUIPMENT] },
          measureType: { type: "string", enum: ["reps", "duration"] },
          tracksWeight: { type: "boolean" },
          muscles: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["muscleSlug", "percentage"],
              properties: { muscleSlug: { type: "string", enum: muscleSlugs }, percentage: { type: "integer" } },
            },
          },
          description: { type: "string" },
          steps: { type: "array", items: { type: "string" } },
        },
      }),
      aliasOf: { type: ["string", "null"], description: "Nombre EXACTO de un ejercicio del catálogo oficial" },
      skipReason: { type: ["string", "null"] },
    },
  };
}

const aiResponseSchema = z.object({
  decision: z.enum(["promote", "alias_of", "skip"]),
  promote: z
    .object({
      name: z.string(),
      nameEn: z.string().nullable(),
      equipment: z.enum(EQUIPMENT),
      measureType: z.enum(["reps", "duration"]),
      tracksWeight: z.boolean(),
      muscles: z.array(z.object({ muscleSlug: z.string(), percentage: z.number() })),
      description: z.string(),
      steps: z.array(z.string()),
    })
    .nullable(),
  aliasOf: z.string().nullable(),
  skipReason: z.string().nullable(),
});

/** Escala a 100 (máximo 8, de mayor a menor) y deja el ajuste de redondeo en el mayor. */
export function normalizePercentages<T extends { percentage: number }>(ms: T[]): T[] {
  const list = [...ms].filter((m) => m.percentage > 0).sort((a, b) => b.percentage - a.percentage).slice(0, 8);
  const total = list.reduce((s, m) => s + m.percentage, 0);
  if (total <= 0) return [];
  const scaled = list.map((m) => ({ ...m, percentage: Math.max(1, Math.round((m.percentage * 100) / total)) }));
  scaled[0].percentage += 100 - scaled.reduce((s, m) => s + m.percentage, 0);
  return scaled;
}

/** Valida la respuesta de la LLM contra la forma, los músculos y el catálogo reales. Lanza `CurationAiError`. */
export function parseCurationResponse(raw: unknown, ctx: { muscleSlugs: string[]; catalog: { id: string; name: string }[] }): CurationSuggestion {
  const r = aiResponseSchema.safeParse(raw);
  if (!r.success) throw new CurationAiError("La IA devolvió una respuesta con otra forma. Probá de nuevo.");
  const v = r.data;

  if (v.decision === "skip") return { decision: "skip", reason: (v.skipReason ?? "").trim().slice(0, 300) || "Sin motivo" };

  if (v.decision === "alias_of") {
    const q = normalize(v.aliasOf ?? "");
    const target = q ? ctx.catalog.find((c) => normalize(c.name) === q) : undefined;
    if (!target) throw new CurationAiError(`La IA propuso «${v.aliasOf ?? ""}», que no está en el catálogo.`);
    return { decision: "alias_of", target: { id: target.id, name: target.name } };
  }

  if (!v.promote) throw new CurationAiError("La IA eligió promover pero no mandó los datos.");
  const known = new Set(ctx.muscleSlugs);
  const summed = new Map<string, number>();
  for (const m of v.promote.muscles) if (known.has(m.muscleSlug)) summed.set(m.muscleSlug, (summed.get(m.muscleSlug) ?? 0) + m.percentage);
  const steps = v.promote.steps.map((s) => s.trim()).filter(Boolean).slice(0, 5);
  if (steps.length < 3) throw new CurationAiError("La IA mandó menos de 3 pasos.");
  const data = catalogExerciseDataSchema.safeParse({
    name: v.promote.name.trim().replace(/\s+/g, " "),
    nameEn: v.promote.nameEn?.trim() || null,
    equipment: v.promote.equipment,
    measureType: v.promote.measureType,
    tracksWeight: v.promote.tracksWeight,
    muscles: normalizePercentages([...summed].map(([muscleSlug, percentage]) => ({ muscleSlug, percentage }))),
    description: v.promote.description.trim().slice(0, 1000),
    steps,
  });
  if (!data.success) throw new CurationAiError(`La IA mandó datos inválidos: ${data.error.issues[0]?.message ?? "revisalos"}.`);
  return { decision: "promote", data: data.data };
}
```
- [ ] **Step 6:** `npx vitest run --project unit src/server/curation/analyze.test.ts` → PASS; `npm run typecheck`.

- [ ] **Step 7: Commit**

```bash
git add src/schemas/curation.ts src/server/curation/analyze.ts src/server/curation/analyze.test.ts src/server/curation/__fixtures__
git commit -m "feat(curation): strict JSON schema, prompt and validation for AI curation suggestions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Analizar y guardar sugerencias (caché por hash)

**Files:**
- Modify: `src/server/curation/analyze.ts`
- Test: `src/server/curation/analyze.int.test.ts`

**Interfaces:**
- Consumes: `AiClient`, `AiError` (fase 3), `loadCurationGroups`, `visibleGroups` (Task 3), `prisma.exerciseCurationSuggestion` (Task 2).
- Produces: `CurationContext`, `loadCurationContext()`, `analyzeGroup(group, ai, ctx?) → { suggestion, cached }`, `SuggestionView`, `loadSuggestions(groups)`, `TopAnalysis`, `analyzeTopGroups(ai, limit = 20)`.

- [ ] **Step 1: Test que falla**

```ts
// src/server/curation/analyze.int.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";

vi.mock("server-only", () => ({}));

import { AiError, type AiClient, type AiJsonRequest } from "@/src/server/ai/openai";
import { loadCurationGroups } from "./groups";
import { analyzeGroup, analyzeTopGroups, CurationAiError, loadSuggestions } from "./analyze";
import { ALIAS_INVENTED, PROMOTE_OK } from "./__fixtures__/ai-responses";

/** Cliente falso: devuelve el JSON como texto, igual que el real (`generateJson`). */
function fakeAi(response: unknown) {
  const generateJson = vi.fn(async (_req: AiJsonRequest) => (typeof response === "string" ? response : JSON.stringify(response)));
  const ai: AiClient = { model: "test", generateJson };
  return { ai, generateJson };
}

async function fixtures() {
  const [ana, beto] = await Promise.all(["Ana", "Beto"].map((name) => prisma.user.create({ data: { email: `${name.toLowerCase()}@t.com`, passwordHash: "x", name } })));
  await prisma.muscle.createMany({
    data: [
      { name: "Espalda", slug: "espalda", groupKey: "back" },
      { name: "Bíceps", slug: "biceps", groupKey: "arms" },
      { name: "Trapecio", slug: "trapecio", groupKey: "back" },
    ],
  });
  await prisma.exercise.create({ data: { slug: "press-de-banca", name: "Press de Banca" } });
  await prisma.exercise.create({ data: { slug: "remo-hammer-ana", name: "Remo Hammer", createdByUserId: ana.id } });
  return { ana, beto };
}

describe("analyzeGroup", () => {
  beforeEach(resetDb);

  it("guarda la sugerencia y la reusa mientras el grupo no cambie", async () => {
    const f = await fixtures();
    const { ai, generateJson } = fakeAi(PROMOTE_OK);
    const [g] = await loadCurationGroups();

    const r1 = await analyzeGroup(g, ai);
    expect(r1).toMatchObject({ cached: false, suggestion: { decision: "promote", data: { name: "Remo en máquina Hammer" } } });
    const call = generateJson.mock.calls[0][0];
    expect(call.schemaName).toBe("exercise_curation");
    expect(call.user).toContain("- Press de Banca");
    expect(call.user).not.toContain("Ana");

    expect(await analyzeGroup(g, ai)).toMatchObject({ cached: true });
    expect(generateJson).toHaveBeenCalledTimes(1);

    // Otro usuario crea el mismo ejercicio: misma key, otro hash → desactualizada y se vuelve a analizar.
    await prisma.exercise.create({ data: { slug: "remo-hammer-beto", name: "remo hammer", createdByUserId: f.beto.id } });
    const [g2] = await loadCurationGroups();
    expect(g2.key).toBe(g.key);
    expect(g2.hash).not.toBe(g.hash);
    expect((await loadSuggestions([g2]))[g2.key]).toMatchObject({ stale: true, suggestion: { decision: "promote" } });
    expect(await analyzeGroup(g2, ai)).toMatchObject({ cached: false });
    expect(generateJson).toHaveBeenCalledTimes(2);
    expect((await loadSuggestions([g2]))[g2.key]).toMatchObject({ stale: false });
    expect(await prisma.exerciseCurationSuggestion.count()).toBe(1);
  });

  it("una respuesta inválida (o que no es JSON) no se guarda", async () => {
    await fixtures();
    const [g] = await loadCurationGroups();
    await expect(analyzeGroup(g, fakeAi(ALIAS_INVENTED).ai)).rejects.toBeInstanceOf(CurationAiError);
    await expect(analyzeGroup(g, fakeAi("{no es json").ai)).rejects.toMatchObject({ name: "AiError", code: "invalid_output" });
    const failing: AiClient = { model: "test", generateJson: async () => { throw new AiError("timeout", "OpenAI no respondió en 30 s"); } };
    await expect(analyzeGroup(g, failing)).rejects.toBeInstanceOf(AiError);
    expect(await prisma.exerciseCurationSuggestion.count()).toBe(0);
  });

  it("analizar los más usados: cuenta analizados, reusados y fallidos", async () => {
    await fixtures();
    const { ai } = fakeAi(PROMOTE_OK);
    expect(await analyzeTopGroups(ai)).toEqual({ analyzed: 1, cached: 0, failed: [] });
    expect(await analyzeTopGroups(ai)).toEqual({ analyzed: 0, cached: 1, failed: [] });
  });
});
```

- [ ] **Step 2:** `npm run test:int -- src/server/curation/analyze.int.test.ts` → FAIL (`analyzeGroup` no existe).

- [ ] **Step 3: Implementación** (agregar a `src/server/curation/analyze.ts`)

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import type { AiClient } from "@/src/server/ai/openai";
import { loadCurationGroups, visibleGroups } from "./groups";

/** Lo que guarda `ExerciseCurationSuggestion.payload` (se revalida al leer: el JSON puede ser viejo). */
const storedSuggestionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("promote"), data: catalogExerciseDataSchema }),
  z.object({ decision: z.literal("alias_of"), target: z.object({ id: z.string(), name: z.string() }) }),
  z.object({ decision: z.literal("skip"), reason: z.string() }),
]);

export type CurationContext = { catalog: { id: string; name: string; nameEn: string | null }[]; muscles: { slug: string; name: string }[] };

/** Catálogo oficial y músculos: para el prompt, la validación y los selectores de la pantalla. */
export async function loadCurationContext(): Promise<CurationContext> {
  const [catalog, muscles] = await Promise.all([
    prisma.exercise.findMany({ where: { createdByUserId: null }, select: { id: true, name: true, nameEn: true }, orderBy: { name: "asc" } }),
    prisma.muscle.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { catalog, muscles };
}

/** Pide (o reusa, si el grupo no cambió) la sugerencia de la IA para un grupo y la guarda. */
export async function analyzeGroup(group: CurationGroup, ai: AiClient, ctx?: CurationContext): Promise<{ suggestion: CurationSuggestion; cached: boolean }> {
  const existing = await prisma.exerciseCurationSuggestion.findUnique({ where: { groupKey: group.key } });
  if (existing && existing.groupHash === group.hash) {
    const stored = storedSuggestionSchema.safeParse(existing.payload);
    if (stored.success) return { suggestion: stored.data, cached: true };
  }
  const c = ctx ?? (await loadCurationContext());
  const muscleSlugs = c.muscles.map((m) => m.slug);
  const text = await ai.generateJson({
    system: CURATION_SYSTEM,
    user: buildCurationPrompt(group, c.catalog, c.muscles),
    schemaName: "exercise_curation",
    schema: curationJsonSchema(muscleSlugs),
    maxOutputTokens: 1200,
  });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AiError("invalid_output", "La IA devolvió algo que no es JSON");
  }
  const suggestion = parseCurationResponse(raw, { muscleSlugs, catalog: c.catalog });
  const payload = suggestion as unknown as Prisma.InputJsonValue;
  await prisma.exerciseCurationSuggestion.upsert({
    where: { groupKey: group.key },
    create: { groupKey: group.key, groupHash: group.hash, decision: suggestion.decision, payload },
    update: { groupHash: group.hash, decision: suggestion.decision, payload },
  });
  return { suggestion, cached: false };
}

export type SuggestionView = { suggestion: CurationSuggestion; stale: boolean; updatedAt: string };

/** Sugerencias guardadas de los grupos visibles; `stale` si el grupo cambió desde que se analizó. */
export async function loadSuggestions(groups: Pick<CurationGroup, "key" | "hash">[]): Promise<Record<string, SuggestionView>> {
  if (groups.length === 0) return {};
  const hashByKey = new Map(groups.map((g) => [g.key, g.hash]));
  const rows = await prisma.exerciseCurationSuggestion.findMany({ where: { groupKey: { in: [...hashByKey.keys()] } } });
  const out: Record<string, SuggestionView> = {};
  for (const r of rows) {
    const s = storedSuggestionSchema.safeParse(r.payload);
    if (s.success) out[r.groupKey] = { suggestion: s.data, stale: r.groupHash !== hashByKey.get(r.groupKey), updatedAt: r.updatedAt.toISOString() };
  }
  return out;
}

export type TopAnalysis = { analyzed: number; cached: number; failed: { key: string; error: string }[] };

const CONCURRENCY = 4;

/** "Analizar los 20 más usados": de a 4 en paralelo; los que ya tienen sugerencia vigente no gastan. */
export async function analyzeTopGroups(ai: AiClient, limit = 20): Promise<TopAnalysis> {
  const groups = visibleGroups(await loadCurationGroups()).slice(0, limit);
  const out: TopAnalysis = { analyzed: 0, cached: 0, failed: [] };
  if (groups.length === 0) return out;
  const ctx = await loadCurationContext();
  for (let i = 0; i < groups.length; i += CONCURRENCY) {
    const chunk = groups.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(chunk.map((g) => analyzeGroup(g, ai, ctx)));
    results.forEach((r, j) => {
      if (r.status === "fulfilled") {
        if (r.value.cached) out.cached++;
        else out.analyzed++;
      } else {
        out.failed.push({ key: chunk[j].key, error: curationErrorMessage(r.reason) ?? "Error inesperado" });
        if (!curationErrorMessage(r.reason)) console.error("[curation] analyze", r.reason);
      }
    });
  }
  return out;
}
```
(Mover los `import` nuevos arriba del archivo, junto a los de la Task 4; el de `openai` se une al existente: `import { AiError, type AiClient, type AiErrorCode, type JsonSchema } from "@/src/server/ai/openai";`.)

- [ ] **Step 4:** `npm run test:int -- src/server/curation/analyze.int.test.ts` → PASS; `npm test -- src/server/curation` (unit) sigue en verde; `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/server/curation/analyze.ts src/server/curation/analyze.int.test.ts
git commit -m "feat(curation): analyze groups with AI on demand, cached until the group changes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Aplicar: promover, sinónimo de X, ignorar

**Files:**
- Create: `src/server/curation/apply.ts`
- Modify: `src/features/exercises/types.ts` (`CURATED_ALIAS_LOCALE`), `prisma/seed/exercises.ts`
- Test: `src/server/curation/apply.int.test.ts`

**Interfaces:**
- Consumes: `PromoteGroupInput`, `AliasGroupInput`, `IgnoreGroupInput` (Task 4), `notify` (`src/server/notifications`), `recomputeUserBadges` (`src/server/badges`), `recomputeSeason` (`src/server/scoring`), `slugify` (`prisma/seed/slugify.ts`), `normalize`.
- Produces: `CurationError`, `ApplyResult`, `promoteGroup(input)`, `aliasGroup(input)`, `ignoreGroup(input) → { ignored }`, `CURATED_ALIAS_LOCALE = "curated"`.

- [ ] **Step 1: Tests que fallan**

```ts
// src/server/curation/apply.int.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";

vi.mock("server-only", () => ({}));
const recompute = vi.hoisted(() => ({
  badges: vi.fn(async (_userId: string) => [] as unknown[]),
  season: vi.fn(async (_seasonId: string) => undefined),
}));
vi.mock("@/src/server/badges", async (orig) => ({ ...(await orig<typeof import("@/src/server/badges")>()), recomputeUserBadges: recompute.badges }));
vi.mock("@/src/server/scoring", async (orig) => ({ ...(await orig<typeof import("@/src/server/scoring")>()), recomputeSeason: recompute.season }));

import { slugify } from "@/prisma/seed/slugify";
import { CURATED_ALIAS_LOCALE } from "@/src/features/exercises/types";
import type { CatalogExerciseData } from "@/src/schemas/curation";
import { loadCurationGroups, visibleGroups } from "./groups";
import { aliasGroup, CurationError, ignoreGroup, promoteGroup } from "./apply";

const STEPS = ["Sentate con el pecho apoyado.", "Tirá llevando los codos atrás.", "Evitá: despegar el pecho."];
const DATA = (name: string): CatalogExerciseData => ({
  name, nameEn: "Hammer Strength Row", equipment: "machine", measureType: "reps", tracksWeight: true,
  muscles: [{ muscleSlug: "espalda", percentage: 80 }, { muscleSlug: "biceps", percentage: 20 }],
  description: "Remo sentado en máquina de palancas.", steps: STEPS,
});

const user = (name: string) => prisma.user.create({ data: { email: `${name.toLowerCase()}@t.com`, passwordHash: "x", name } });
const mine = (userId: string, name: string, extra: { nameEn?: string } = {}) =>
  prisma.exercise.create({ data: { slug: `${slugify(name)}-${Math.random().toString(36).slice(2, 8)}`, name, createdByUserId: userId, ...extra } });

async function fixtures() {
  const [ana, beto] = await Promise.all([user("Ana"), user("Beto")]);
  await prisma.muscle.createMany({
    data: [
      { name: "Espalda", slug: "espalda", groupKey: "back" },
      { name: "Bíceps", slug: "biceps", groupKey: "arms" },
    ],
  });
  const cat = await prisma.activityCategory.create({ data: { slug: "fuerza", name: "Fuerza", usesExercises: true } });
  const banca = await prisma.exercise.create({ data: { slug: "press-de-banca", name: "Press de Banca", aliases: { create: [{ alias: "pecho plano" }] } } });
  const exA = await mine(ana.id, "Remo Hammer");
  const exA2 = await mine(ana.id, "Remo Hamer");
  const exB = await mine(beto.id, "remo hammer", { nameEn: "Hammer Row" });
  // Una rutina con DOS de los ejercicios que se van a fusionar.
  const routine = await prisma.routine.create({
    data: { name: "Espalda", userId: ana.id, exercises: { create: [{ exerciseId: exA.id, position: 0 }, { exerciseId: exA2.id, position: 1 }] } },
  });
  const workout = (userId: string, exerciseId: string) =>
    prisma.activity.create({
      data: {
        userId, activityCategoryId: cat.id, startedAt: new Date("2026-10-20T20:00:00Z"), durationMinutes: 50,
        exercises: { create: [{ exerciseId, position: 0, sets: { create: [{ position: 0, reps: 10, weightKg: 40 }] } }] },
      },
    });
  await workout(ana.id, exA.id);
  await workout(beto.id, exB.id);
  const group = await prisma.group.create({ data: { name: "G" } });
  const season = await prisma.season.create({
    data: { groupId: group.id, name: "T", startDate: new Date("2026-10-01"), endDate: new Date("2026-12-31"), members: { create: [{ userId: ana.id }] } },
  });
  const [g] = visibleGroups(await loadCurationGroups());
  return { ana, beto, banca, exA, exA2, exB, routine, season, g, ids: g.members.map((m) => m.id) };
}

describe("curaduría: aplicar", () => {
  beforeEach(async () => {
    await resetDb();
    vi.clearAllMocks();
  });

  it("promover: crea el oficial, fusiona rutinas e historial, mueve alias, borra los propios, avisa y recalcula", async () => {
    const f = await fixtures();
    expect([...f.ids].sort()).toEqual([f.exA.id, f.exA2.id, f.exB.id].sort());

    const r = await promoteGroup({ groupKey: f.g.key, exerciseIds: f.ids, data: DATA("Remo en máquina Hammer") });
    expect(r).toMatchObject({ applied: true, exerciseName: "Remo en máquina Hammer", merged: 3, notified: 2 });

    const official = await prisma.exercise.findFirstOrThrow({
      where: { createdByUserId: null, name: "Remo en máquina Hammer" },
      include: { aliases: true, muscles: true },
    });
    expect(official).toMatchObject({ slug: "remo-en-maquina-hammer", source: "catalog", equipment: "machine", description: "Remo sentado en máquina de palancas." });
    expect(official.instructions).toEqual({ steps: STEPS, reviewed: false });
    expect(official.muscles).toHaveLength(2);
    expect(official.aliases.map((a) => a.alias).sort()).toEqual(["hammer row", "remo hamer", "remo hammer"]);
    expect(official.aliases.every((a) => a.locale === CURATED_ALIAS_LOCALE)).toBe(true);

    // La rutina que tenía dos de los fusionados conserva las dos posiciones, ahora con el oficial.
    expect(
      await prisma.routineExercise.findMany({ where: { routineId: f.routine.id }, orderBy: { position: "asc" }, select: { position: true, exerciseId: true } })
    ).toEqual([{ position: 0, exerciseId: official.id }, { position: 1, exerciseId: official.id }]);
    expect(await prisma.activityExercise.count({ where: { exerciseId: official.id } })).toBe(2);
    expect(await prisma.activitySet.count()).toBe(2);
    expect(await prisma.exercise.count({ where: { createdByUserId: { not: null } } })).toBe(0);

    const notes = await prisma.notification.findMany({ where: { type: "exercise_promoted" }, select: { recipientId: true, data: true } });
    expect(notes.map((n) => n.recipientId).sort()).toEqual([f.ana.id, f.beto.id].sort());
    expect(notes.find((n) => n.recipientId === f.beto.id)?.data).toMatchObject({ kind: "promote", exerciseName: "remo hammer", catalogName: "Remo en máquina Hammer" });

    expect(new Set(recompute.badges.mock.calls.map((c) => c[0]))).toEqual(new Set([f.ana.id, f.beto.id]));
    expect(recompute.season).toHaveBeenCalledWith(f.season.id);
  });

  it("es idempotente: repetir no duplica ni vuelve a avisar", async () => {
    const f = await fixtures();
    const input = { groupKey: f.g.key, exerciseIds: f.ids, data: DATA("Remo en máquina Hammer") };
    await promoteGroup(input);
    expect(await promoteGroup(input)).toEqual({ applied: false });
    expect(await prisma.exercise.count({ where: { name: "Remo en máquina Hammer" } })).toBe(1);
    expect(await prisma.notification.count()).toBe(2);
  });

  it("el nombre canónico no puede repetir uno oficial ni un sinónimo suyo (y no toca nada)", async () => {
    const f = await fixtures();
    await expect(promoteGroup({ groupKey: f.g.key, exerciseIds: f.ids, data: DATA("press de banca") })).rejects.toBeInstanceOf(CurationError);
    await expect(promoteGroup({ groupKey: f.g.key, exerciseIds: f.ids, data: DATA("Pecho Plano") })).rejects.toThrow(/Press de Banca/);
    expect(await prisma.exercise.count({ where: { createdByUserId: { not: null } } })).toBe(3);
  });

  it("promover también absorbe propios con el mismo nombre que el canónico", async () => {
    const f = await fixtures();
    const carla = await user("Carla");
    await mine(carla.id, "Remo en maquina hammer");
    await promoteGroup({ groupKey: f.g.key, exerciseIds: f.ids, data: DATA("Remo en máquina Hammer") });
    expect(await prisma.exercise.count({ where: { createdByUserId: carla.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { recipientId: carla.id } })).toBe(1);
  });

  it("sinónimo de X: agrega los nombres como alias de X y fusiona igual", async () => {
    const f = await fixtures();
    const r = await aliasGroup({ groupKey: f.g.key, exerciseIds: f.ids, targetExerciseId: f.banca.id });
    expect(r).toMatchObject({ applied: true, exerciseId: f.banca.id, exerciseName: "Press de Banca", merged: 3, notified: 2 });
    const aliases = (await prisma.exerciseAlias.findMany({ where: { exerciseId: f.banca.id }, select: { alias: true } })).map((a) => a.alias).sort();
    expect(aliases).toEqual(["hammer row", "pecho plano", "remo hamer", "remo hammer"]);
    expect(await prisma.routineExercise.count({ where: { exerciseId: f.banca.id } })).toBe(2);
    expect(await prisma.activityExercise.count({ where: { exerciseId: f.banca.id } })).toBe(2);
    expect(await prisma.exercise.count({ where: { createdByUserId: { not: null } } })).toBe(0);
    const note = await prisma.notification.findFirstOrThrow({ where: { recipientId: f.beto.id } });
    expect(note.data).toMatchObject({ kind: "alias", catalogName: "Press de Banca" });
    expect(await aliasGroup({ groupKey: f.g.key, exerciseIds: f.ids, targetExerciseId: f.banca.id })).toEqual({ applied: false });
  });

  it("sinónimo de un ejercicio que no es oficial → error", async () => {
    const f = await fixtures();
    await expect(aliasGroup({ groupKey: f.g.key, exerciseIds: [f.exA.id], targetExerciseId: f.exB.id })).rejects.toBeInstanceOf(CurationError);
  });

  it("ignorar: oculta el grupo hasta que lo usa otro usuario", async () => {
    const f = await fixtures();
    expect(await ignoreGroup({ exerciseIds: f.ids })).toEqual({ ignored: 3 });
    expect(await prisma.exercise.findMany({ where: { id: { in: f.ids } }, select: { curationStatus: true, curationIgnoredUsers: true } })).toEqual(
      Array(3).fill({ curationStatus: "ignored", curationIgnoredUsers: 2 })
    );
    expect(visibleGroups(await loadCurationGroups())).toEqual([]);
    await mine(f.ana.id, "Remo Hamr"); // misma persona, otra variante: sigue oculto
    expect(visibleGroups(await loadCurationGroups())).toEqual([]);
    await mine((await user("Carla")).id, "Remo Hammer");
    expect(visibleGroups(await loadCurationGroups()).map((g) => g.status)).toEqual(["resurfaced"]);
    // Idempotente: repetir deja el mismo estado (no se compara `ignored`: MySQL cuenta solo filas que cambiaron).
    await ignoreGroup({ exerciseIds: f.ids });
    expect(await prisma.exercise.count({ where: { id: { in: f.ids }, curationStatus: "ignored", curationIgnoredUsers: 2 } })).toBe(3);
  });
});
```

- [ ] **Step 2:** `npm run test:int -- src/server/curation/apply.int.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: Constante de alias curados.** En `src/features/exercises/types.ts`, debajo de `GROUP_LABEL`:

```ts
/** `ExerciseAlias.locale` de los alias que agrega la curaduría: el seed no los borra al recargar el catálogo. */
export const CURATED_ALIAS_LOCALE = "curated";
```

Y en `prisma/seed/exercises.ts`: importar `CURATED_ALIAS_LOCALE` desde `"../../src/features/exercises/types"` y, en el `$transaction` final, reemplazar las dos líneas de alias por:

```ts
      prisma.exerciseAlias.deleteMany({ where: { exerciseId: exercise.id, locale: { not: CURATED_ALIAS_LOCALE } } }),
      prisma.exerciseAlias.createMany({ data: aliases, skipDuplicates: true }),
```

- [ ] **Step 4: Implementación**

```ts
// src/server/curation/apply.ts
import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/db";
import { slugify } from "@/prisma/seed/slugify";
import { normalize } from "@/src/features/exercises/search";
import { CURATED_ALIAS_LOCALE } from "@/src/features/exercises/types";
import { recomputeUserBadges } from "@/src/server/badges";
import { notify } from "@/src/server/notifications";
import { recomputeSeason } from "@/src/server/scoring";
import type { AliasGroupInput, IgnoreGroupInput, PromoteGroupInput } from "@/src/schemas/curation";

/**
 * Aplicar una decisión de curaduría (fase 4 rutinas). La dispara SIEMPRE el admin, nunca la IA.
 * Todo en una transacción con las filas bloqueadas (`FOR UPDATE`): dos clicks seguidos se serializan y el
 * segundo ya no encuentra los propios (se borraron) → `{ applied: false }`. Avisos y recálculos, después del commit.
 */

type Tx = Prisma.TransactionClient;
const TX_OPTS = { timeout: 30_000, maxWait: 10_000 };

/** Error de negocio con mensaje para el admin (es-AR). */
export class CurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CurationError";
  }
}

export type ApplyResult = { applied: true; exerciseId: string; exerciseName: string; merged: number; notified: number } | { applied: false };

type Member = { id: string; name: string; nameEn: string | null; createdByUserId: string; aliases: string[] };
type Merged = { official: { id: string; name: string }; members: Member[]; affectedUserIds: string[] };

/** Bloquea y devuelve los propios que siguen existiendo (los ya fusionados no vuelven: idempotencia). */
async function lockMembers(tx: Tx, ids: string[]): Promise<Member[]> {
  if (ids.length === 0) return [];
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM Exercise WHERE id IN (${Prisma.join(ids)}) AND createdByUserId IS NOT NULL FOR UPDATE`;
  if (locked.length === 0) return [];
  const rows = await tx.exercise.findMany({
    where: { id: { in: locked.map((r) => r.id) } },
    select: { id: true, name: true, nameEn: true, createdByUserId: true, aliases: { select: { alias: true } } },
    orderBy: { id: "asc" },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, nameEn: r.nameEn, createdByUserId: r.createdByUserId!, aliases: r.aliases.map((a) => a.alias) }));
}

/**
 * Pasa rutinas e historial de los propios al oficial, le agrega sus nombres como alias y los borra.
 * `RoutineExercise`/`ActivityExercise` no tienen unique por (padre, ejercicio): una rutina con dos de los
 * fusionados queda con el oficial en las dos posiciones (mismas series). Devuelve los dueños de entrenamientos afectados.
 */
async function mergeInto(tx: Tx, official: { id: string; name: string }, members: Member[]): Promise<string[]> {
  const ids = members.map((m) => m.id);
  const affected = await tx.activityExercise.findMany({ where: { exerciseId: { in: ids } }, select: { activity: { select: { userId: true } } } });
  await tx.routineExercise.updateMany({ where: { exerciseId: { in: ids } }, data: { exerciseId: official.id } });
  await tx.activityExercise.updateMany({ where: { exerciseId: { in: ids } }, data: { exerciseId: official.id } });

  const existing = new Set((await tx.exerciseAlias.findMany({ where: { exerciseId: official.id }, select: { alias: true } })).map((a) => a.alias));
  const own = normalize(official.name);
  const aliases = new Set<string>();
  for (const m of members) {
    for (const raw of [m.name, m.nameEn ?? "", ...m.aliases]) {
      const a = normalize(raw).slice(0, 100);
      if (a.length >= 2 && a !== own && !existing.has(a)) aliases.add(a);
    }
  }
  if (aliases.size > 0) {
    await tx.exerciseAlias.createMany({
      data: [...aliases].map((alias) => ({ exerciseId: official.id, alias, locale: CURATED_ALIAS_LOCALE })),
      skipDuplicates: true, // la colación de MySQL compara sin mayúsculas/acentos: el unique (exerciseId, alias) manda
    });
  }
  // Alias y músculos de los propios se borran en cascada.
  await tx.exercise.deleteMany({ where: { id: { in: ids } } });
  return [...new Set(affected.map((a) => a.activity.userId))];
}

async function uniqueSlug(tx: Tx, name: string, exceptId: string): Promise<string> {
  const base = slugify(name).slice(0, 70).replace(/-$/, "") || "ejercicio";
  const taken = new Set(
    (await tx.exercise.findMany({ where: { slug: { startsWith: base }, id: { not: exceptId } }, select: { slug: true } })).map((r) => r.slug)
  );
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    if (!taken.has(slug)) return slug;
  }
}

/** Avisa a cada creador (una vez por fusión) y recalcula insignias y temporadas abiertas de los afectados. Nunca lanza. */
async function afterMerge(r: Merged, kind: "promote" | "alias"): Promise<number> {
  let notified = 0;
  const byCreator = new Map<string, Member[]>();
  for (const m of r.members) byCreator.set(m.createdByUserId, [...(byCreator.get(m.createdByUserId) ?? []), m]);
  for (const [userId, own] of byCreator) {
    try {
      const keys = await notify({
        recipientIds: [userId],
        type: "exercise_promoted",
        data: { kind, exerciseName: own[0].name, catalogName: r.official.name, exerciseCount: own.length },
        dedupeKey: (rid) => `exercise_promoted:${own[0].id}:${rid}`,
      });
      notified += keys.length;
    } catch (e) {
      console.error("[curation] notify", e);
    }
  }
  // Insignias y premios de temporada dependen de los músculos del ejercicio (series por grupo muscular).
  for (const userId of r.affectedUserIds) {
    try {
      await recomputeUserBadges(userId);
    } catch (e) {
      console.error("[curation] badges", userId, e);
    }
  }
  if (r.affectedUserIds.length > 0) {
    const seasons = await prisma.season.findMany({
      where: { finalizedAt: null, members: { some: { userId: { in: r.affectedUserIds }, leftAt: null } } },
      select: { id: true },
    });
    for (const s of seasons) {
      try {
        await recomputeSeason(s.id);
      } catch (e) {
        console.error("[curation] season", s.id, e);
      }
    }
  }
  return notified;
}

/** Promover: crea el oficial con los datos del admin y fusiona el grupo (y los propios homónimos del canónico). */
export async function promoteGroup(input: PromoteGroupInput): Promise<ApplyResult> {
  const d = input.data;
  const name = d.name.trim().replace(/\s+/g, " ");
  const key = normalize(name);

  const merged = await prisma.$transaction(async (tx): Promise<Merged | null> => {
    const homonyms = (await tx.exercise.findMany({ where: { createdByUserId: { not: null }, id: { notIn: input.exerciseIds } }, select: { id: true, name: true } }))
      .filter((e) => normalize(e.name) === key)
      .map((e) => e.id);
    const members = await lockMembers(tx, [...new Set([...input.exerciseIds, ...homonyms])]);
    if (members.length === 0) return null; // ya aplicado

    // MySQL permite varios NULL en @@unique([createdByUserId, name]): la unicidad del catálogo oficial va acá.
    const officials = await tx.exercise.findMany({ where: { createdByUserId: null }, select: { name: true, aliases: { select: { alias: true } } } });
    const clash = officials.find((o) => normalize(o.name) === key || o.aliases.some((a) => a.alias === key));
    if (clash) throw new CurationError(`Ya existe «${clash.name}» en el catálogo (o «${name}» es un sinónimo suyo). Usá «Es sinónimo de».`);

    const muscleRows = await tx.muscle.findMany({ where: { slug: { in: d.muscles.map((m) => m.muscleSlug) } }, select: { id: true, slug: true } });
    if (muscleRows.length !== d.muscles.length) throw new CurationError("Hay músculos que no existen. Recargá la página.");
    const muscleId = new Map(muscleRows.map((m) => [m.slug, m.id]));

    const official = await tx.exercise.create({
      data: {
        slug: `tmp-cur-${randomUUID().slice(0, 12)}`, // el definitivo, cuando ya no existan los propios (Task 6, decisión "Slug")
        name,
        nameEn: d.nameEn,
        description: d.description || null,
        instructions: d.steps.length ? { steps: d.steps, reviewed: false } : Prisma.DbNull,
        equipment: d.equipment,
        measureType: d.measureType,
        tracksWeight: d.tracksWeight,
        createdByUserId: null,
        source: "catalog",
        muscles: { create: d.muscles.map((m) => ({ muscleId: muscleId.get(m.muscleSlug)!, percentage: m.percentage })) },
      },
      select: { id: true, name: true },
    });
    const affectedUserIds = await mergeInto(tx, official, members);
    await tx.exercise.update({ where: { id: official.id }, data: { slug: await uniqueSlug(tx, name, official.id) } });
    await tx.exerciseCurationSuggestion.deleteMany({ where: { groupKey: input.groupKey } });
    return { official, members, affectedUserIds };
  }, TX_OPTS);

  if (!merged) return { applied: false };
  const notified = await afterMerge(merged, "promote");
  return { applied: true, exerciseId: merged.official.id, exerciseName: merged.official.name, merged: merged.members.length, notified };
}

/** Sinónimo de X: los nombres del grupo pasan a ser alias del oficial X y se fusiona igual que al promover. */
export async function aliasGroup(input: AliasGroupInput): Promise<ApplyResult> {
  const merged = await prisma.$transaction(async (tx): Promise<Merged | null> => {
    const official = await tx.exercise.findFirst({ where: { id: input.targetExerciseId, createdByUserId: null }, select: { id: true, name: true } });
    if (!official) throw new CurationError("Ese ejercicio no es del catálogo oficial.");
    const members = await lockMembers(tx, input.exerciseIds);
    if (members.length === 0) return null;
    const affectedUserIds = await mergeInto(tx, official, members);
    await tx.exerciseCurationSuggestion.deleteMany({ where: { groupKey: input.groupKey } });
    return { official, members, affectedUserIds };
  }, TX_OPTS);

  if (!merged) return { applied: false };
  const notified = await afterMerge(merged, "alias");
  return { applied: true, exerciseId: merged.official.id, exerciseName: merged.official.name, merged: merged.members.length, notified };
}

/** Ignorar: el grupo se oculta hasta que lo usen más usuarios que ahora (`curationIgnoredUsers`). Idempotente. */
export async function ignoreGroup(input: IgnoreGroupInput): Promise<{ ignored: number }> {
  return prisma.$transaction(async (tx) => {
    const where = { id: { in: input.exerciseIds }, createdByUserId: { not: null } };
    const members = await tx.exercise.findMany({ where, select: { createdByUserId: true } });
    const users = new Set(members.map((m) => m.createdByUserId)).size;
    const { count } = await tx.exercise.updateMany({ where, data: { curationStatus: "ignored", curationIgnoredUsers: users } });
    return { ignored: count };
  }, TX_OPTS);
}
```

- [ ] **Step 5:** `npm run test:int -- src/server/curation/apply.int.test.ts` → PASS. Correr también `npm run test:int -- src/server/exercises` (el seed y el catálogo siguen bien) y `npm run typecheck`.

- [ ] **Step 6: Commit**

```bash
git add src/server/curation/apply.ts src/server/curation/apply.int.test.ts src/features/exercises/types.ts prisma/seed/exercises.ts
git commit -m "feat(curation): promote / alias / ignore groups, merging routines and history transactionally

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Server Actions de admin

**Files:**
- Create: `src/server/actions/curation.ts`
- Test: `src/server/actions/curation.int.test.ts` (y `auth-coverage.test.ts` lo cubre solo)

**Interfaces:**
- Consumes: `requireAdmin` (Task 1), `getAiClient` (fase 3), `loadCurationGroups` (Task 3), `analyzeGroup`, `analyzeTopGroups`, `curationErrorMessage` (Tasks 4–5), `promoteGroup`, `aliasGroup`, `ignoreGroup`, `CurationError` (Task 6), schemas (Task 4).
- Produces:

```ts
analyzeCurationGroupAction(groupKey: string): Promise<ActionResult<{ suggestion: CurationSuggestion; cached: boolean }>>;
analyzeTopGroupsAction(): Promise<ActionResult<TopAnalysis>>;
promoteGroupAction(input: unknown): Promise<ActionResult<ApplyResult>>;
aliasGroupAction(input: unknown): Promise<ActionResult<ApplyResult>>;
ignoreGroupAction(input: unknown): Promise<ActionResult<{ ignored: number }>>;
```

- [ ] **Step 1: Test que falla**

```ts
// src/server/actions/curation.int.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDb, prisma } from "@/tests/setup/db";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const session = vi.hoisted(() => ({ userId: null as string | null, email: "" }));
vi.mock("@/src/server/auth/dal", async () => {
  const { AuthError } = await import("@/src/server/auth/errors");
  const me = () => {
    if (!session.userId) throw new AuthError("UNAUTHENTICATED");
    return { id: session.userId, email: session.email, name: "Yo", photoUrl: null, timezone: "America/Argentina/Buenos_Aires" };
  };
  return { AuthError, requireUser: vi.fn(async () => me()), requirePageUser: vi.fn(async () => me()) };
});
const ai = vi.hoisted(() => ({ client: null as null | { model: string; generateJson: (req: unknown) => Promise<string> } }));
// Como la fase 3: se reemplaza solo `getAiClient`/`isAiEnabled`; `AiError` sigue siendo la clase real.
vi.mock("@/src/server/ai/openai", async (orig) => ({
  ...(await orig<typeof import("@/src/server/ai/openai")>()),
  getAiClient: () => ai.client,
  isAiEnabled: () => ai.client !== null,
}));

import { PROMOTE_OK } from "@/src/server/curation/__fixtures__/ai-responses";
import { loadCurationGroups } from "@/src/server/curation/groups";
import { aliasGroupAction, analyzeCurationGroupAction, analyzeTopGroupsAction, ignoreGroupAction, promoteGroupAction } from "./curation";

const NOT_FOUND = { ok: false, error: "No encontramos lo que buscabas." };

async function fixtures() {
  const admin = await prisma.user.create({ data: { email: "admin@bravo.test", passwordHash: "x", name: "Admin" } });
  const ana = await prisma.user.create({ data: { email: "ana@t.com", passwordHash: "x", name: "Ana" } });
  await prisma.muscle.createMany({
    data: [
      { name: "Espalda", slug: "espalda", groupKey: "back" },
      { name: "Bíceps", slug: "biceps", groupKey: "arms" },
      { name: "Trapecio", slug: "trapecio", groupKey: "back" },
    ],
  });
  const banca = await prisma.exercise.create({ data: { slug: "press-de-banca", name: "Press de Banca" } });
  const remo = await prisma.exercise.create({ data: { slug: "remo-hammer-x", name: "Remo Hammer", createdByUserId: ana.id } });
  const [g] = await loadCurationGroups();
  return { admin, ana, banca, remo, g };
}

describe("curation actions", () => {
  beforeEach(async () => {
    await resetDb();
    session.userId = null;
    process.env.ADMIN_EMAILS = "Admin@Bravo.test";
    ai.client = null;
  });

  it("un usuario logueado que no es admin recibe «no encontrado» y no cambia nada", async () => {
    const f = await fixtures();
    session.userId = f.ana.id;
    session.email = f.ana.email;
    const input = { groupKey: f.g.key, exerciseIds: [f.remo.id] };
    expect(await analyzeCurationGroupAction(f.g.key)).toEqual(NOT_FOUND);
    expect(await analyzeTopGroupsAction()).toEqual(NOT_FOUND);
    expect(await ignoreGroupAction(input)).toEqual(NOT_FOUND);
    expect(await aliasGroupAction({ ...input, targetExerciseId: f.banca.id })).toEqual(NOT_FOUND);
    expect(await promoteGroupAction({ ...input, data: {} })).toEqual(NOT_FOUND);
    expect(await prisma.exercise.findUniqueOrThrow({ where: { id: f.remo.id }, select: { curationStatus: true } })).toEqual({ curationStatus: "pending" });
  });

  it("admin: sin IA configurada, analizar avisa; con IA simulada guarda la sugerencia y la reusa", async () => {
    const f = await fixtures();
    session.userId = f.admin.id;
    session.email = f.admin.email;
    expect(await analyzeCurationGroupAction(f.g.key)).toEqual({ ok: false, error: "La IA no está configurada (falta OPENAI_API_KEY)." });

    const generateJson = vi.fn(async () => JSON.stringify(PROMOTE_OK));
    ai.client = { model: "test", generateJson };
    const r = await analyzeCurationGroupAction(f.g.key);
    expect(r).toMatchObject({ ok: true, data: { cached: false, suggestion: { decision: "promote" } } });
    expect(await analyzeTopGroupsAction()).toMatchObject({ ok: true, data: { analyzed: 0, cached: 1, failed: [] } });
    expect(generateJson).toHaveBeenCalledTimes(1);
    expect(await analyzeCurationGroupAction("no-existe")).toEqual({ ok: false, error: "Ese grupo ya no existe. Recargá la página." });
  });

  it("admin: promover valida los datos editados y aplica; repetir avisa que ya estaba", async () => {
    const f = await fixtures();
    session.userId = f.admin.id;
    session.email = f.admin.email;
    const base = { groupKey: f.g.key, exerciseIds: [f.remo.id] };
    const data = {
      name: "Remo en máquina Hammer", nameEn: "", equipment: "machine", measureType: "reps", tracksWeight: true,
      muscles: [{ muscleSlug: "espalda", percentage: 60 }], description: "", steps: [],
    };
    const bad = await promoteGroupAction({ ...base, data });
    expect(bad).toMatchObject({ ok: false, fieldErrors: { "data.muscles": ["Los porcentajes tienen que sumar 100 % (ahora suman 60 %)"] } });

    const good = await promoteGroupAction({ ...base, data: { ...data, muscles: [{ muscleSlug: "espalda", percentage: 100 }] } });
    expect(good).toMatchObject({ ok: true, message: "«Remo en máquina Hammer» ya es parte del catálogo: fusionamos 1 ejercicio y avisamos a 1 persona." });
    expect(await prisma.exercise.findFirstOrThrow({ where: { name: "Remo en máquina Hammer" }, select: { nameEn: true, instructions: true } })).toEqual({ nameEn: null, instructions: null });
    expect(await promoteGroupAction({ ...base, data: { ...data, muscles: [{ muscleSlug: "espalda", percentage: 100 }] } })).toMatchObject({
      ok: true,
      message: "Ese grupo ya estaba aplicado.",
    });
  });

  it("admin: un choque con el catálogo vuelve como error legible", async () => {
    const f = await fixtures();
    session.userId = f.admin.id;
    session.email = f.admin.email;
    const r = await promoteGroupAction({
      groupKey: f.g.key, exerciseIds: [f.remo.id],
      data: { name: "Press de banca", nameEn: null, equipment: "barbell", measureType: "reps", tracksWeight: true, muscles: [{ muscleSlug: "espalda", percentage: 100 }], description: "", steps: [] },
    });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("Ya existe «Press de Banca»") });
  });
});
```

- [ ] **Step 2:** `npm run test:int -- src/server/actions/curation.int.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementación**

```ts
// src/server/actions/curation.ts
"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/src/server/auth/admin";
import { fail, ok, parseInput, runAction, type ActionResult } from "@/src/server/http/result";
import { getAiClient } from "@/src/server/ai/openai";
import { loadCurationGroups } from "@/src/server/curation/groups";
import { analyzeGroup, analyzeTopGroups, curationErrorMessage, type CurationSuggestion, type TopAnalysis } from "@/src/server/curation/analyze";
import { aliasGroup, CurationError, ignoreGroup, promoteGroup, type ApplyResult } from "@/src/server/curation/apply";
import { aliasGroupInputSchema, ignoreGroupInputSchema, promoteGroupInputSchema } from "@/src/schemas/curation";

/**
 * Curaduría del catálogo (fase 4 rutinas). Todas exigen admin (`requireAdmin`: sesión primero, después
 * `ADMIN_EMAILS`; si no es admin → "No encontramos lo que buscabas."). La IA solo sugiere: aplicar es explícito.
 */

const PATH = "/admin/ejercicios";
const NO_AI = "La IA no está configurada (falta OPENAI_API_KEY).";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function applyMessage(r: ApplyResult): string {
  if (!r.applied) return "Ese grupo ya estaba aplicado.";
  return `«${r.exerciseName}» ya es parte del catálogo: fusionamos ${plural(r.merged, "ejercicio", "ejercicios")} y avisamos a ${plural(r.notified, "persona", "personas")}.`;
}

/** Errores de negocio de la curaduría → mensaje; el resto sigue a `runAction`. */
async function guarded<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof CurationError) return fail(e.message);
    const msg = curationErrorMessage(e);
    if (msg) return fail(msg);
    throw e;
  }
}

export async function analyzeCurationGroupAction(groupKey: string): Promise<ActionResult<{ suggestion: CurationSuggestion; cached: boolean }>> {
  return runAction(async () => {
    await requireAdmin();
    const key = z.string().min(1).max(100).safeParse(groupKey);
    if (!key.success) return fail("Grupo inválido.");
    const ai = getAiClient();
    if (!ai) return fail(NO_AI);
    const group = (await loadCurationGroups()).find((g) => g.key === key.data);
    if (!group) return fail("Ese grupo ya no existe. Recargá la página.");
    return guarded(async () => {
      const r = await analyzeGroup(group, ai);
      revalidatePath(PATH);
      return ok(r, r.cached ? "Ya estaba analizado: el grupo no cambió." : "Listo: mirá la sugerencia.");
    });
  });
}

export async function analyzeTopGroupsAction(): Promise<ActionResult<TopAnalysis>> {
  return runAction(async () => {
    await requireAdmin();
    const ai = getAiClient();
    if (!ai) return fail(NO_AI);
    const r = await analyzeTopGroups(ai, 20);
    revalidatePath(PATH);
    return ok(r, `Analizados: ${r.analyzed} · ya estaban: ${r.cached}${r.failed.length ? ` · con error: ${r.failed.length}` : ""}`);
  });
}

export async function promoteGroupAction(input: unknown): Promise<ActionResult<ApplyResult>> {
  return runAction(async () => {
    await requireAdmin();
    const parsed = parseInput(promoteGroupInputSchema, input);
    if (!parsed.ok) return parsed.result;
    return guarded(async () => {
      const r = await promoteGroup(parsed.data);
      revalidatePath(PATH);
      return ok(r, applyMessage(r));
    });
  });
}

export async function aliasGroupAction(input: unknown): Promise<ActionResult<ApplyResult>> {
  return runAction(async () => {
    await requireAdmin();
    const parsed = parseInput(aliasGroupInputSchema, input);
    if (!parsed.ok) return parsed.result;
    return guarded(async () => {
      const r = await aliasGroup(parsed.data);
      revalidatePath(PATH);
      return ok(r, applyMessage(r));
    });
  });
}

export async function ignoreGroupAction(input: unknown): Promise<ActionResult<{ ignored: number }>> {
  return runAction(async () => {
    await requireAdmin();
    const parsed = parseInput(ignoreGroupInputSchema, input);
    if (!parsed.ok) return parsed.result;
    const r = await ignoreGroup(parsed.data);
    revalidatePath(PATH);
    return ok(r, "Grupo ignorado: vuelve si lo usan más personas.");
  });
}
```

- [ ] **Step 4:** `npm run test:int -- src/server/actions/curation.int.test.ts` → PASS; `npx vitest run --project unit src/server/actions/auth-coverage.test.ts` → PASS (encuentra `src/server/actions/curation.ts` y cada export devuelve "Tenés que iniciar sesión." sin tocar la DB); `npm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add src/server/actions/curation.ts src/server/actions/curation.int.test.ts
git commit -m "feat(curation): admin-only server actions to analyze, promote, alias and ignore

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Pantalla `/admin/ejercicios`

**Files:**
- Create: `app/admin/ejercicios/page.tsx`
- Create: `src/features/curation/types.ts`, `src/features/curation/CurationScreen.tsx`, `src/features/curation/GroupCard.tsx`, `src/features/curation/PromoteForm.tsx`
- Modify: `app/settings/page.tsx`
- Create: `e2e/admin.spec.ts`

**Interfaces:**
- Consumes: `requireAdminPage`, `isAdmin` (Task 1), `isAiEnabled` (fase 3), `loadCurationGroups`, `visibleGroups`, `toGroupView` (Task 3), `loadSuggestions`, `loadCurationContext` (Task 5), las acciones (Task 7), `EQUIPMENT`, `EQUIPMENT_LABEL`.
- Produces: `CurationScreen({ groups, suggestions, catalog, muscles, aiEnabled })`, `GroupCard`, `PromoteForm({ group, suggestion, muscles, onDone })`, `initialPromoteData(group, suggestion)`.

- [ ] **Step 1: Página**

```tsx
// app/admin/ejercicios/page.tsx
import type { Metadata } from "next";
import { PageHeader } from "@/src/components/ui";
import { requireAdminPage } from "@/src/server/auth/admin";
import { isAiEnabled } from "@/src/server/ai/openai";
import { loadCurationGroups, toGroupView, visibleGroups } from "@/src/server/curation/groups";
import { loadCurationContext, loadSuggestions } from "@/src/server/curation/analyze";
import { CurationScreen } from "@/src/features/curation/CurationScreen";

export const metadata: Metadata = { title: "Curaduría de ejercicios", robots: { index: false, follow: false } };
/** "Analizar los 20 más usados" llama a la IA varias veces (las Server Actions usan el límite de la página). */
export const maxDuration = 300;

export default async function CurationPage() {
  await requireAdminPage();
  const groups = visibleGroups(await loadCurationGroups());
  const [suggestions, ctx] = await Promise.all([loadSuggestions(groups), loadCurationContext()]);
  return (
    <div className="mx-auto max-w-screen-md space-y-4 pb-24">
      <PageHeader
        title="Curaduría de ejercicios"
        subtitle={`${groups.length} ${groups.length === 1 ? "grupo" : "grupos"} de ejercicios creados por usuarios, los más usados primero.`}
        back="/settings"
      />
      <CurationScreen
        groups={groups.map(toGroupView)}
        suggestions={suggestions}
        catalog={ctx.catalog.map(({ id, name }) => ({ id, name }))}
        muscles={ctx.muscles}
        aiEnabled={isAiEnabled()}
      />
    </div>
  );
}
```

- [ ] **Step 2: Tipos del cliente**

```ts
// src/features/curation/types.ts
export type { CurationGroupView, CurationMemberView } from "@/src/server/curation/groups";
export type { CurationSuggestion, SuggestionView } from "@/src/server/curation/analyze";
export type CatalogOption = { id: string; name: string };
export type MuscleOption = { slug: string; name: string };
```

- [ ] **Step 3: `CurationScreen`**

```tsx
// src/features/curation/CurationScreen.tsx
"use client";
import { useTransition } from "react";
import { Button, Card, EmptyState, toastResult } from "@/src/components/ui";
import { analyzeTopGroupsAction } from "@/src/server/actions/curation";
import { GroupCard } from "./GroupCard";
import type { CatalogOption, CurationGroupView, MuscleOption, SuggestionView } from "./types";

/** Curaduría: grupos de ejercicios propios con su uso y la sugerencia de la IA; el admin decide. */
export function CurationScreen({
  groups,
  suggestions,
  catalog,
  muscles,
  aiEnabled,
}: {
  groups: CurationGroupView[];
  suggestions: Record<string, SuggestionView>;
  catalog: CatalogOption[];
  muscles: MuscleOption[];
  aiEnabled: boolean;
}) {
  const [pending, start] = useTransition();
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<span className="text-xl">✨</span>}
        title="No hay nada para curar"
        description="Cuando la gente cree ejercicios propios, van a aparecer acá agrupados por nombre."
      />
    );
  }
  return (
    <div className="space-y-3">
      {aiEnabled ? (
        <Button variant="secondary" fullWidth pending={pending} onClick={() => start(async () => void toastResult(await analyzeTopGroupsAction()))}>
          Analizar con IA los 20 más usados
        </Button>
      ) : (
        <Card className="text-sm text-fg-muted">La IA no está configurada (falta OPENAI_API_KEY): podés promover, marcar sinónimos o ignorar a mano.</Card>
      )}
      <ul className="space-y-3" aria-label="Grupos de ejercicios">
        {groups.map((g) => (
          <li key={g.key}>
            <GroupCard group={g} suggestion={suggestions[g.key] ?? null} catalog={catalog} muscles={muscles} aiEnabled={aiEnabled} />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: `GroupCard`**

```tsx
// src/features/curation/GroupCard.tsx
"use client";
import { useState, useTransition } from "react";
import { Button, Card, Pill, Select, Sheet, toastResult, useConfirm } from "@/src/components/ui";
import { EQUIPMENT_LABEL } from "@/src/features/exercises/types";
import { aliasGroupAction, analyzeCurationGroupAction, ignoreGroupAction } from "@/src/server/actions/curation";
import { PromoteForm } from "./PromoteForm";
import type { CatalogOption, CurationGroupView, MuscleOption, SuggestionView } from "./types";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function GroupCard({
  group,
  suggestion,
  catalog,
  muscles,
  aiEnabled,
}: {
  group: CurationGroupView;
  suggestion: SuggestionView | null;
  catalog: CatalogOption[];
  muscles: MuscleOption[];
  aiEnabled: boolean;
}) {
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [promoting, setPromoting] = useState(false);
  const s = suggestion?.suggestion ?? null;
  const [aliasTarget, setAliasTarget] = useState(s?.decision === "alias_of" ? s.target.id : "");
  const ids = group.members.map((m) => m.id);
  const muscleName = (slug: string) => muscles.find((m) => m.slug === slug)?.name ?? slug;

  const ignore = () =>
    start(async () => {
      const yes = await confirm({ title: "¿Ignorar este grupo?", description: "Deja de aparecer hasta que lo usen más personas.", confirmLabel: "Ignorar" });
      if (yes) toastResult(await ignoreGroupAction({ exerciseIds: ids }));
    });

  const merge = () =>
    start(async () => {
      const target = catalog.find((c) => c.id === aliasTarget);
      if (!target) return;
      const yes = await confirm({
        title: `¿Fusionar en «${target.name}»?`,
        description: `${plural(ids.length, "ejercicio pasa", "ejercicios pasan")} a ser «${target.name}» en rutinas e historial, sus nombres quedan como sinónimos y se avisa a quienes los crearon.`,
        confirmLabel: "Fusionar",
      });
      if (yes) toastResult(await aliasGroupAction({ groupKey: group.key, exerciseIds: ids, targetExerciseId: target.id }));
    });

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-bold">{group.names.join(" · ")}</h2>
        {group.status === "resurfaced" && <Pill tone="gold">Volvió: más usuarios</Pill>}
        {group.aiCount > 0 && <Pill tone="primary">✨ {group.aiCount} con IA</Pill>}
      </div>
      <p className="text-sm text-fg-muted">
        {plural(group.usage.users, "usuario", "usuarios")} · {plural(group.usage.routines, "rutina", "rutinas")} · {plural(group.usage.workouts, "entrenamiento", "entrenamientos")}
      </p>
      <p className="text-xs text-fg-subtle">Creado por: {group.creators.map((c) => c.name ?? "Sin nombre").join(", ")}</p>

      {s && (
        <div className="space-y-1 rounded-xl bg-surface-2 p-3 text-sm">
          <p className="font-semibold">
            Sugerencia de la IA{suggestion?.stale && <span className="font-normal text-fg-muted"> (desactualizada: el grupo cambió)</span>}
          </p>
          {s.decision === "promote" && (
            <p>
              Promover como «{s.data.name}» · {EQUIPMENT_LABEL[s.data.equipment]} · {s.data.muscles.map((m) => `${muscleName(m.muscleSlug)} ${m.percentage} %`).join(", ")}
            </p>
          )}
          {s.decision === "alias_of" && <p>Es sinónimo de «{s.target.name}».</p>}
          {s.decision === "skip" && <p>Ignorar: {s.reason}</p>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {aiEnabled && (
          <Button size="sm" variant="secondary" pending={pending} onClick={() => start(async () => void toastResult(await analyzeCurationGroupAction(group.key)))}>
            Analizar con IA
          </Button>
        )}
        <Button size="sm" onClick={() => setPromoting(true)}>
          Promover…
        </Button>
        <Button size="sm" variant="ghost" pending={pending} onClick={ignore}>
          Ignorar
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Select aria-label={`Es sinónimo de (grupo ${group.key})`} value={aliasTarget} onChange={(e) => setAliasTarget(e.target.value)}>
            <option value="">Es sinónimo de…</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <Button size="sm" variant="secondary" disabled={!aliasTarget} pending={pending} onClick={merge}>
          Fusionar
        </Button>
      </div>

      <Sheet open={promoting} onClose={() => setPromoting(false)} title="Promover al catálogo">
        <PromoteForm group={group} suggestion={s?.decision === "promote" ? s.data : null} muscles={muscles} onDone={() => setPromoting(false)} />
      </Sheet>
    </Card>
  );
}
```

- [ ] **Step 5: `PromoteForm`** (el admin edita los datos sugeridos antes de promover)

```tsx
// src/features/curation/PromoteForm.tsx
"use client";
import { useId, useState, useTransition } from "react";
import { Button, Field, Input, NumberInput, Select, Switch, Textarea, toastResult } from "@/src/components/ui";
import { EQUIPMENT, EQUIPMENT_LABEL, type Equipment } from "@/src/features/exercises/types";
import { promoteGroupAction } from "@/src/server/actions/curation";
import type { CatalogExerciseData } from "@/src/schemas/curation";
import type { CurationGroupView, MuscleOption } from "./types";

/** Datos iniciales: la sugerencia de la IA o, si no hay, el ejercicio más usado del grupo (sin textos). */
export function initialPromoteData(group: CurationGroupView, suggestion: CatalogExerciseData | null): CatalogExerciseData {
  if (suggestion) return suggestion;
  const top = group.members[0];
  return {
    name: top.name,
    nameEn: top.nameEn,
    equipment: top.equipment,
    measureType: top.measureType,
    tracksWeight: top.tracksWeight,
    muscles: top.muscles.map((m) => ({ muscleSlug: m.slug, percentage: m.percentage })),
    description: "",
    steps: [],
  };
}

export function PromoteForm({
  group,
  suggestion,
  muscles,
  onDone,
}: {
  group: CurationGroupView;
  suggestion: CatalogExerciseData | null;
  muscles: MuscleOption[];
  onDone(): void;
}) {
  const id = useId();
  const [d, setD] = useState(() => initialPromoteData(group, suggestion));
  const [stepsText, setStepsText] = useState(() => d.steps.join("\n"));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof CatalogExerciseData>(k: K, v: CatalogExerciseData[K]) => setD((x) => ({ ...x, [k]: v }));
  const setMuscle = (i: number, patch: Partial<CatalogExerciseData["muscles"][number]>) =>
    set("muscles", d.muscles.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const total = d.muscles.reduce((s, m) => s + m.percentage, 0);
  const err = (k: string) => Object.entries(errors).find(([key]) => key === `data.${k}` || key.startsWith(`data.${k}.`))?.[1][0] ?? null;

  const submit = () =>
    start(async () => {
      const data = { ...d, nameEn: d.nameEn?.trim() || null, steps: stepsText.split("\n").map((x) => x.trim()).filter(Boolean) };
      const r = await promoteGroupAction({ groupKey: group.key, exerciseIds: group.members.map((m) => m.id), data });
      setErrors(r.ok ? {} : (r.fieldErrors ?? {}));
      if (toastResult(r)) onDone();
    });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="text-sm text-fg-muted">
        Se crea el ejercicio oficial y se fusionan {group.members.length} ejercicios propios: sus rutinas e historial pasan al oficial y se avisa a quienes los
        crearon. Los textos quedan «en revisión».
      </p>
      <Field label="Nombre" htmlFor={`${id}-name`} error={err("name")}>
        <Input value={d.name} onChange={(e) => set("name", e.target.value)} />
      </Field>
      <Field label="Nombre en inglés" htmlFor={`${id}-en`} hint="Opcional." error={err("nameEn")}>
        <Input value={d.nameEn ?? ""} onChange={(e) => set("nameEn", e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Equipamiento" htmlFor={`${id}-eq`}>
          <Select value={d.equipment} onChange={(e) => set("equipment", e.target.value as Equipment)}>
            {EQUIPMENT.map((x) => (
              <option key={x} value={x}>
                {EQUIPMENT_LABEL[x]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Se mide por" htmlFor={`${id}-mt`}>
          <Select value={d.measureType} onChange={(e) => set("measureType", e.target.value as "reps" | "duration")}>
            <option value="reps">Repeticiones</option>
            <option value="duration">Tiempo</option>
          </Select>
        </Field>
      </div>
      <Switch checked={d.tracksWeight} onChange={(v) => set("tracksWeight", v)} label="Usa peso" />

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">Músculos (suman {total} %)</legend>
        {d.muscles.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex-1">
              <Select aria-label={`Músculo ${i + 1}`} value={m.muscleSlug} onChange={(e) => setMuscle(i, { muscleSlug: e.target.value })}>
                {muscles.map((o) => (
                  <option key={o.slug} value={o.slug}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </div>
            <NumberInput aria-label={`Porcentaje del músculo ${i + 1}`} value={m.percentage} min={1} max={100} step={5} suffix="%" className="w-28" onChange={(v) => setMuscle(i, { percentage: v ?? 0 })} />
            <Button size="sm" variant="ghost" aria-label={`Quitar músculo ${i + 1}`} onClick={() => set("muscles", d.muscles.filter((_, j) => j !== i))}>
              ✕
            </Button>
          </div>
        ))}
        <Button size="sm" variant="ghost" onClick={() => set("muscles", [...d.muscles, { muscleSlug: muscles[0]?.slug ?? "", percentage: Math.max(1, 100 - total) }])}>
          + Músculo
        </Button>
        {err("muscles") && (
          <p role="alert" className="text-xs text-danger">
            {err("muscles")}
          </p>
        )}
      </fieldset>

      <Field label="Descripción" htmlFor={`${id}-desc`} hint="Una oración." error={err("description")}>
        <Textarea rows={2} value={d.description} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <Field label="Pasos" htmlFor={`${id}-steps`} hint="Uno por renglón, de 3 a 5 (o ninguno). El último empieza con «Evitá:»." error={err("steps")}>
        <Textarea rows={5} value={stepsText} onChange={(e) => setStepsText(e.target.value)} />
      </Field>
      <Button type="submit" fullWidth size="lg" pending={pending}>
        Promover al catálogo
      </Button>
    </form>
  );
}
```
(Revisar que `NumberInput` acepte `className` y `suffix`, y `Button` `aria-label`: si alguna prop no existe, ajustar al componente real, no inventar estilos con hex.)

- [ ] **Step 6: Link en Ajustes (solo admins)** — en `app/settings/page.tsx`, importar `LinkButton` de `@/src/components/ui` e `isAdmin` de `@/src/server/auth/admin`, y debajo de `<SettingsMenu />`:

```tsx
        {isAdmin(user) && (
          <LinkButton href="/admin/ejercicios" variant="secondary" fullWidth>
            Curaduría del catálogo
          </LinkButton>
        )}
```

- [ ] **Step 7: E2E** (el entorno E2E no define `ADMIN_EMAILS` con usuarios E2E: nadie es admin)

```ts
// e2e/admin.spec.ts
import { expect, test } from "@playwright/test";
import { login } from "./fixtures/helpers";

test("un usuario que no es admin ve 404 en la curaduría y no tiene el link en Ajustes", async ({ page }) => {
  await login(page, "tomi");
  await page.goto("/settings");
  await expect(page.getByRole("link", { name: "Curaduría del catálogo" })).toHaveCount(0);
  await page.goto("/admin/ejercicios");
  await expect(page.getByText("No encontramos esta página")).toBeVisible();
});
```

- [ ] **Step 8:** `npm run typecheck && npm run lint && npm run lint:colors` → PASS. Probar a mano con `npm run dev` y `ADMIN_EMAILS=<tu email de dev>` en `.env.local`: crear 2–3 ejercicios propios parecidos con dos usuarios, entrar a `/admin/ejercicios`, ignorar uno, promover otro editando los datos, fusionar otro como sinónimo; ver la notificación en el usuario creador. Con el dev server parado: `npx playwright test e2e/admin.spec.ts` → PASS.

- [ ] **Step 9: Commit**

```bash
git add app/admin app/settings/page.tsx src/features/curation e2e/admin.spec.ts
git commit -m "feat(curation): /admin/ejercicios screen with AI suggestions and editable promote form

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Documentar `ADMIN_EMAILS`

**Files:**
- Modify: `docs/release-v2.md`, `scripts/prod/check-env.mjs`, `.env.example`

- [ ] **Step 1: `.env.example`** — al final:

```bash
# Admins del catálogo (curaduría en /admin/ejercicios): emails separados por coma. Vacío = nadie.
ADMIN_EMAILS=""
```

- [ ] **Step 2: `scripts/prod/check-env.mjs`** — después del bloque de `R2_ENDPOINT` y antes de `if (failed > 0)`:

```js
// Admins del catálogo (fase 4 rutinas): opcional; si está, tiene que ser una lista de emails separados por coma.
if (!env.ADMIN_EMAILS) console.log("· ADMIN_EMAILS: sin configurar (opcional: sin ella nadie entra a /admin/ejercicios)");
else if (env.ADMIN_EMAILS.split(",").map((e) => e.trim()).filter(Boolean).every((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))) console.log("✓ ADMIN_EMAILS");
else {
  failed++;
  console.log("✗ ADMIN_EMAILS: tiene que ser una lista de emails separados por coma");
}
```

- [ ] **Step 3: `docs/release-v2.md`** — en "## 6. Vercel (vos)", paso 2, agregar un ítem:

```md
   - `ADMIN_EMAILS` (opcional): emails separados por coma de quienes curan el catálogo de ejercicios en `/admin/ejercicios` (los demás ven 404). La curaduría con IA necesita además `OPENAI_API_KEY`; sin ella se puede promover, marcar sinónimos e ignorar a mano.
```
y en "## Pendientes conocidos":

```md
- Ejercicios promovidos por la curaduría: viven solo en la base (no en `prisma/seed/data/exercises.json`) y sus textos quedan «en revisión». Los sinónimos que agrega se guardan con `locale = "curated"` y el seed no los borra.
```

- [ ] **Step 4:** `node scripts/prod/check-env.mjs` (si existe `.env.production.local`) → muestra la línea de `ADMIN_EMAILS` sin imprimir valores.

- [ ] **Step 5: Commit**

```bash
git add docs/release-v2.md scripts/prod/check-env.mjs .env.example
git commit -m "docs(release): ADMIN_EMAILS for catalog curation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Gates y publicación (con OK del dueño)

- [ ] **Step 1:** `npm run typecheck && npm run lint && npm run lint:colors && npm test && npm run test:int`; parar el dev server; `npm run test:e2e` → todo verde.
- [ ] **Step 2: Variables (el dueño).** En Vercel → Settings → Environment Variables (Production): `ADMIN_EMAILS` con los emails de los admins; confirmar que `OPENAI_API_KEY` ya está (fase 3). Cargarlas también en `.env.production.local` y correr `node scripts/prod/check-env.mjs`. Claude no ve ni pega los valores.
- [ ] **Step 3:** Pedir OK al dueño. Con el OK: migrar producción **antes** del push y verificar que la base quedó igual al schema.

```bash
export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.production.local | sed -E 's/^DATABASE_URL="?([^"]*)"?$/\1/')"
npx prisma migrate deploy
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code && echo OK
git push origin HEAD:main
```
(La migración es aditiva: columnas con default, una tabla nueva y un valor de ENUM al final. El código publicado antes sigue andando con la base migrada.)
- [ ] **Step 4:** Esperar el deploy (Vercel → Ready); `curl https://elbravo.vercel.app/api/health` → 200. Con un usuario admin: abrir `/admin/ejercicios`; con uno que no lo es: 404. Probar "Analizar con IA" en un grupo (gasta una llamada) y **no** aplicar nada sin revisar con el dueño.

---

## Self-review

- **Cobertura del spec (fase 4):** `isAdmin` por `ADMIN_EMAILS` y 404 para el resto (Task 1, acciones y página en Tasks 7–8) · propios agrupados por `normalize` + distancia ≤ 1 + alias, ordenados por usuarios / rutinas / entrenamientos (Task 3) · por grupo: nombres, creadores, cuántos con IA, uso (Tasks 3, 8) · "Analizar con IA" por grupo y "los 20 más usados", con `promote` (nombre, nameEn, músculos %, equipamiento, tipo, 3–5 pasos) / `alias_of` (nombre exacto verificado contra el catálogo) / `skip` (motivo), guardado en `ExerciseCurationSuggestion` e invalidado si cambia el grupo (Tasks 2, 4, 5) · promover crea el oficial (`createdByUserId = null`, `source = catalog`, textos `reviewed: false`) con los datos editados por el admin, fusiona `RoutineExercise` y `ActivityExercise`, mueve alias, borra los propios, recalcula insignias (y temporadas abiertas), notifica `exercise_promoted` (Tasks 6, 8) · sinónimo de X agrega alias y fusiona igual (Task 6) · ignorar con `curationStatus = ignored`, vuelve si crecen los usuarios (Tasks 3, 6) · todo en transacción, idempotente (Task 6) · migración aditiva con tablas en PascalCase (Task 2) · pruebas: unit de agrupamiento y de validación de la respuesta de la IA con fixtures (Tasks 3, 4), integración de promover / sinónimo / ignorar, caché, acciones y no-admin (Tasks 5–7), E2E del 404 (Task 8); la IA siempre simulada.
- **Desvíos conscientes del spec:** las acciones responden "No encontramos lo que buscabas." (`AuthError("NOT_FOUND")`) en vez de `notFound()`; se recalculan también las temporadas abiertas (los premios dependen de los músculos); "sinónimo de" también notifica; al promover se absorben los propios homónimos del nombre canónico; el seed deja de borrar los alias curados.
- **Consistencia de nombres:** `CurationExercise`/`CurationGroup`/`CurationGroupView` (Task 3) → `analyze.ts` (Tasks 4–5) → `apply.ts` (Task 6) → acciones (Task 7) → UI (Task 8). Inputs `PromoteGroupInput`/`AliasGroupInput`/`IgnoreGroupInput` en `src/schemas/curation.ts`. Cliente de IA según la fase 3 (`generateJson` → texto → `JSON.parse` + Zod).
