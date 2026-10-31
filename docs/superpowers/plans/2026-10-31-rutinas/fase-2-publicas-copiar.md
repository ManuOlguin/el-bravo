# Fase 2 — Rutinas públicas y copiar: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una rutina pueda ser **Pública** (aparece en el perfil, cualquier usuario logueado la ve en `/routines/[id]` y la copia) y que copiar cree una rutina privada del que copia, duplicando los ejercicios propios del autor (o reusando uno suyo con el mismo nombre).

**Architecture:** Columna `Routine.visibility` + origen de la copia (`copiedFromRoutineId` FK `SetNull`, `copiedFromUserName` snapshot). El service suma `getPublicRoutine` (lectura: dueño o pública; si no, `NOT_FOUND`), `listPublicRoutines` (perfil) y `copyRoutine` (una transacción; qué hacer con cada ejercicio lo decide una función pura, `planExerciseCopies`). UI: selector Privada/Pública en el editor, página nueva `/routines/[id]` (hoy **no existe**: da 404 para todos), sección "Rutinas" en el perfil, "Basada en la rutina de X" y link absoluto en "Compartir" solo si es pública.

**Tech Stack:** Next.js 16, React 19, Prisma 7 (MySQL/TiDB), Zod 4, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-31-rutinas-compartibles-ia-design.md` (Fase 2, Pruebas, Migraciones) · Índice e interfaces compartidas: `docs/superpowers/plans/2026-10-31-rutinas/README.md` · Depende de la fase 1 (`fase-1-formato-texto.md`): `routineToText`, `ShareRoutineButton`, `resolvePendingExercises`, `RoutineEditorScreen({ routine?, initial?, pendingExercises? })`, `Exercise @@unique([createdByUserId, name])`.

## Global Constraints

- UI en español rioplatense; colores solo con tokens (sin hex en componentes).
- Visibilidad: `private` (default) | `public`. **Toda lectura de rutina ajena pasa por `visibility = public` y autor activo**; si no, `AuthError("NOT_FOUND")` → 404 en páginas. Nunca 403 (no se revela que existe).
- Editar, borrar, abrir en el editor y entrenar en vivo (`getRoutineForEditor`, `/edit`, `/live`) **siguen siendo solo del dueño**. Para entrenar una rutina ajena hay que copiarla.
- `RoutineInput.visibility` es **opcional**: si no viene, `updateRoutine` **no la cambia** (lo usan `updateRoutineFromWorkout` y la importación de la fase 1 sin mandarla); `createRoutine` usa `private`.
- Copiar: rutina nueva **privada** del que copia; ejercicios del catálogo y propios del que copia se referencian; los propios del autor se reusan (si el que copia ya ve uno con el mismo nombre normalizado) o se duplican como privados suyos (músculos, equipamiento, tipo, nameEn, descripción, instrucciones, alias). Todo en una transacción.
- Copiar una rutina **propia** está permitido ("Duplicar"): nombre `"<nombre> (copia)"`, misma atribución que el original (si el original no era copia, sin "Basada en…").
- El link absoluto se arma con `absoluteUrl(appUrl(), …)` (`src/emails/render.ts` + `src/server/notifications/email.ts`, como `account.ts`), y se pasa a `ShareRoutineButton` **solo si la rutina es pública**.
- Toda Server Action exige sesión (`requireUser`, lo verifica `auth-coverage.test.ts`).

## Decisiones (para el dueño)

1. **`/routines/[id]` hoy no existe** (solo `/routines/[id]/edit` y `/live`; el pie del texto de la fase 1 apunta a un 404). Se crea: el **dueño** ve su rutina (pública o privada) en modo lectura con Empezar / Editar / Compartir / Duplicar; **otro usuario** la ve solo si es pública (si no, 404) con Copiar / Compartir. Sin sesión, `requirePageUser` manda a `/login?next=/routines/<id>` y vuelve.
2. **Copiar una rutina propia = "Duplicar"** (también en el menú ⋯ de la tarjeta).
3. **Ejercicios privados del autor en una rutina pública**: en la vista de lectura se ven nombre, tipo y series (sin botón de info, porque `getExerciseDetail` no se los muestra a otros). Al copiar se duplican con todos sus datos. El editor avisa: "con tus ejercicios propios".
4. **Autor desactivado** (`isActive = false`): sus rutinas públicas dejan de verse y de poder copiarse (igual que su perfil).
5. **Al copiar se reusa cualquier ejercicio visible** del que copia con el mismo nombre normalizado (catálogo o propio), igual que `resolvePendingExercises` de la fase 1.
6. **`ShareRoutineButton` gana una prop opcional `routine`** (la rutina ya cargada). Hace falta porque `getRoutineForEditorAction` es solo del dueño y en la vista de una rutina ajena no se podría armar el texto. Compatible con la interfaz del README (`{ routineId, url }`).
7. **Perfil ajeno sin rutinas públicas**: la sección "Rutinas" no aparece (sin estado vacío). En el propio aparece siempre (todas, con etiqueta Pública/Privada).
8. **Usuarios E2E nuevos**: `vale` (autora) y `juli` (copia). El único usuario del seed que ningún spec usa es `caro`, pero está en el grupo "Bravos E2E" con entrenamientos sembrados; para no acoplar, se agregan dos usuarios propios.

## Archivos

| Archivo | Responsabilidad |
|---|---|
| `prisma/schema.prisma`, `prisma/migrations/*_routine_visibility_copies/` | `RoutineVisibility`, `visibility`, `copiedFromRoutineId`, `copiedFromUserName` |
| `src/schemas/routine.ts` (+ `routine.test.ts`) | `routineVisibilitySchema`, `RoutineInput.visibility?`, campos nuevos de `RoutineForEditor`, `RoutineView` |
| `src/server/routines/service.ts` (+ `service.int.test.ts`) | Visibilidad en create/update, `getPublicRoutine`, `listPublicRoutines`, `RoutineSummary`, `copyRoutine` |
| `src/server/routines/copy-plan.ts` (+ `copy-plan.test.ts`) | Puro: `planExerciseCopies`, `copyRoutineName` |
| `src/server/routines/share-url.ts` | `routineShareUrl(id)` (link absoluto con `APP_URL`) |
| `src/server/actions/routines.ts` | `copyRoutineAction` |
| `src/features/workout/RoutineEditorScreen.tsx` | Selector Privada/Pública, "Basada en…" |
| `src/features/workout/RoutineCard.tsx`, `app/routines/page.tsx` | Etiqueta Pública, "Basada en…", link al detalle, Compartir con `url`, Duplicar |
| `src/features/routines-share/ShareRoutineButton.tsx` | Prop opcional `routine` |
| `src/features/routines-share/CopyRoutineButton.tsx`, `RoutineDetailView.tsx`, `app/routines/[id]/page.tsx` | Página de la rutina (lectura / copiar) |
| `src/features/profile/ProfileRoutines.tsx`, `ProfileView.tsx`, `app/profile/page.tsx`, `app/u/[id]/page.tsx` | Sección "Rutinas" del perfil |
| `e2e/fixtures/seed-e2e.ts`, `e2e/routine-public.spec.ts`, `e2e/visual-smoke.spec.ts` | E2E publicar → ver en perfil → copiar |

---

### Task 1: Migración y schema de visibilidad

**Files:**
- Modify: `prisma/schema.prisma` (enum nuevo + `model Routine`)
- Create: `prisma/migrations/<timestamp>_routine_visibility_copies/migration.sql`
- Modify: `src/schemas/routine.ts`
- Test: `src/schemas/routine.test.ts`

**Interfaces:**
- Produces (Prisma): `enum RoutineVisibility { private public }`; `Routine.visibility`, `Routine.copiedFromRoutineId`, `Routine.copiedFromUserName`, relaciones `copiedFrom` / `copies` (`"RoutineCopies"`).
- Produces (Zod/TS): `ROUTINE_VISIBILITIES`, `routineVisibilitySchema`, `type RoutineVisibility`, `routineInputSchema.visibility` (opcional), `RoutineForEditor.visibility?` / `copiedFromUserName?`, `type RoutineView`.

- [ ] **Step 1: Test que falla** — agregar al `describe("routineInputSchema")` de `src/schemas/routine.test.ts`:

```ts
  it("visibility es opcional y solo acepta privada o pública", () => {
    const base = { name: "Core", exercises: [{ exerciseId: "plank", sets: [set()] }] };
    const none = routineInputSchema.safeParse(base);
    expect(none.success).toBe(true);
    if (none.success) expect(none.data.visibility).toBeUndefined();
    const pub = routineInputSchema.safeParse({ ...base, visibility: "public" });
    expect(pub.success && pub.data.visibility).toBe("public");
    expect(routineInputSchema.safeParse({ ...base, visibility: "friends" }).success).toBe(false);
  });
```

- [ ] **Step 2:** `npx vitest run --project unit src/schemas/routine.test.ts` → FAIL (`visibility` se descarta: `pub.data.visibility` es `undefined`).

- [ ] **Step 3: Zod/tipos** (`src/schemas/routine.ts`) — arriba de `routineInputSchema`:

```ts
export const ROUTINE_VISIBILITIES = ["private", "public"] as const;
export const routineVisibilitySchema = z.enum(ROUTINE_VISIBILITIES);
export type RoutineVisibility = z.infer<typeof routineVisibilitySchema>;
```

en `routineInputSchema` agregar (junto a `notes`; el `newExercises` de la fase 1 queda como está):

```ts
  /** Opcional: si no viene, `updateRoutine` conserva la actual y `createRoutine` usa "private". */
  visibility: routineVisibilitySchema.optional(),
```

en `RoutineForEditor`, después de `notes`:

```ts
  /** Solo los llena el server (`getRoutineForEditor`/`getPublicRoutine`); los borradores (importar) no los tienen. */
  visibility?: RoutineVisibility;
  copiedFromUserName?: string | null;
```

y al final del archivo:

```ts
/** `/routines/[id]`: rutina en modo lectura (propia, o pública de otro). Nunca incluye el email del autor. */
export type RoutineView = RoutineForEditor & {
  visibility: RoutineVisibility;
  copiedFromUserName: string | null;
  owner: { id: string; name: string | null; photoUrl: string | null };
  isOwner: boolean;
};
```

- [ ] **Step 4:** `npx vitest run --project unit src/schemas/routine.test.ts` → PASS.

- [ ] **Step 5: Prisma** — en la sección `// ENUMS` de `prisma/schema.prisma`, después de `enum SetKind { … }`:

```prisma
enum RoutineVisibility {
  private
  public
}
```

y `model Routine` queda:

```prisma
model Routine {
  id         String            @id @default(cuid())
  name       String            @db.VarChar(100)
  notes      String?           @db.Text
  userId     String
  visibility RoutineVisibility @default(private)
  /// Rutina de la que se copió (null si no es copia o si el original se borró).
  copiedFromRoutineId String?
  /// Nombre del autor al momento de copiar: "Basada en la rutina de Juan" aunque el original se borre.
  copiedFromUserName  String? @db.VarChar(80)

  user       User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  copiedFrom Routine?          @relation("RoutineCopies", fields: [copiedFromRoutineId], references: [id], onDelete: SetNull)
  copies     Routine[]         @relation("RoutineCopies")
  activities Activity[]
  exercises  RoutineExercise[]

  createdAt DateTime  @default(now())
  updatedAt DateTime? @updatedAt

  @@index([userId])
  @@index([copiedFromRoutineId])
}
```

- [ ] **Step 6: Migración**

```bash
npx prisma migrate dev --name routine_visibility_copies
npx prisma generate
```

Abrir el `migration.sql` generado y reemplazar `` `routine` `` por `` `Routine` `` en todas las sentencias (incluido el `REFERENCES`). Tiene que quedar así:

```sql
-- AlterTable
ALTER TABLE `Routine` ADD COLUMN `copiedFromRoutineId` VARCHAR(191) NULL,
    ADD COLUMN `copiedFromUserName` VARCHAR(80) NULL,
    ADD COLUMN `visibility` ENUM('private', 'public') NOT NULL DEFAULT 'private';

-- CreateIndex
CREATE INDEX `Routine_copiedFromRoutineId_idx` ON `Routine`(`copiedFromRoutineId`);

-- AddForeignKey
ALTER TABLE `Routine` ADD CONSTRAINT `Routine_copiedFromRoutineId_fkey` FOREIGN KEY (`copiedFromRoutineId`) REFERENCES `Routine`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
```

(El orden de las columnas puede variar; lo importante es PascalCase y las tres sentencias.) Actualizar el checksum en las DBs locales:

```bash
F=$(ls prisma/migrations/*_routine_visibility_copies/migration.sql); SUM=$(shasum -a 256 "$F" | cut -d' ' -f1); NAME=$(basename $(dirname "$F"))
source <(grep -E '^DATABASE_URL' .env.local | sed -E 's|DATABASE_URL="?mysql://([^:]+):([^@]+)@([^:/]+):?([0-9]*)/([^"?]*).*|U=\1; P=\2; H=\3|')
for db in $(mysql -u"$U" -p"$P" -h"$H" -N -e "SELECT table_schema FROM information_schema.tables WHERE table_name='_prisma_migrations'"); do mysql -u"$U" -p"$P" -h"$H" "$db" -e "UPDATE _prisma_migrations SET checksum='$SUM' WHERE migration_name='$NAME'"; done
npx prisma migrate status   # "Database schema is up to date!"
```

- [ ] **Step 7:** `npm run typecheck && npm test` → PASS (los campos nuevos son opcionales: los literales de `RoutineForEditor` de `state.test.ts`, `format.test.ts` de la fase 1 y `app/dev/ui/sections/workout.tsx` siguen compilando).

- [ ] **Step 8: Commit**

```bash
git add prisma src/schemas/routine.ts src/schemas/routine.test.ts
git commit -m "feat(routines): routine visibility and copy origin columns

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Service — visibilidad, lectura pública y listado del perfil

**Files:**
- Modify: `src/server/routines/service.ts`
- Test: `src/server/routines/service.int.test.ts`

**Interfaces:**
- Consumes: `RoutineView`, `RoutineVisibility` (Task 1); `resolvePendingExercises` (fase 1, Task 5).
- Produces:
  - `createRoutine` guarda `input.visibility ?? "private"`; `updateRoutine` solo cambia `visibility` si viene.
  - `getRoutineForEditor` devuelve también `visibility` y `copiedFromUserName`.
  - `getPublicRoutine(viewerId: string, routineId: string): Promise<RoutineView>` — dueño: siempre; otro: solo pública con autor activo; si no, `AuthError("NOT_FOUND")`.
  - `type RoutineSummary = { id; name; exerciseCount; setCount; groupKeys: string[]; visibility: RoutineVisibility; copiedFromUserName: string | null }`; `RoutineListItem = RoutineSummary & { lastUsedAt: Date | null }`.
  - `listPublicRoutines(ownerId: string): Promise<RoutineSummary[]>` (máx. 50, más nuevas primero).

- [ ] **Step 1: Tests que fallan** — en `service.int.test.ts`, sumar `getPublicRoutine, listPublicRoutines` al `import { … } from "./service"` y agregar al final:

```ts
describe("rutinas públicas (fase 2)", () => {
  beforeEach(resetDb);

  const workoutWithBench = (catId: string, routineId: string, benchId: string) => ({
    clientRequestId: "x", activityCategoryId: catId, localDate: "2026-10-31", localTime: "18:00", durationMinutes: 40, routineId,
    exercises: [{ exerciseId: benchId, notes: null, sets: [{ kind: "normal" as const, reps: 10, durationSeconds: null, weightKg: 40, restSeconds: null, completed: true }] }],
  });

  it("se crea privada; la visibilidad se guarda y editar sin mandarla no la cambia", async () => {
    const { user, bench, plank, cat } = await fixtures();
    const { routineId } = await createRoutine(user.id, routineInput(bench.id, plank.id));
    const visibility = async () => (await getRoutineForEditor(user.id, routineId)).visibility;
    expect(await visibility()).toBe("private");
    await updateRoutine(user.id, routineId, { ...routineInput(bench.id, plank.id), visibility: "public" });
    expect(await visibility()).toBe("public");
    await updateRoutine(user.id, routineId, routineInput(bench.id, plank.id));
    expect(await visibility()).toBe("public");
    await updateRoutineFromWorkout(user.id, routineId, workoutWithBench(cat.id, routineId, bench.id));
    expect(await visibility()).toBe("public");
  });

  it("una pública ajena se ve con su autor, pero no se edita, ni se borra, ni se abre en el editor", async () => {
    const { user, other, bench, plank } = await fixtures();
    const { routineId } = await createRoutine(other.id, { ...routineInput(bench.id, plank.id), visibility: "public" });
    const view = await getPublicRoutine(user.id, routineId);
    expect(view).toMatchObject({ id: routineId, name: "Pecho y core", visibility: "public", isOwner: false, copiedFromUserName: null, owner: { id: other.id, name: "B" } });
    expect(view.exercises.map((e) => e.exercise.name)).toEqual(["Plancha", "Press banca"]);
    expect(JSON.stringify(view)).not.toContain("b@b.com");
    await expect(getRoutineForEditor(user.id, routineId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(updateRoutine(user.id, routineId, routineInput(bench.id, plank.id))).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(deleteRoutine(user.id, routineId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await prisma.routine.count()).toBe(1);
  });

  it("IDOR: la privada de otro no se ve (NOT_FOUND, no FORBIDDEN)", async () => {
    const { user, other, bench, plank } = await fixtures();
    const { routineId } = await createRoutine(other.id, routineInput(bench.id, plank.id));
    await expect(getPublicRoutine(user.id, routineId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getPublicRoutine(user.id, "no-existe")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("el dueño ve la suya aunque sea privada; la pública de un usuario desactivado no se ve", async () => {
    const { user, other, bench, plank } = await fixtures();
    const mine = await createRoutine(user.id, routineInput(bench.id, plank.id));
    expect(await getPublicRoutine(user.id, mine.routineId)).toMatchObject({ isOwner: true, visibility: "private", owner: { id: user.id } });
    const theirs = await createRoutine(other.id, { ...routineInput(bench.id, plank.id), visibility: "public" });
    await prisma.user.update({ where: { id: other.id }, data: { isActive: false } });
    await expect(getPublicRoutine(user.id, theirs.routineId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await listPublicRoutines(other.id)).toEqual([]);
  });

  it("listPublicRoutines: solo las públicas de ese dueño, con conteos y sin último uso", async () => {
    const { user, other, bench, plank } = await fixtures();
    await createRoutine(other.id, routineInput(bench.id, plank.id));
    const pub = await createRoutine(other.id, { ...routineInput(bench.id, plank.id), name: "La pública", visibility: "public" });
    await createRoutine(user.id, { ...routineInput(bench.id, plank.id), visibility: "public" });
    expect(await listPublicRoutines(other.id)).toEqual([
      { id: pub.routineId, name: "La pública", exerciseCount: 2, setCount: 5, groupKeys: ["chest", "core"], visibility: "public", copiedFromUserName: null },
    ]);
    expect((await listRoutines(other.id)).map((r) => r.visibility).sort()).toEqual(["private", "public"]);
  });
});
```

- [ ] **Step 2:** `npm run test:int -- src/server/routines/service.int.test.ts` → FAIL (`getPublicRoutine` no existe; `visibility` undefined).

- [ ] **Step 3: create/update** (`src/server/routines/service.ts`). Con la fase 1 ya aplicada, `createRoutine` y `updateRoutine` quedan:

```ts
export async function createRoutine(userId: string, raw: RoutineInput): Promise<{ routineId: string }> {
  const input = routineInputSchema.parse(raw);
  const routineId = await prisma.$transaction(async (tx) => {
    const resolved = await resolvePendingExercises(tx, userId, input);
    await assertExercisesVisible(tx, userId, resolved);
    const r = await tx.routine.create({
      data: { userId, name: resolved.name, notes: resolved.notes ?? null, visibility: resolved.visibility ?? "private" },
      select: { id: true },
    });
    await writeExercises(tx, r.id, resolved);
    return r.id;
  });
  return { routineId };
}

/** Reemplaza nombre, notas, ejercicios y series en una transacción (borrar y recrear). `visibility` solo si viene. */
export async function updateRoutine(userId: string, routineId: string, raw: RoutineInput): Promise<void> {
  const input = routineInputSchema.parse(raw);
  await prisma.$transaction(async (tx) => {
    await assertOwner(tx, userId, routineId);
    const resolved = await resolvePendingExercises(tx, userId, input);
    await assertExercisesVisible(tx, userId, resolved);
    await tx.routineExercise.deleteMany({ where: { routineId } });
    await tx.routine.update({
      where: { id: routineId },
      data: { name: resolved.name, notes: resolved.notes ?? null, ...(resolved.visibility ? { visibility: resolved.visibility } : {}) },
    });
    await writeExercises(tx, routineId, resolved);
  });
}
```

- [ ] **Step 4: Lectura** — reemplazar `getRoutineForEditor` por un include y un mapper compartidos, y agregar `getPublicRoutine`. Importar `RoutineView` de `@/src/schemas/routine`.

```ts
const routineEditorInclude = {
  exercises: {
    orderBy: { position: "asc" },
    include: { exercise: { select: exerciseSummarySelect }, sets: { orderBy: { position: "asc" } } },
  },
} as const;

type RoutineEditorRow = Prisma.RoutineGetPayload<{ include: typeof routineEditorInclude }>;

function toRoutineForEditor(r: RoutineEditorRow): RoutineForEditor {
  return {
    id: r.id,
    name: r.name,
    notes: r.notes,
    visibility: r.visibility,
    copiedFromUserName: r.copiedFromUserName,
    exercises: r.exercises.map((re) => ({
      exercise: toExerciseSummary(re.exercise),
      restSeconds: re.restSeconds,
      notes: re.notes,
      sets: re.sets.map((s) => ({
        kind: s.kind,
        targetReps: s.targetReps,
        targetDurationSeconds: s.targetDurationSeconds,
        targetWeightKg: s.targetWeightKg,
        restSeconds: s.restSeconds,
      })),
    })),
  };
}

/** Solo el dueño (editor, en vivo, "Compartir" desde la tarjeta). */
export async function getRoutineForEditor(userId: string, routineId: string): Promise<RoutineForEditor> {
  const r = await prisma.routine.findUnique({ where: { id: routineId }, include: routineEditorInclude });
  if (!r || r.userId !== userId) throw new AuthError("NOT_FOUND");
  return toRoutineForEditor(r);
}

/**
 * `/routines/[id]` (fase 2): el dueño ve la suya (pública o privada); cualquier otro usuario logueado, solo si es
 * pública y el autor está activo. Si no, `NOT_FOUND` (nunca `FORBIDDEN`: no se revela que existe).
 */
export async function getPublicRoutine(viewerId: string, routineId: string): Promise<RoutineView> {
  const r = await prisma.routine.findUnique({
    where: { id: routineId },
    include: { ...routineEditorInclude, user: { select: { id: true, name: true, photoUrl: true, isActive: true } } },
  });
  const isOwner = r?.userId === viewerId;
  if (!r || (!isOwner && (r.visibility !== "public" || !r.user.isActive))) throw new AuthError("NOT_FOUND");
  return {
    ...toRoutineForEditor(r),
    visibility: r.visibility,
    copiedFromUserName: r.copiedFromUserName,
    owner: { id: r.user.id, name: r.user.name, photoUrl: r.user.photoUrl },
    isOwner,
  };
}
```

- [ ] **Step 5: Listados** — reemplazar `RoutineListItem` y `listRoutines` por:

```ts
const routineSummarySelect = {
  id: true,
  name: true,
  createdAt: true,
  visibility: true,
  copiedFromUserName: true,
  exercises: {
    select: {
      _count: { select: { sets: true } },
      exercise: { select: { muscles: { select: { percentage: true, muscle: { select: { groupKey: true } } } } } },
    },
  },
} as const;

type RoutineSummaryRow = Prisma.RoutineGetPayload<{ select: typeof routineSummarySelect }>;

export type RoutineSummary = {
  id: string;
  name: string;
  exerciseCount: number;
  setCount: number;
  groupKeys: string[];
  visibility: RoutineVisibility;
  copiedFromUserName: string | null;
};

export type RoutineListItem = RoutineSummary & { lastUsedAt: Date | null };

const groupOrder = (k: string) => {
  const i = (GROUP_KEYS as readonly string[]).indexOf(k);
  return i < 0 ? GROUP_KEYS.length : i;
};

function toRoutineSummary(r: RoutineSummaryRow): RoutineSummary {
  const keys = new Set<string>();
  for (const e of r.exercises) {
    const k = primaryGroupKeyOf(e.exercise.muscles.map((m) => ({ percentage: m.percentage, groupKey: m.muscle.groupKey })));
    if (k) keys.add(k);
  }
  return {
    id: r.id,
    name: r.name,
    exerciseCount: r.exercises.length,
    setCount: r.exercises.reduce((n, e) => n + e._count.sets, 0),
    groupKeys: [...keys].sort((a, b) => groupOrder(a) - groupOrder(b) || a.localeCompare(b)),
    visibility: r.visibility,
    copiedFromUserName: r.copiedFromUserName,
  };
}

/** Rutinas del usuario, las usadas más recientemente primero (después las nuevas). */
export async function listRoutines(userId: string): Promise<RoutineListItem[]> {
  const routines = await prisma.routine.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, select: routineSummarySelect });
  if (routines.length === 0) return [];
  const used = await prisma.activity.groupBy({
    by: ["routineId"],
    where: { userId, routineId: { in: routines.map((r) => r.id) } },
    _max: { startedAt: true },
  });
  const lastUsed = new Map(used.map((u) => [u.routineId, u._max.startedAt]));
  return routines
    .map((r) => ({ item: { ...toRoutineSummary(r), lastUsedAt: lastUsed.get(r.id) ?? null }, createdAt: r.createdAt }))
    .sort(
      (a, b) =>
        (b.item.lastUsedAt?.getTime() ?? 0) - (a.item.lastUsedAt?.getTime() ?? 0) || b.createdAt.getTime() - a.createdAt.getTime()
    )
    .map((x) => x.item);
}

/** Sección "Rutinas" de un perfil ajeno: solo las públicas (y nada si el autor está desactivado). Sin último uso. */
export async function listPublicRoutines(ownerId: string): Promise<RoutineSummary[]> {
  const rows = await prisma.routine.findMany({
    where: { userId: ownerId, visibility: "public", user: { isActive: true } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: routineSummarySelect,
  });
  return rows.map(toRoutineSummary);
}
```

Importar `type RoutineVisibility` de `@/src/schemas/routine` (junto a `RoutineForEditor`, `RoutineInput`, `RoutineView`).

- [ ] **Step 6:** `npm run test:int -- src/server/routines/service.int.test.ts` → PASS (incluidos los tests viejos: "lista con conteos…" usa `toMatchObject`). `npm run typecheck` → PASS.

- [ ] **Step 7: Commit**

```bash
git add src/server/routines
git commit -m "feat(routines): routine visibility, public read and public list for profiles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Plan de copia de ejercicios (puro)

**Files:**
- Create: `src/server/routines/copy-plan.ts`
- Test: `src/server/routines/copy-plan.test.ts`

**Interfaces:**
- Consumes: `normalize` (`src/features/exercises/search.ts`).
- Produces:
  - `type CopySourceExercise = { id: string; name: string; createdByUserId: string | null }`
  - `type ExerciseCopyDecision = { kind: "reference"; exerciseId: string } | { kind: "duplicate"; sourceId: string }`
  - `planExerciseCopies(exercises: CopySourceExercise[], copierId: string, copierVisible: { id: string; name: string }[]): Map<string, ExerciseCopyDecision>` (clave: id del ejercicio de la rutina original)
  - `copyRoutineName(name: string, own: boolean): string`

- [ ] **Step 1: Tests que fallan**

```ts
// src/server/routines/copy-plan.test.ts
import { describe, expect, it } from "vitest";
import { copyRoutineName, planExerciseCopies } from "./copy-plan";

const ex = (id: string, name: string, createdByUserId: string | null = null) => ({ id, name, createdByUserId });

describe("planExerciseCopies", () => {
  it("referencia los del catálogo y los propios del que copia", () => {
    const plan = planExerciseCopies([ex("bench", "Press banca"), ex("mine", "Mi remo", "me")], "me", [
      { id: "bench", name: "Press banca" },
      { id: "mine", name: "Mi remo" },
    ]);
    expect(Object.fromEntries(plan)).toEqual({
      bench: { kind: "reference", exerciseId: "bench" },
      mine: { kind: "reference", exerciseId: "mine" },
    });
  });

  it("reusa uno visible del que copia con el mismo nombre normalizado", () => {
    const plan = planExerciseCopies([ex("h", "Remo Hammer", "author")], "me", [{ id: "my-h", name: "remo  hammer" }]);
    expect(plan.get("h")).toEqual({ kind: "reference", exerciseId: "my-h" });
  });

  it("duplica los propios del autor que el que copia no tiene", () => {
    const plan = planExerciseCopies([ex("h", "Remo Hammer", "author")], "me", [{ id: "bench", name: "Press banca" }]);
    expect(plan.get("h")).toEqual({ kind: "duplicate", sourceId: "h" });
  });

  it("dos del autor con el mismo nombre normalizado comparten duplicado; un ejercicio repetido se planea una vez", () => {
    const plan = planExerciseCopies([ex("a", "Remo-Hammer", "author"), ex("b", "remo hammer", "author"), ex("a", "Remo-Hammer", "author")], "me", []);
    expect(plan.size).toBe(2);
    expect(plan.get("a")).toEqual({ kind: "duplicate", sourceId: "a" });
    expect(plan.get("b")).toEqual({ kind: "duplicate", sourceId: "a" });
  });
});

describe("copyRoutineName", () => {
  it("la de otro conserva el nombre; la propia lleva (copia) sin pasarse de 100", () => {
    expect(copyRoutineName("Espalda", false)).toBe("Espalda");
    expect(copyRoutineName("Espalda", true)).toBe("Espalda (copia)");
    const long = copyRoutineName("x".repeat(100), true);
    expect(long).toHaveLength(100);
    expect(long.endsWith(" (copia)")).toBe(true);
  });
});
```

- [ ] **Step 2:** `npx vitest run --project unit src/server/routines/copy-plan.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementación**

```ts
// src/server/routines/copy-plan.ts
/**
 * Qué hacer con cada ejercicio al copiar una rutina (fase 2, decisión R3 del spec). Puro, sin I/O.
 * - Del catálogo oficial o propio del que copia → se referencia tal cual.
 * - Propio de otro (el autor) → si el que copia ya ve uno con el mismo nombre normalizado (catálogo o suyo), se reusa;
 *   si no, se duplica como privado suyo. Dos del autor con el mismo nombre normalizado comparten un único duplicado.
 */
import { normalize } from "@/src/features/exercises/search";

export type CopySourceExercise = { id: string; name: string; createdByUserId: string | null };
export type ExerciseCopyDecision = { kind: "reference"; exerciseId: string } | { kind: "duplicate"; sourceId: string };

export function planExerciseCopies(
  exercises: CopySourceExercise[],
  copierId: string,
  copierVisible: { id: string; name: string }[]
): Map<string, ExerciseCopyDecision> {
  const visibleByName = new Map<string, string>();
  for (const v of copierVisible) {
    const key = normalize(v.name);
    if (!visibleByName.has(key)) visibleByName.set(key, v.id);
  }
  const duplicateByName = new Map<string, string>();
  const plan = new Map<string, ExerciseCopyDecision>();
  for (const e of exercises) {
    if (plan.has(e.id)) continue;
    if (e.createdByUserId === null || e.createdByUserId === copierId) {
      plan.set(e.id, { kind: "reference", exerciseId: e.id });
      continue;
    }
    const key = normalize(e.name);
    const reuse = visibleByName.get(key);
    if (reuse) {
      plan.set(e.id, { kind: "reference", exerciseId: reuse });
      continue;
    }
    const first = duplicateByName.get(key) ?? e.id;
    duplicateByName.set(key, first);
    plan.set(e.id, { kind: "duplicate", sourceId: first });
  }
  return plan;
}

const COPY_SUFFIX = " (copia)";

/** Copiar de otro conserva el nombre; "Duplicar" una propia le agrega " (copia)" (máx. 100 caracteres, como el schema). */
export function copyRoutineName(name: string, own: boolean): string {
  return own ? `${name.slice(0, 100 - COPY_SUFFIX.length)}${COPY_SUFFIX}` : name;
}
```

- [ ] **Step 4:** `npx vitest run --project unit src/server/routines/copy-plan.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/routines/copy-plan.ts src/server/routines/copy-plan.test.ts
git commit -m "feat(routines): pure plan for which exercises to reference, reuse or duplicate on copy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `copyRoutine` (service) y `copyRoutineAction`

**Files:**
- Modify: `src/server/routines/service.ts`, `src/server/actions/routines.ts`
- Test: `src/server/routines/service.int.test.ts`, `src/server/actions/auth-coverage.test.ts` (sin cambios: toma la acción nueva sola)

**Interfaces:**
- Consumes: `planExerciseCopies`, `copyRoutineName` (Task 3); `visibleTo` (`src/server/exercises/catalog.ts`); `slugify` (`prisma/seed/slugify.ts`); `writeExercises` (existente).
- Produces: `copyRoutine(userId: string, routineId: string): Promise<{ routineId: string }>`; `copyRoutineAction(routineId: string): Promise<ActionResult<{ routineId: string }>>`; `privateSlug(name: string): string` (interno del service).

- [ ] **Step 1: Tests que fallan** — sumar `copyRoutine` al import de `./service` y agregar al final de `service.int.test.ts`:

```ts
const oneSet = (o: Partial<RoutineInput["exercises"][number]["sets"][number]> = {}) => ({
  kind: "normal" as const, targetReps: 10, targetDurationSeconds: null, targetWeightKg: null, restSeconds: null, ...o,
});

/** `other` ("B") tiene un ejercicio propio "Remo Hammer" y una rutina pública que lo usa junto con uno del catálogo. */
async function publicFixtures() {
  const base = await fixtures();
  const pectoral = await prisma.muscle.findUniqueOrThrow({ where: { slug: "pectoral" } });
  const hammer = await prisma.exercise.create({
    data: {
      slug: "remo-hammer-b", name: "Remo Hammer", nameEn: "Hammer row", description: "Con el pecho apoyado.",
      instructions: ["Apoyá el pecho", "Tirá con los codos"], equipment: "machine", measureType: "reps", tracksWeight: true,
      createdByUserId: base.other.id,
      muscles: { create: [{ muscleId: pectoral.id, percentage: 100 }] },
      aliases: { create: [{ alias: "remo maquina hammer" }] },
    },
  });
  const { routineId } = await createRoutine(base.other.id, {
    name: "Espalda de B", notes: "al fallo la última", visibility: "public",
    exercises: [
      { exerciseId: base.bench.id, restSeconds: 90, notes: null, sets: [oneSet({ targetReps: 8, targetWeightKg: 60 }), oneSet({ targetReps: 8, targetWeightKg: 60 })] },
      { exerciseId: hammer.id, restSeconds: null, notes: "lento", sets: [oneSet({ kind: "failure", targetReps: 12 })] },
    ],
  });
  return { ...base, pectoral, hammer, publicId: routineId };
}

describe("copiar rutinas (fase 2)", () => {
  beforeEach(resetDb);

  it("copiar una pública ajena: referencia el catálogo, duplica el ejercicio propio del autor y guarda el origen", async () => {
    const { user, bench, hammer, pectoral, publicId } = await publicFixtures();
    const { routineId } = await copyRoutine(user.id, publicId);
    expect(await prisma.routine.findUniqueOrThrow({ where: { id: routineId } })).toMatchObject({
      userId: user.id, name: "Espalda de B", notes: "al fallo la última", visibility: "private",
      copiedFromRoutineId: publicId, copiedFromUserName: "B",
    });
    const r = await getRoutineForEditor(user.id, routineId);
    expect(r.exercises[0].exercise.id).toBe(bench.id);
    const dupId = r.exercises[1].exercise.id;
    expect(dupId).not.toBe(hammer.id);
    const dup = await prisma.exercise.findUniqueOrThrow({ where: { id: dupId }, include: { muscles: true, aliases: true } });
    expect(dup).toMatchObject({
      name: "Remo Hammer", nameEn: "Hammer row", description: "Con el pecho apoyado.", instructions: ["Apoyá el pecho", "Tirá con los codos"],
      equipment: "machine", measureType: "reps", tracksWeight: true, createdByUserId: user.id,
    });
    expect(dup.muscles.map((m) => [m.muscleId, m.percentage])).toEqual([[pectoral.id, 100]]);
    expect(dup.aliases.map((a) => a.alias)).toEqual(["remo maquina hammer"]);
    expect(r.exercises.map((e) => [e.restSeconds, e.notes, e.sets.map((s) => [s.kind, s.targetReps, s.targetWeightKg])])).toEqual([
      [90, null, [["normal", 8, 60], ["normal", 8, 60]]],
      [null, "lento", [["failure", 12, null]]],
    ]);
    // El original no se tocó.
    expect(await prisma.routineExercise.count({ where: { routineId: publicId } })).toBe(2);
  });

  it("si ya tengo uno con el mismo nombre normalizado, lo reusa (no duplica)", async () => {
    const { user, publicId } = await publicFixtures();
    const mine = await prisma.exercise.create({ data: { slug: "mi-remo", name: "remo  hammer", createdByUserId: user.id } });
    const { routineId } = await copyRoutine(user.id, publicId);
    expect((await getRoutineForEditor(user.id, routineId)).exercises[1].exercise.id).toBe(mine.id);
    expect(await prisma.exercise.count({ where: { createdByUserId: user.id } })).toBe(1);
  });

  it("copiar dos veces duplica el ejercicio una sola vez (la segunda reusa el duplicado)", async () => {
    const { user, publicId } = await publicFixtures();
    const a = await copyRoutine(user.id, publicId);
    const b = await copyRoutine(user.id, publicId);
    expect(await prisma.exercise.count({ where: { createdByUserId: user.id } })).toBe(1);
    const ids = async (id: string) => (await getRoutineForEditor(user.id, id)).exercises.map((e) => e.exercise.id);
    expect(await ids(b.routineId)).toEqual(await ids(a.routineId));
  });

  it("IDOR: la privada de otro, una inexistente o la de un autor desactivado no se copian y no dejan nada", async () => {
    const { user, other, bench, plank, publicId } = await publicFixtures();
    const { routineId: privateId } = await createRoutine(other.id, routineInput(bench.id, plank.id));
    await expect(copyRoutine(user.id, privateId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(copyRoutine(user.id, "no-existe")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await prisma.user.update({ where: { id: other.id }, data: { isActive: false } });
    await expect(copyRoutine(user.id, publicId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await prisma.routine.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.exercise.count({ where: { createdByUserId: user.id } })).toBe(0);
  });

  it("duplicar una propia: '(copia)', privada, mismos ejercicios y la misma atribución que el original", async () => {
    const { user, bench, plank, publicId } = await publicFixtures();
    const own = await createRoutine(user.id, { ...routineInput(bench.id, plank.id), visibility: "public" });
    const dup = await copyRoutine(user.id, own.routineId);
    expect(await prisma.routine.findUniqueOrThrow({ where: { id: dup.routineId } })).toMatchObject({
      name: "Pecho y core (copia)", visibility: "private", copiedFromRoutineId: null, copiedFromUserName: null,
    });
    expect((await getRoutineForEditor(user.id, dup.routineId)).exercises.map((e) => e.exercise.id)).toEqual([plank.id, bench.id]);
    // Duplicar una copia conserva "Basada en la rutina de B".
    const copied = await copyRoutine(user.id, publicId);
    const again = await copyRoutine(user.id, copied.routineId);
    expect(await prisma.routine.findUniqueOrThrow({ where: { id: again.routineId } })).toMatchObject({
      name: "Espalda de B (copia)", copiedFromRoutineId: publicId, copiedFromUserName: "B",
    });
  });

  it("borrar la original deja la copia con el nombre del autor y sin link", async () => {
    const { user, other, publicId } = await publicFixtures();
    const { routineId } = await copyRoutine(user.id, publicId);
    await deleteRoutine(other.id, publicId);
    expect(await prisma.routine.findUniqueOrThrow({ where: { id: routineId } })).toMatchObject({ copiedFromRoutineId: null, copiedFromUserName: "B" });
  });
});
```

- [ ] **Step 2:** `npm run test:int -- src/server/routines/service.int.test.ts` → FAIL (`copyRoutine` no existe).

- [ ] **Step 3: Service** — en `src/server/routines/service.ts` agregar los imports:

```ts
import { slugify } from "@/prisma/seed/slugify"; // ya está si la fase 1 lo agregó
import { copyRoutineName, planExerciseCopies } from "./copy-plan";
```

y el código:

```ts
/** Slug de un ejercicio propio: base legible + sufijo aleatorio (el slug es único global; `name` es único por dueño). */
function privateSlug(name: string): string {
  return `${slugify(name).slice(0, 60) || "ejercicio"}-${Math.random().toString(36).slice(2, 8)}`;
}

const copySourceInclude = {
  user: { select: { name: true, isActive: true } },
  exercises: {
    orderBy: { position: "asc" },
    include: {
      sets: { orderBy: { position: "asc" } },
      exercise: {
        select: {
          id: true, name: true, nameEn: true, description: true, instructions: true, mediaUrl: true,
          equipment: true, measureType: true, tracksWeight: true, createdByUserId: true,
          muscles: { select: { muscleId: true, percentage: true } },
          aliases: { select: { alias: true, locale: true } },
        },
      },
    },
  },
} as const;

type CopySourceRow = Prisma.RoutineGetPayload<{ include: typeof copySourceInclude }>;
type CopySourceExerciseRow = CopySourceRow["exercises"][number]["exercise"];

/** Duplica un ejercicio propio del autor como privado de `userId` (músculos, equipamiento, tipo, textos y alias). */
async function duplicateExercise(tx: Tx, userId: string, e: CopySourceExerciseRow): Promise<string> {
  const row = await tx.exercise.create({
    data: {
      slug: privateSlug(e.name),
      name: e.name,
      nameEn: e.nameEn,
      description: e.description,
      instructions: (e.instructions ?? undefined) as Prisma.InputJsonValue | undefined,
      mediaUrl: e.mediaUrl,
      equipment: e.equipment,
      measureType: e.measureType,
      tracksWeight: e.tracksWeight,
      createdByUserId: userId,
      muscles: { create: e.muscles.map((m) => ({ muscleId: m.muscleId, percentage: m.percentage })) },
      aliases: { create: e.aliases.map((a) => ({ alias: a.alias, locale: a.locale })) },
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * "Copiar a mis rutinas" (pública de otro) o "Duplicar" (propia): rutina nueva PRIVADA de `userId` con los mismos
 * ejercicios y series, en una transacción. Ver `planExerciseCopies` para qué se referencia, reusa o duplica.
 * La privada de otro, una inexistente o la de un autor desactivado → `NOT_FOUND`.
 */
export async function copyRoutine(userId: string, routineId: string): Promise<{ routineId: string }> {
  const newId = await prisma.$transaction(
    async (tx) => {
      const src = await tx.routine.findUnique({ where: { id: routineId }, include: copySourceInclude });
      const own = src?.userId === userId;
      if (!src || (!own && (src.visibility !== "public" || !src.user.isActive))) throw new AuthError("NOT_FOUND");

      const visible = await tx.exercise.findMany({ where: visibleTo(userId), select: { id: true, name: true } });
      const plan = planExerciseCopies(src.exercises.map((e) => e.exercise), userId, visible);
      const byId = new Map(src.exercises.map((e) => [e.exercise.id, e.exercise]));
      const duplicates = new Map<string, string>(); // sourceId → id del duplicado
      const idFor = new Map<string, string>();
      for (const [exerciseId, d] of plan) {
        if (d.kind === "reference") {
          idFor.set(exerciseId, d.exerciseId);
          continue;
        }
        let dupId = duplicates.get(d.sourceId);
        if (!dupId) {
          dupId = await duplicateExercise(tx, userId, byId.get(d.sourceId)!);
          duplicates.set(d.sourceId, dupId);
        }
        idFor.set(exerciseId, dupId);
      }

      const r = await tx.routine.create({
        data: {
          userId,
          name: copyRoutineName(src.name, own),
          notes: src.notes,
          visibility: "private",
          // Duplicar una propia conserva la atribución del original; copiar de otro apunta a esa rutina y su autor.
          copiedFromRoutineId: own ? src.copiedFromRoutineId : src.id,
          copiedFromUserName: own ? src.copiedFromUserName : (src.user.name ?? "otro usuario").slice(0, 80),
        },
        select: { id: true },
      });
      await writeExercises(tx, r.id, {
        name: src.name,
        notes: src.notes,
        exercises: src.exercises.map((e) => ({
          exerciseId: idFor.get(e.exercise.id)!,
          restSeconds: e.restSeconds,
          notes: e.notes,
          sets: e.sets.map((s) => ({
            kind: s.kind,
            targetReps: s.targetReps,
            targetDurationSeconds: s.targetDurationSeconds,
            targetWeightKg: s.targetWeightKg,
            restSeconds: s.restSeconds,
          })),
        })),
      });
      return r.id;
    },
    // Hasta 40 ejercicios (+ duplicados) contra TiDB: el default de 5 s de Prisma queda justo.
    { timeout: 20_000, maxWait: 5_000 }
  );
  return { routineId: newId };
}
```

Si la fase 1 dejó inline en `resolvePendingExercises` la expresión `` `${slugify(def.name).slice(0, 60) || "ejercicio"}-${Math.random().toString(36).slice(2, 8)}` ``, reemplazarla por `privateSlug(def.name)` (misma salida).

- [ ] **Step 4:** `npm run test:int -- src/server/routines/service.int.test.ts` → PASS.

- [ ] **Step 5: Acción** — en `src/server/actions/routines.ts`, sumar `copyRoutine` al import de `@/src/server/routines/service`, agregar la ruta de detalle a `revalidateRoutines` y la acción:

```ts
function revalidateRoutines(routineId?: string) {
  revalidatePath("/routines");
  revalidatePath("/home");
  revalidatePath("/profile");
  if (routineId) {
    revalidatePath(`/routines/${routineId}`);
    revalidatePath(`/routines/${routineId}/edit`);
  }
}

/** "Copiar a mis rutinas" (pública de otro) o "Duplicar" (propia). La privada de otro → "No encontramos…". */
export async function copyRoutineAction(routineId: string): Promise<ActionResult<{ routineId: string }>> {
  return guard(async () => {
    const user = await requireUser();
    const id = idSchema.safeParse(routineId);
    if (!id.success) return fail(NOT_FOUND);
    const copy = await copyRoutine(user.id, id.data);
    revalidateRoutines();
    return ok(copy, "Listo: la rutina ya está en tus rutinas");
  });
}
```

- [ ] **Step 6:** `npm run typecheck && npx vitest run --project unit src/server/actions/auth-coverage.test.ts` → PASS (la acción nueva pide sesión antes de tocar la DB).

- [ ] **Step 7: Commit**

```bash
git add src/server/routines src/server/actions/routines.ts
git commit -m "feat(routines): copy a public routine (or duplicate your own) in one transaction

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Editor (Privada/Pública), tarjeta y link para compartir

**Files:**
- Create: `src/server/routines/share-url.ts`, `src/features/routines-share/CopyRoutineButton.tsx`
- Modify: `src/features/workout/RoutineEditorScreen.tsx`, `src/features/workout/RoutineCard.tsx`, `app/routines/page.tsx`, `src/features/routines-share/ShareRoutineButton.tsx`

**Interfaces:**
- Consumes: `RoutineVisibility`, `routine.visibility` / `copiedFromUserName` (Tasks 1–2), `copyRoutineAction` (Task 4), `absoluteUrl` (`src/emails/render.ts`), `appUrl` (`src/server/notifications/email.ts`), `Tabs` (`src/components/ui`).
- Produces:
  - `routineShareUrl(routineId: string): string`
  - `CopyRoutineButton({ routineId, label, variant?, size?, fullWidth?, className?, onDone? })`
  - `ShareRoutineButton({ routineId, url?, routine?, size? })` — si viene `routine`, no la pide al server.
  - `RoutineCard({ routine, lastUsedLabel, shareUrl? })` con `routine.visibility` y `routine.copiedFromUserName`.

- [ ] **Step 1: Link absoluto**

```ts
// src/server/routines/share-url.ts
import "server-only";
import { absoluteUrl } from "@/src/emails/render";
import { appUrl } from "@/src/server/notifications/email";

/** Link absoluto de una rutina (pie "Hecho con El Bravo · …" del texto de Compartir). Solo para rutinas públicas. */
export function routineShareUrl(routineId: string): string {
  return absoluteUrl(appUrl(), `/routines/${routineId}`);
}
```

- [ ] **Step 2: `ShareRoutineButton` acepta la rutina ya cargada** — en `src/features/routines-share/ShareRoutineButton.tsx` (fase 1, Task 7):

```tsx
import type { RoutineForEditor } from "@/src/schemas/routine";

/** Comparte la rutina como texto El Bravo. `url` solo si es pública; `routine` evita pedirla (la de otro no se puede pedir). */
export function ShareRoutineButton({ routineId, url, routine, size = "sm" }: { routineId: string; url?: string; routine?: RoutineForEditor; size?: "sm" | "md" }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size={size}
      variant="secondary"
      pending={pending}
      onClick={() =>
        start(async () => {
          let data = routine;
          if (!data) {
            const r = await getRoutineForEditorAction(routineId);
            if (!r.ok) return void toast.error(r.error);
            data = r.data;
          }
          const text = routineToText(data, { url });
          try {
            if (navigator.share) await navigator.share({ title: data.name, text });
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

- [ ] **Step 3: `CopyRoutineButton`**

```tsx
// src/features/routines-share/CopyRoutineButton.tsx
"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, toast, type ButtonSize, type ButtonVariant } from "@/src/components/ui";
import { copyRoutineAction } from "@/src/server/actions/routines";

/** "Copiar a mis rutinas" (pública de otro) o "Duplicar" (propia): crea una rutina privada y lleva a /routines. */
export function CopyRoutineButton({
  routineId,
  label,
  variant = "primary",
  size = "md",
  fullWidth,
  className,
  onDone,
}: {
  routineId: string;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      className={className}
      pending={pending}
      onClick={() =>
        start(async () => {
          try {
            const r = await copyRoutineAction(routineId);
            if (!r.ok) return void toast.error(r.error);
            toast.success(r.message ?? "Rutina copiada");
            onDone?.();
            router.push("/routines");
            router.refresh();
          } catch {
            toast.error("No pudimos conectarnos. Revisá tu conexión y probá de nuevo.");
          }
        })
      }
    >
      {label}
    </Button>
  );
}
```

- [ ] **Step 4: Editor** (`src/features/workout/RoutineEditorScreen.tsx`, sobre la versión de la fase 1):

```tsx
import { Button, Card, Field, Input, PageHeader, Tabs, Textarea, toast, type TabItem } from "@/src/components/ui";
import type { RoutineForEditor, RoutineVisibility } from "@/src/schemas/routine";

const VISIBILITY_TABS: TabItem<RoutineVisibility>[] = [
  { id: "private", label: "Privada" },
  { id: "public", label: "Pública" },
];

// dentro del componente, junto a los otros estados:
const [visibility, setVisibility] = useState<RoutineVisibility>(routine?.visibility ?? "private");

// en onSave, el `body` de la fase 1 pasa a:
const body = { ...input, visibility, ...(newExercises.length ? { newExercises } : {}) };
```

`PageHeader` suma el subtítulo de la atribución (el título/back de la fase 1 no cambian):

```tsx
subtitle={routine?.copiedFromUserName ? `Basada en la rutina de ${routine.copiedFromUserName}` : undefined}
```

y en la primera `Card`, debajo del `Field` de Notas:

```tsx
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Visibilidad</p>
          <Tabs aria-label="Visibilidad" tabs={VISIBILITY_TABS} value={visibility} onChange={setVisibility} />
          <p className="text-xs text-fg-subtle">
            {visibility === "public"
              ? "Aparece en tu perfil: cualquiera con cuenta en El Bravo la puede ver y copiar (con tus ejercicios propios)."
              : "Solo la ves vos."}
          </p>
        </div>
```

- [ ] **Step 5: Tarjeta** (`src/features/workout/RoutineCard.tsx`):
  - Imports: `import Link from "next/link";`, `import type { RoutineVisibility } from "@/src/schemas/routine";`, `import { CopyRoutineButton } from "@/src/features/routines-share/CopyRoutineButton";` (el de `ShareRoutineButton` ya está por la fase 1).
  - Props:

```tsx
export function RoutineCard({
  routine,
  lastUsedLabel,
  shareUrl,
}: {
  routine: { id: string; name: string; exerciseCount: number; setCount: number; groupKeys: string[]; visibility: RoutineVisibility; copiedFromUserName: string | null };
  lastUsedLabel: string | null;
  /** Link absoluto para el pie del texto; solo si la rutina es pública. */
  shareUrl?: string;
}) {
```

  - El nombre linkea al detalle y la atribución va debajo de los conteos:

```tsx
          <h2 className="truncate text-lg font-bold">
            <Link href={`/routines/${routine.id}`} className="hover:underline">
              {routine.name}
            </Link>
          </h2>
          {/* … <p> de conteos existente … */}
          {routine.copiedFromUserName && <p className="text-xs text-fg-subtle">Basada en la rutina de {routine.copiedFromUserName}</p>}
```

  - La fila de pills muestra "Pública" primero:

```tsx
      {(routine.visibility === "public" || routine.groupKeys.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {routine.visibility === "public" && <Pill tone="primary">Pública</Pill>}
          {routine.groupKeys.map((k) => (
            <Pill key={k}>{GROUP_LABEL[k] ?? k}</Pill>
          ))}
        </div>
      )}
```

  - El `<ShareRoutineButton routineId={routine.id} />` de la fase 1 pasa a `<ShareRoutineButton routineId={routine.id} url={shareUrl} />`.
  - En el `Sheet`, entre "Registrar un entrenamiento…" y "Borrar rutina":

```tsx
          <CopyRoutineButton routineId={routine.id} label="Duplicar rutina" variant="ghost" fullWidth className="justify-start" onDone={() => setMenu(false)} />
```

- [ ] **Step 6: Página `/routines`** (`app/routines/page.tsx`): importar `routineShareUrl` de `@/src/server/routines/share-url` y pasar el link solo a las públicas:

```tsx
            <RoutineCard
              key={r.id}
              routine={r}
              lastUsedLabel={r.lastUsedAt ? formatDate(r.lastUsedAt, user.timezone) : null}
              shareUrl={r.visibility === "public" ? routineShareUrl(r.id) : undefined}
            />
```

- [ ] **Step 7:** `npm run typecheck && npm run lint && npm run lint:colors && npm test` → PASS. A mano (`npm run dev`): editar una rutina → "Pública" → guardar → la tarjeta muestra "Pública"; Compartir incluye `…/routines/<id>` solo si es pública; ⋯ → "Duplicar rutina" crea "<nombre> (copia)".

- [ ] **Step 8: Commit**

```bash
git add src/server/routines/share-url.ts src/features/routines-share src/features/workout/RoutineEditorScreen.tsx src/features/workout/RoutineCard.tsx app/routines/page.tsx
git commit -m "feat(routines): public/private selector, attribution, share link and duplicate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Página `/routines/[id]` (lectura, copiar, compartir)

**Files:**
- Create: `app/routines/[id]/page.tsx`, `src/features/routines-share/RoutineDetailView.tsx`
- Test: `e2e/visual-smoke.spec.ts` (agregar la página)

**Interfaces:**
- Consumes: `getPublicRoutine` (Task 2), `routineShareUrl`, `CopyRoutineButton`, `ShareRoutineButton({ routine })` (Task 5), `setLabels`/`setText`/`restLabel` (`src/features/workout/format.ts`), `ExerciseThumb`, `PlayIcon`.
- Produces: `RoutineDetailView({ routine: RoutineView, shareUrl?: string })`.

- [ ] **Step 1: Vista**

```tsx
// src/features/routines-share/RoutineDetailView.tsx
import Link from "next/link";
import { Avatar, Card, LinkButton, PageHeader, Pill } from "@/src/components/ui";
import { ExerciseThumb } from "@/src/features/exercises/ExerciseThumb";
import { restLabel, setLabels, setText } from "@/src/features/workout/format";
import { PlayIcon } from "@/src/features/workout/icons";
import type { RoutineView } from "@/src/schemas/routine";
import { CopyRoutineButton } from "./CopyRoutineButton";
import { ShareRoutineButton } from "./ShareRoutineButton";

/**
 * `/routines/[id]` (fase 2). Dueño: su rutina (pública o privada) con Empezar / Editar / Compartir / Duplicar.
 * Otro usuario (solo si es pública): ejercicios y series en lectura, autor, "Copiar a mis rutinas" y "Compartir".
 * Sin botón de info de ejercicio: los propios del autor no se pueden abrir para otros (`getExerciseDetail`).
 */
export function RoutineDetailView({ routine, shareUrl }: { routine: RoutineView; shareUrl?: string }) {
  const { owner, isOwner } = routine;
  const exercises = routine.exercises.length;
  const sets = routine.exercises.reduce((n, e) => n + e.sets.length, 0);
  return (
    <div className="mx-auto max-w-screen-sm space-y-4 pb-24">
      <PageHeader
        title={routine.name}
        back={isOwner ? "/routines" : `/u/${owner.id}`}
        subtitle={`${exercises} ${exercises === 1 ? "ejercicio" : "ejercicios"} · ${sets} ${sets === 1 ? "serie" : "series"}`}
        actions={
          isOwner ? (
            <Pill tone={routine.visibility === "public" ? "primary" : "default"}>{routine.visibility === "public" ? "Pública" : "Privada"}</Pill>
          ) : undefined
        }
      />

      {!isOwner && (
        <div className="flex items-center gap-3">
          <Avatar name={owner.name} src={owner.photoUrl} size="sm" />
          <p className="text-sm text-fg-muted">
            Rutina de{" "}
            <Link href={`/u/${owner.id}`} className="font-semibold text-fg hover:underline">
              {owner.name ?? "Usuario de El Bravo"}
            </Link>
          </p>
        </div>
      )}
      {routine.copiedFromUserName && <p className="text-xs text-fg-subtle">Basada en la rutina de {routine.copiedFromUserName}</p>}
      {routine.notes && <Card className="whitespace-pre-line text-sm text-fg-muted">{routine.notes}</Card>}

      <div className="flex flex-wrap gap-2">
        {isOwner ? (
          <>
            <LinkButton href={`/routines/${routine.id}/live`} className="flex-1">
              <PlayIcon size={16} />
              Empezar
            </LinkButton>
            <LinkButton href={`/routines/${routine.id}/edit`} variant="secondary">
              Editar
            </LinkButton>
            <ShareRoutineButton routineId={routine.id} routine={routine} url={shareUrl} size="md" />
            <CopyRoutineButton routineId={routine.id} label="Duplicar" variant="ghost" />
          </>
        ) : (
          <>
            <CopyRoutineButton routineId={routine.id} label="Copiar a mis rutinas" className="flex-1" />
            <ShareRoutineButton routineId={routine.id} routine={routine} url={shareUrl} size="md" />
          </>
        )}
      </div>

      <section aria-labelledby="routine-exercises" className="space-y-2">
        <h2 id="routine-exercises" className="px-1 text-sm font-bold uppercase tracking-wide text-fg-subtle">
          Ejercicios
        </h2>
        <ol className="space-y-2">
          {routine.exercises.map((e, i) => {
            const labels = setLabels(e.sets);
            return (
              <Card as="li" key={i} className="space-y-2 p-3">
                <div className="flex items-center gap-3">
                  <ExerciseThumb mediaUrl={e.exercise.mediaUrl} groupKey={e.exercise.primaryGroupKey} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold">{e.exercise.name}</h3>
                    {e.restSeconds !== null && <p className="text-xs text-fg-subtle">{restLabel(e.restSeconds)}</p>}
                  </div>
                </div>
                {e.notes && <p className="text-sm text-fg-muted">{e.notes}</p>}
                <ul className="flex flex-wrap gap-1.5" aria-label={`Series de ${e.exercise.name}`}>
                  {e.sets.map((s, j) => (
                    <li key={j}>
                      <Pill>
                        {labels[j]} · {setText({ reps: s.targetReps, durationSeconds: s.targetDurationSeconds, weightKg: s.targetWeightKg })}
                      </Pill>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Página**

```tsx
// app/routines/[id]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/src/server/auth/dal";
import { getPublicRoutine } from "@/src/server/routines/service";
import { routineShareUrl } from "@/src/server/routines/share-url";
import { RoutineDetailView } from "@/src/features/routines-share/RoutineDetailView";

export const metadata: Metadata = { title: "Rutina" };

/** Propia (cualquier visibilidad) o pública de otro; la privada de otro o inexistente → 404 (nunca 403). */
export default async function RoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const routine = await getPublicRoutine(user.id, id).catch(() => null);
  if (!routine) notFound();
  const shareUrl = routine.visibility === "public" ? routineShareUrl(routine.id) : undefined;
  return <RoutineDetailView routine={routine} shareUrl={shareUrl} />;
}
```

(`/routines/new` y `/routines/import` son segmentos estáticos: tienen prioridad sobre `[id]`.)

- [ ] **Step 3: Smoke visual** — en `e2e/visual-smoke.spec.ts`, en la lista de "páginas principales con sesión", después de `routines-new`:

```ts
    [`/routines/${creds().routines.anaPush}`, "routine-detail"],
```

- [ ] **Step 4:** `npm run typecheck && npm run lint && npm run lint:colors` → PASS. A mano: `/routines/<id propia>` (privada y pública), `/routines/<id pública de otro>` (se ve, Copiar lleva a /routines con la copia), `/routines/<id privada de otro>` → "No encontramos esta página".

- [ ] **Step 5: Commit**

```bash
git add app/routines/[id]/page.tsx src/features/routines-share/RoutineDetailView.tsx e2e/visual-smoke.spec.ts
git commit -m "feat(routines): routine page — read-only view, copy and share for public routines

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Sección "Rutinas" en el perfil

**Files:**
- Create: `src/features/profile/ProfileRoutines.tsx`
- Modify: `src/features/profile/ProfileView.tsx`, `app/profile/page.tsx`, `app/u/[id]/page.tsx`

**Interfaces:**
- Consumes: `listRoutines`, `listPublicRoutines`, `type RoutineSummary` (Task 2).
- Produces: `ProfileRoutines({ routines: RoutineSummary[], isOwner: boolean })`; `ProfileView({ …, routines?: RoutineSummary[] })`.

- [ ] **Step 1: Componente**

```tsx
// src/features/profile/ProfileRoutines.tsx
import Link from "next/link";
import { Pill } from "@/src/components/ui";
import { GROUP_LABEL } from "@/src/features/exercises/types";
import type { RoutineSummary } from "@/src/server/routines/service";

/** Rutinas del perfil: las públicas (ajeno) o todas con etiqueta Pública/Privada (propio). Cada una abre `/routines/[id]`. */
export function ProfileRoutines({ routines, isOwner }: { routines: RoutineSummary[]; isOwner: boolean }) {
  if (routines.length === 0) {
    return (
      <p className="text-sm text-fg-muted">
        Todavía no tenés rutinas.{" "}
        <Link href="/routines/new" className="font-semibold text-primary hover:underline">
          Crear una
        </Link>
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface-1">
      {routines.map((r) => (
        <li key={r.id}>
          <Link href={`/routines/${r.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.name}</p>
              <p className="truncate text-sm text-fg-muted">
                {r.exerciseCount} {r.exerciseCount === 1 ? "ejercicio" : "ejercicios"} · {r.setCount} {r.setCount === 1 ? "serie" : "series"}
                {r.groupKeys.length > 0 && ` · ${r.groupKeys.map((k) => GROUP_LABEL[k] ?? k).join(", ")}`}
              </p>
            </div>
            {isOwner && <Pill tone={r.visibility === "public" ? "primary" : "default"}>{r.visibility === "public" ? "Pública" : "Privada"}</Pill>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

(El estado vacío solo se ve en el perfil propio: en el ajeno, `ProfileView` no dibuja la sección si no hay públicas.)

- [ ] **Step 2: `ProfileView`** — importar `ProfileRoutines` y `type RoutineSummary`, sumar la prop y la sección (después de la de "Estadísticas", antes de "Insignias"):

```tsx
  /** Propio: todas (`listRoutines`); ajeno: solo las públicas (`listPublicRoutines`). */
  routines?: RoutineSummary[];
```

```tsx
      {routines && (isOwner || routines.length > 0) && (
        <section aria-labelledby="routines-title" className="space-y-2">
          <SectionTitle
            id="routines-title"
            action={
              isOwner ? (
                <Link href="/routines" className="text-sm font-semibold text-primary hover:underline">
                  Ver todas →
                </Link>
              ) : undefined
            }
          >
            Rutinas
          </SectionTitle>
          <ProfileRoutines routines={routines} isOwner={isOwner} />
        </section>
      )}
```

y borrar el link "Mis rutinas →" del bloque de estadísticas del dueño (queda "Ver mis stats →" solo; la sección nueva lo reemplaza).

- [ ] **Step 3: Páginas**

`app/profile/page.tsx`: sumar `import { listRoutines } from "@/src/server/routines/service";`, agregar `listRoutines(me.id)` al `Promise.all` (`const [profile, badges, stats, history, routines] = …`) y pasar `routines={routines}` a `ProfileView`.

`app/u/[id]/page.tsx`: sumar `import { listPublicRoutines } from "@/src/server/routines/service";` y:

```tsx
  const [badges, stats, routines] = await Promise.all([getUserBadges(id), getUserStats(id), listPublicRoutines(id)]);
  return <ProfileView profile={profile} badges={badges} viewerTz={viewer.timezone} stats={stats} isOwner={false} routines={routines} />;
```

- [ ] **Step 4:** `npm run typecheck && npm run lint && npm run lint:colors` → PASS. A mano: `/profile` muestra todas con etiqueta; `/u/<otro>` solo las públicas (sin sección si no tiene).

- [ ] **Step 5: Commit**

```bash
git add src/features/profile app/profile/page.tsx app/u/[id]/page.tsx
git commit -m "feat(profile): routines section (public ones for others, all with a label for yourself)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: E2E publicar → ver en el perfil → copiar

**Files:**
- Modify: `e2e/fixtures/seed-e2e.ts`
- Create: `e2e/routine-public.spec.ts`

**Interfaces:** Consumes `loggedInPage`, `user`, `creds` (`e2e/fixtures/helpers.ts`). Produces `E2E_USERS.vale`, `E2E_USERS.juli`, `creds().routines.valeBack`.

- [ ] **Step 1: Seed** — en `e2e/fixtures/seed-e2e.ts`:
  - `E2E_USERS`: agregar `vale: "Vale E2E",` y `juli: "Juli E2E",` (antes de `lock`). Ningún otro spec los usa.
  - `E2ECredentials.routines`: `{ anaPush: string; valeBack: string };`
  - Después de la rutina de Ana (reusa `bench`):

```ts
  // --- Rutina de Vale (fase 2): arranca PRIVADA, con un ejercicio propio; el E2E la hace pública y Juli la copia ---
  const espalda = await prisma.muscle.findUniqueOrThrow({ where: { slug: "espalda" }, select: { id: true } });
  const valeRow = await prisma.exercise.create({
    data: {
      slug: "remo-vale-e2e",
      name: "Remo Vale E2E",
      equipment: "machine",
      createdByUserId: users.vale.id,
      muscles: { create: [{ muscleId: espalda.id, percentage: 100 }] },
    },
    select: { id: true },
  });
  const valeBack = await prisma.routine.create({
    data: {
      name: "Espalda de Vale",
      userId: users.vale.id,
      exercises: {
        create: [
          { exerciseId: bench.id, position: 0, restSeconds: 90, sets: { create: [0, 1, 2].map((position) => ({ position, targetReps: 8, targetWeightKg: 60 })) } },
          { exerciseId: valeRow.id, position: 1, sets: { create: [0, 1].map((position) => ({ position, targetReps: 12 })) } },
        ],
      },
    },
    select: { id: true },
  });
```

  - `creds.routines`: `{ anaPush: routine.id, valeBack: valeBack.id }`.

- [ ] **Step 2: Test**

```ts
// e2e/routine-public.spec.ts
import { expect, test } from "@playwright/test";
import { creds, loggedInPage, user } from "./fixtures/helpers";

test("rutina pública: la autora la publica, otro la ve en su perfil y la copia", async ({ browser }) => {
  const vale = user("vale");
  const routineId = creds().routines.valeBack;
  const juli = await loggedInPage(browser, "juli");

  // Privada: no aparece en el perfil y su link da 404 (nunca 403).
  await juli.goto(`/u/${vale.id}`);
  await expect(juli.getByRole("heading", { name: vale.name })).toBeVisible();
  await expect(juli.getByRole("region", { name: "Rutinas" })).toHaveCount(0);
  await juli.goto(`/routines/${routineId}`);
  await expect(juli.getByText("No encontramos esta página")).toBeVisible();

  // Vale la hace pública desde el editor.
  const author = await loggedInPage(browser, "vale");
  await author.goto("/routines");
  const card = author.getByRole("listitem").filter({ hasText: "Espalda de Vale" });
  await card.getByRole("link", { name: "Editar" }).click();
  await author.getByRole("tab", { name: "Pública" }).click();
  await author.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(author).toHaveURL(/\/routines$/);
  await expect(card.getByText("Pública", { exact: true })).toBeVisible();
  await author.context().close();

  // Juli la ve en el perfil de Vale y la abre.
  await juli.goto(`/u/${vale.id}`);
  await juli.getByRole("region", { name: "Rutinas" }).getByRole("link", { name: /Espalda de Vale/ }).click();
  await expect(juli).toHaveURL(new RegExp(`/routines/${routineId}$`));
  await expect(juli.getByRole("heading", { name: "Espalda de Vale", level: 1 })).toBeVisible();
  await expect(juli.getByRole("link", { name: vale.name, exact: true })).toBeVisible();
  await expect(juli.getByRole("heading", { name: "Remo Vale E2E", level: 3 })).toBeVisible();
  await expect(juli.getByRole("button", { name: "Compartir" })).toBeVisible();
  // El email de la autora no viaja ni en el HTML ni en el payload RSC.
  expect(await (await juli.request.get(`/routines/${routineId}`, { headers: { RSC: "1" } })).text()).not.toContain(vale.email);

  // Copiar: queda en sus rutinas, privada, con la atribución.
  await juli.getByRole("button", { name: "Copiar a mis rutinas" }).click();
  await expect(juli).toHaveURL(/\/routines$/);
  const copy = juli.getByRole("listitem").filter({ hasText: "Espalda de Vale" });
  await expect(copy).toContainText("Basada en la rutina de Vale E2E");
  await expect(copy).toContainText("2 ejercicios · 5 series");
  await expect(copy.getByText("Pública", { exact: true })).toHaveCount(0);

  // El ejercicio propio de Vale se copió como de Juli: la copia se guarda sin "Alguno de los ejercicios ya no existe".
  await copy.getByRole("link", { name: "Editar" }).click();
  await expect(juli.getByText("Basada en la rutina de Vale E2E")).toBeVisible();
  await expect(juli.getByRole("heading", { name: "Remo Vale E2E", level: 3 })).toBeVisible();
  await juli.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(juli).toHaveURL(/\/routines$/);
  await juli.context().close();
});
```

- [ ] **Step 3:** con el dev server parado: `npx playwright test e2e/routine-public.spec.ts e2e/visual-smoke.spec.ts` → PASS. (Si el editor no rotula los bloques con `h3`, mirar cómo lo resuelve `live-routine.spec.ts` —`getByRole("heading", { name, exact: true, level: 3 })`— y usar lo mismo; no cambiar la UI para el test.)

- [ ] **Step 4: Commit**

```bash
git add e2e
git commit -m "test(e2e): make a routine public, see it on the profile and copy it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Gates y publicación (con OK del dueño)

- [ ] **Step 1:** `npm run typecheck && npm run lint && npm run lint:colors && npm test && npm run test:int`; parar el dev server; `npm run test:e2e` → todo verde.
- [ ] **Step 2:** Pedir OK al dueño. Con el OK: migrar producción y recién después push (la migración es aditiva: el código publicado ignora las columnas nuevas). Confirmar antes que `APP_URL` esté en las variables de Vercel (hoy está en `.env.production.local`; sin ella el link de Compartir saldría `http://localhost:3000/…`).

```bash
export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.production.local | sed -E 's/^DATABASE_URL="?([^"]*)"?$/\1/')"
npx prisma migrate deploy
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code && echo OK
git push origin HEAD:main
```

- [ ] **Step 3:** Esperar el deploy (Vercel → Ready), `curl https://elbravo.vercel.app/api/health` → 200. Probar en producción: hacer pública una rutina, abrir `/routines/<id>` con otra cuenta, copiar.
