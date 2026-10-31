# W2-1 — Registro de entrenamientos y rutinas tipo Strong Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leé primero `00-roadmap.md` (§4, §5.4–5.8, §6.2–6.3).

**Goal:** reemplazar `CreateActivityForm` y `RoutineForm` (unas 1.800 líneas) por un editor único tipo Strong, con series individuales (peso, reps o tiempo y descanso por serie). El trabajo incluye:
- **Modo en vivo** a pantalla completa, para ir tachando series con temporizador de descanso.
- **Edición** de entrenamientos.
- **Fotos** en los entrenamientos.
- **Pantalla de envío** con estados *enviando → error (reintentar) → resultado*. El resultado muestra los puntos ganados por temporada y solo las insignias afectadas.

**Architecture:**
- **Estado del editor:** un reducer puro (`workoutReducer`) compartido por tres modos: `plan` (rutina), `log` (registrar a posteriori) y `live` (en tiempo real).
- **Persistencia del borrador:** en `localStorage`, por `clientRequestId`, para que un entrenamiento en vivo sobreviva a recargas.
- **Componentes de presentación:** `ExerciseBlock`, `SetTable` y `SetRow`.
- **Acciones:** llaman al servicio de W0-C, que devuelve `ActivityEffects`. Esos efectos alimentan `WorkoutResult`.

**Tech Stack:** React 19 (`useReducer`, `useOptimistic`, `useTransition`), Server Actions, primitivas UI de W0-B, `ExercisePicker` (W1-3), `PendingPhotoPicker` (W1-5), `BadgeChangeList` (W1-2) y `ScoringEffect` (W1-1).

**Spec:** `00-roadmap.md`. **Depende de:** W1-1, W1-2, W1-3 y W1-5 mergeados. **Rama:** `v2/w2-1-workouts`. Puerto 3021.

## Global Constraints
Ver `00-roadmap.md` §4. Mobile-first estricto: este flujo se usa en el gimnasio, con una mano. Los targets táctiles son de al menos 44 px. Los inputs numéricos usan `inputMode="decimal"`/`"numeric"`.

---

### Task 1: Modelo de estado del editor (puro)

**Files:**
- Create: `src/features/workout/state.ts`
- Test: `src/features/workout/state.test.ts`

**Interfaces:**
- Produce:

```ts
export type SetDraft = { key: string; kind: "warmup" | "normal" | "drop" | "failure"; reps: number | null; durationSeconds: number | null; weightKg: number | null; restSeconds: number | null; completed: boolean; completedAt: number | null };
export type ExerciseDraft = { key: string; exercise: ExerciseSummary; notes: string; restSeconds: number | null; sets: SetDraft[] };
export type WorkoutDraft = {
  clientRequestId: string; mode: "plan" | "log" | "live"; routineId: string | null; routineName: string;
  activityCategoryId: string | null; localDate: string; localTime: string; durationMinutes: number | null; notes: string;
  startedAtMs: number | null; exercises: ExerciseDraft[];
};
export type WorkoutAction =
  | { type: "addExercises"; exercises: ExerciseSummary[]; defaultRest?: number }
  | { type: "removeExercise"; key: string } | { type: "moveExercise"; key: string; dir: -1 | 1 }
  | { type: "replaceExercise"; key: string; exercise: ExerciseSummary }
  | { type: "addSet"; exerciseKey: string } | { type: "removeSet"; exerciseKey: string; setKey: string }
  | { type: "updateSet"; exerciseKey: string; setKey: string; patch: Partial<Omit<SetDraft, "key">> }
  | { type: "toggleSetDone"; exerciseKey: string; setKey: string; nowMs: number }
  | { type: "setField"; field: "activityCategoryId" | "localDate" | "localTime" | "durationMinutes" | "notes" | "routineName"; value: unknown }
  | { type: "loadRoutine"; routine: RoutineForEditor } | { type: "finishLive"; nowMs: number; tz: string };
export function workoutReducer(s: WorkoutDraft, a: WorkoutAction): WorkoutDraft;
export function newDraft(mode: WorkoutDraft["mode"], now: { localDate: string; localTime: string }): WorkoutDraft;
export function toActivityInput(d: WorkoutDraft): ActivityInput;       // valida con activityInputSchema; en "live" solo sets completed
export function toRoutineInput(d: WorkoutDraft): RoutineInput;
export function draftSummary(d: WorkoutDraft): { exercises: number; setsDone: number; setsTotal: number; volumeKg: number };
```

**Reglas** (cada una con su test):
- **`addSet`:** copia los valores de la última serie del ejercicio, igual que Strong, con `completed: false` en modo `live` y `true` en modo `log`.
- **`addExercises`:**
  - Ejercicio por reps: crea 3 series vacías.
  - Ejercicio por tiempo: crea 1 serie con 60 s.
  - En ambos casos `restSeconds = defaultRest ?? 90`, y `weightKg = null` si `tracksWeight` es false.
- **`toggleSetDone`:** marca `completedAt`. Si la serie no tenía valores, copia los "objetivos" de la anterior.
- **`finishLive`:**
  - `durationMinutes` = redondeo de (ahora − `startedAtMs`) en minutos, con un mínimo de 1.
  - `localDate`/`localTime` = fecha y hora de inicio en la zona horaria del usuario.
  - Elimina las series no completadas, y los ejercicios que quedan sin series.
- **`loadRoutine`:** reemplaza los ejercicios solo si el borrador está vacío. Si no está vacío, la UI pide confirmación antes de despachar (ver Task 4). Esto corrige que antes se borraban en silencio.
- **`toActivityInput`:** convierte `weightKg` vacío en `null`. Exige categoría y duración, y lanza un error tipado con `fieldErrors` en español si faltan.
- **`draftSummary`:** el volumen es la suma de reps × peso de las series completadas.

- [ ] **Step 1:** tests (al menos 15 casos que cubran las reglas). Run: `npx vitest run src/features/workout` → FAIL.
- [ ] **Step 2:** implementar. `key` se genera con `crypto.randomUUID()`, inyectable para los tests. Correr hasta PASS.
- [ ] **Step 3: Commit**

```bash
git add src/features/workout/state.ts src/features/workout/state.test.ts
git commit -m "feat(workout): pure editor state shared by routine, log and live modes"
```

---

### Task 2: Acciones de servidor (actividades y rutinas)

**Files:**
- Create: `src/schemas/routine.ts` (reemplaza el de W0-A; formato con series)
- Create: `src/server/routines/service.ts`
- Create: `src/server/actions/activities.ts`
- Create: `src/server/actions/routines.ts`
- Delete: `app/api/activities/**`, `app/api/routine/**`, `app/api/exercise/**`, `app/api/muscle/**`, `app/api/activity-types/**`
- Test: `src/server/routines/service.int.test.ts`, `src/server/actions/activities.int.test.ts`

**Interfaces:**
- Produce:

```ts
// routine schema
export const routineInputSchema; // { name 1..100, notes?, exercises: { exerciseId, restSeconds?, notes?, sets: { kind, targetReps?, targetDurationSeconds?, targetWeightKg?, restSeconds? }[] (≥1) }[] (≥1) }
export type RoutineInput = z.infer<typeof routineInputSchema>;
export type RoutineForEditor = { id: string; name: string; notes: string | null; exercises: { exercise: ExerciseSummary; restSeconds: number | null; notes: string | null; sets: { kind; targetReps; targetDurationSeconds; targetWeightKg; restSeconds }[] }[] };
// actions
export async function createActivityAction(input: ActivityInput): Promise<ActionResult<{ activityId: string; effects: ActivityEffects }>>;
export async function updateActivityAction(activityId: string, input: ActivityInput): Promise<ActionResult<{ effects: ActivityEffects }>>;
export async function deleteActivityAction(activityId: string): Promise<ActionResult<{ effects: ActivityEffects }>>;
export async function listActivityCategoriesAction(): Promise<ActionResult<{ id: string; slug: string; name: string; usesExercises: boolean }[]>>;
export async function createRoutineAction(input: RoutineInput): Promise<ActionResult<{ routineId: string }>>;
export async function updateRoutineAction(routineId: string, input: RoutineInput): Promise<ActionResult<void>>; // transacción: borrar y recrear ejercicios+series
export async function deleteRoutineAction(routineId: string): Promise<ActionResult<void>>;
export async function updateRoutineFromWorkoutAction(routineId: string, input: ActivityInput): Promise<ActionResult<void>>; // "Actualizar rutina con estos valores"
export async function getRoutineForEditor(userId: string, routineId: string): Promise<RoutineForEditor>;
export async function listRoutines(userId: string): Promise<{ id: string; name: string; exerciseCount: number; setCount: number; groupKeys: string[]; lastUsedAt: Date | null }[]>;
```

Reglas:
- Solo el dueño puede ver, editar o borrar una rutina.
- **Borrar una rutina no borra los entrenamientos asociados:** `routineId` queda en `null` (`SetNull`, ya está en el schema).
- `updateRoutineAction` corre dentro de una transacción, lo que corrige que una rutina pudiera quedar vacía si fallaba a mitad de camino.
- Todas las acciones hacen `revalidatePath` de `/home`, `/profile` y `/routines`, y del grupo cuando hay efectos de puntaje.

- [ ] **Step 1:** tests de integración del servicio de rutinas:
  - crear con un ejercicio por tiempo y uno con pesos distintos por serie;
  - que el orden de ejercicios y de series se conserva;
  - que otro usuario no puede leer la rutina;
  - que la actualización es atómica: si un `exerciseId` no existe, la rutina queda intacta.
- [ ] **Step 2:** implementar.
- [ ] **Step 3: Commit**

```bash
git add -A src/schemas/routine.ts src/server/routines src/server/actions/activities.ts src/server/actions/routines.ts app/api
git commit -m "feat(workout): activity and routine server actions with set-level data"
```

---

### Task 3: Componentes del editor

**Files:**
- Create: `src/features/workout/SetRow.tsx`
- Create: `src/features/workout/SetTable.tsx`
- Create: `src/features/workout/ExerciseBlock.tsx`
- Create: `src/features/workout/RestTimer.tsx` (+ `rest-timer.ts` puro: `remaining(startMs, totalS, nowMs)`)
- Create: `src/features/workout/WorkoutEditor.tsx` (orquesta reducer + picker)
- Create: `src/features/workout/useDraftPersistence.ts` (localStorage con try/catch, por clave `workout-draft:<mode>:<id>`)
- Test: `src/features/workout/rest-timer.test.ts`

**Diseño (modo `log`/`live`):**
- **`ExerciseBlock`:**
  - Encabezado con el nombre del ejercicio (toca → acciones), el `ExerciseInfoButton` ("?") y un menú ⋯ con "Reemplazar", "Mover arriba/abajo", "Descanso: 90 s" y "Quitar".
  - Debajo, la `SetTable` con las columnas **Serie · Anterior · kg · Reps (o Tiempo) · ✓**:
    - **Serie:** el número, o la letra W/D/F según el tipo. Al tocarla se cambia el tipo.
    - **Anterior:** la última vez que el usuario hizo ese ejercicio, en gris (por ejemplo "40×10"). Sale de `getLastPerformanceAction(exerciseIds)`; agregar esta acción en `src/server/actions/activities.ts`.
    - **kg / Reps:** `NumberInput` compactos.
    - **✓:** es el check de completada en modo `live`. En modo `log`, la columna no se muestra.
  - Al pie del bloque, el botón **"+ Serie"**.
- **Swipe a la izquierda** sobre una fila revela "Eliminar". En desktop hay un botón 🗑 visible al hover.
- **Botón para agregar ejercicios:** **"+ Agregar ejercicios"**, un único botón grande al **pie** de la lista. Abre `ExercisePicker` con `multiple` y cubre los ítems "botón + más simple" y "mejorar agregado de ejercicios".
- **`RestTimer`:**
  - Al tildar una serie en modo `live`, aparece una barra fija abajo, sobre la bottom nav, con la cuenta regresiva del descanso de esa serie o ejercicio y los botones −15 s, +15 s y "Saltar".
  - Al llegar a 0, vibra (`navigator.vibrate?.(200)`) y muestra un toast "¡A la próxima serie!".
- **`WorkoutEditor` en modo `plan` (rutina):** usa las mismas columnas sin "Anterior" ni ✓. Los valores son objetivos.

- [ ] **Step 1:** test de `rest-timer.ts`.
- [ ] **Step 2:** implementar los componentes.
- [ ] **Step 3:** agregar la sección `app/dev/ui/sections/workout.tsx` con un `WorkoutEditor` en los 3 modos y datos de ejemplo.
- [ ] **Step 4:** verificar en 375 px: la tabla de series entra sin scroll horizontal (kg y reps de 64 px de ancho cada uno), se puede borrar un número, y el swipe y el temporizador funcionan.
- [ ] **Step 5: Commit**

```bash
git add src/features/workout app/dev/ui/sections
git commit -m "feat(workout): Strong-like set table, exercise block and rest timer"
```

---

### Task 4: Pantallas: registrar, editar, rutinas y modo en vivo

**Files:**
- Create: `app/workout/new/page.tsx` (`?routine=<id>` opcional) + `src/features/workout/LogWorkoutScreen.tsx`
- Create: `app/workout/[id]/page.tsx` (detalle: categoría, fecha/hora local, duración, ejercicios y series, fotos (`PhotoGrid`), puntos por temporada (`getActivityPoints`), botones Editar y Borrar)
- Create: `app/workout/[id]/edit/page.tsx` (reusa `LogWorkoutScreen` con `getActivityForEdit`)
- Create: `app/routines/page.tsx`, `app/routines/new/page.tsx`, `app/routines/[id]/edit/page.tsx`, `app/routines/[id]/live/page.tsx`
- Create: `src/features/workout/LiveWorkoutScreen.tsx`
- Create: `src/features/workout/SubmitWorkoutScreen.tsx` + `WorkoutResult.tsx`
- Delete: `app/load/**`, `app/create-routine/**`, `app/routine/**`, `src/components/CreateActivityForm.tsx`, `src/components/RoutineForm.tsx`, `src/components/DeleteActivityButton.tsx`, `src/lib/muscles/calculateRoutineMuscleShare.ts` (mover la lógica a `src/features/workout/muscle-share.ts` si se usa en el preview de rutina)
- Modify: `next.config.ts` (redirects `/load` → `/workout/new`, `/create-routine` → `/routines/new`, `/routine` → `/routines`, `/routine/:id/edit` → `/routines/:id/edit`)
- Modify: `src/components/shell/nav-items.ts` (`log.href = "/workout/new"`)

**Flujo "Registrar" (`/workout/new`):**
1. **Paso 1, qué hiciste:** grilla de categorías como `Chip`s grandes con ícono. Las más usadas por el usuario aparecen primero.
   - Si la categoría tiene `usesExercises`, se muestra el atajo **"Desde una rutina"**: una lista de rutinas que, al elegir una, carga el editor, pidiendo confirmación con `useConfirm` si ya había ejercicios.
2. **Paso 2, cuándo y cuánto:** fecha (por defecto hoy), hora (por defecto ahora menos la duración) y duración con presets de 30/45/60/90 min más un input. Todo en la zona horaria del usuario. **No** hay campo de "hora de fin": cubre el ítem de los datos redundantes.
3. **Paso 3, ejercicios:** solo para categorías con `usesExercises`, o si el usuario toca "+ Agregar ejercicios". Es el `WorkoutEditor` en modo `log`.
4. **Paso 4, fotos y notas:** `PendingPhotoPicker` (hasta 4) y notas.
5. **Botón fijo "Guardar entrenamiento"**, que lleva a `SubmitWorkoutScreen`.

Todo está en una sola página con secciones colapsables, no en un wizard de varias pantallas. El borrador se persiste en `localStorage` (`useDraftPersistence`) y se limpia al guardar con éxito.

**`SubmitWorkoutScreen` (cubre "fix pantalla post entrenamiento"):**
- Aparece **inmediatamente** al tocar Guardar, como un overlay a pantalla completa con el estado **"Guardando tu entrenamiento…"** (spinner y la lista de pasos "Guardando → Calculando puntos → Subiendo fotos").
- **Si falla:** muestra el estado de error con el mensaje de `ActionResult.error` y los botones **"Reintentar"** (reenvía con el **mismo** `clientRequestId`, sin duplicar) y "Volver a editar". El borrador se conserva.
- **Si sale bien:** sube las fotos (`uploadPendingPhotos`; si alguna falla, avisa "N fotos no se subieron" con "Reintentar fotos") y muestra **`WorkoutResult`**:
  - un encabezado "¡Bien ahí! 💪" con el resumen (duración, ejercicios, series y volumen);
  - **puntos por temporada**: una tarjeta por cada `ScoringEffect` con "+N pts en <Temporada> (<Grupo>)" o, si fueron 0, el `activityReason` en gris. Además "Total: X → Y" y, si cambió, "Subiste al puesto N 🎉". Cubre el ítem "mostrar cuántos puntos ganaste";
  - las insignias con `BadgeChangeList`, que muestra **solo las afectadas**;
  - los botones "Ver entrenamiento" (→ `/workout/[id]`) e "Ir al inicio".
- **Al editar** (`updateActivityAction`) se usa la misma pantalla, con el título "Entrenamiento actualizado".

**`LiveWorkoutScreen` (`/routines/[id]/live`, cubre "abrir rutina en pantalla completa y tachar"):**
- Es a pantalla completa: oculta el shell (prop `hideShell` vía un layout propio en `app/routines/[id]/live/layout.tsx` que no renderiza la bottom nav) y usa la Wake Lock API (`navigator.wakeLock?.request("screen")`) para que la pantalla no se apague.
- Arriba tiene un cronómetro desde el inicio, el nombre de la rutina y el botón **"Terminar"**.
- Abajo, el `WorkoutEditor` en modo `live` con las series de la rutina como objetivos. Tildar ✓ tacha la fila (`line-through`, opacidad) y arranca el descanso.
- **"Terminar"** despacha `finishLive`, pide la categoría si la rutina no la define (por defecto Fuerza) y va a `SubmitWorkoutScreen`. Al final ofrece **"Actualizar la rutina con estos pesos"** (`updateRoutineFromWorkoutAction`).
- Si el usuario cierra la pestaña, el borrador queda guardado. Al volver a `/routines/[id]/live`, ofrece "Retomar entrenamiento en curso (empezado hace 23 min)" o "Descartar".

**`/routines`:**
- Una lista de `Card`s con nombre, "N ejercicios · N series", chips de grupos musculares y la fecha de último uso.
- Botones **"Empezar"** (→ live, el más visible), "Editar" y ⋯ → "Borrar" (con `useConfirm`).
- Un `EmptyState` con "Crear rutina".

- [ ] **Step 1:** implementar las pantallas.
- [ ] **Step 2: Redirects y nav.** Agregar los redirects y cambiar `nav-items.ts`.
- [ ] **Step 3: Verificación manual (375 px), contra la DB del worktree con temporada e insignias**
  1. Registrar running de 40 min sin ejercicios: el resultado muestra "+10 pts" y el avance de Corre Forrest.
  2. Registrar fuerza con 2 ejercicios y pesos distintos por serie, más 2 fotos: el detalle muestra las series y las fotos.
  3. Registrar otro entrenamiento el mismo día: el resultado dice 0 pts con el motivo "Ya sumaste un entrenamiento este día".
  4. Editar el entrenamiento 2 pasándolo a ayer: los puntos se recalculan.
  5. Borrar: confirmar y que los puntos y las insignias bajen.
  6. Crear una rutina con Plancha (tiempo) y Press banca 3 series (40/45/50 kg), empezarla en vivo, tildar 2 series, recargar la página, retomar, terminar y actualizar la rutina.
  7. Cortar la red (DevTools offline) al guardar: aparece el error y "Reintentar". Con la red de vuelta, reintentar: se guarda **un** entrenamiento.
- [ ] **Step 4:** gates verdes y `npm run lint:colors` sin hex en `src/features/workout`.
- [ ] **Step 5: Commit**

```bash
git add -A app/workout app/routines app/load app/create-routine app/routine src next.config.ts
git commit -m "feat(workout): log, edit, routines, live mode and submit/result screens"
```

---

### Verificación final de W2-1
- [ ] Todos los ítems del roadmap asignados a W2-1 tienen su caso en la verificación manual: 6, 9/30, 17, 19, 21, 22, 25, 31, 33 y 35.
- [ ] `grep -rn "CreateActivityForm\|RoutineForm\|/api/activities\|/api/routine" app src` devuelve vacío.
- [ ] Pedir review y merge.
