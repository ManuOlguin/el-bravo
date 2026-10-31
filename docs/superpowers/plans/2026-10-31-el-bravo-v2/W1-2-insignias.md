# W1-2 — Insignias con niveles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leé primero `00-roadmap.md` (§3 D2, §4, §5.6, §6.2).

**Goal:** insignias unificadas, donde cada familia tiene niveles I/II/III… y una sola tarjeta. Se calculan de forma determinista desde todas las actividades del usuario y se guardan en `UserBadge`. Se recalculan al crear, editar o borrar una actividad, y devuelven solo las que cambiaron, para la pantalla post-entreno.

**Architecture:** el flujo tiene cuatro piezas.
- `computeUserMetrics` es pura y calcula las métricas a partir de las actividades con sus series y músculos.
- `evaluateBadges` también es pura: con las métricas y las definiciones devuelve el nivel y el progreso de cada insignia.
- `recomputeUserBadges` hace el I/O: carga las actividades, calcula, compara contra `UserBadge`, hace upsert y devuelve un `BadgeChange[]`.
- La UI (`src/features/badges`) muestra la grilla de insignias y la lista de cambios.

**Tech Stack:** TypeScript, Prisma 7, Vitest, primitivas de `src/components/ui`.

**Spec:** `00-roadmap.md` (D2). **Depende de:** W0-C (y W0-B para la UI). **Rama:** `v2/w1-2-badges`. Puerto 3012. Preparar la DB con `npm run db:worktree -- w1-2 3012`.

## Global Constraints
Ver `00-roadmap.md` §4. Las insignias son **de por vida**, no por temporada: los premios de temporada son de W1-1. Reemplazar el stub `src/server/badges/index.ts` manteniendo sus exports.

---

### Task 1: Métricas (puro)

**Files:**
- Create: `src/server/badges/metrics.ts`
- Test: `src/server/badges/metrics.test.ts`

**Interfaces:**
- Produce:

```ts
export type MetricActivity = {
  id: string; startedAt: Date; durationMinutes: number; categorySlug: string;
  sets: { completed: boolean; muscleGroups: { groupKey: string; percentage: number }[] }[];
};
export type MetricKey = "total_workouts" | "category_workouts" | "best_goal_streak" | "muscle_sets" | "distinct_categories" | "total_minutes" | "early_workouts";
export type MetricParams = { categories?: string[]; groupKey?: string; minPercentage?: number; beforeHour?: number };
export function computeMetric(key: MetricKey, params: MetricParams, ctx: { activities: MetricActivity[]; timezone: string; weeklyGoal: number; now: Date }): number;
```

Definiciones (cada una con su test):
- `total_workouts`: cantidad de actividades.
- `category_workouts`: cantidad con `categorySlug ∈ params.categories`.
- `best_goal_streak`: **mejor** racha histórica de semanas consecutivas (zona horaria del usuario) con al menos `weeklyGoal` actividades. Las semanas sin actividad cortan la racha. Usa `weekKeyOf`/`addWeeks` de `src/lib/time`.
- `muscle_sets`: cantidad de series `completed` cuyo ejercicio trabaja `params.groupKey` con `percentage ≥ (params.minPercentage ?? 30)`. Cuenta tanto series por repeticiones como por tiempo, lo que corrige el bug de v1 donde las planchas no sumaban.
- `distinct_categories`: cantidad de `categorySlug` distintos.
- `total_minutes`: suma de `durationMinutes`.
- `early_workouts`: cantidad de actividades con hora local `< params.beforeHour` (por defecto 8).

- [ ] **Step 1: Tests**

Al menos estos casos:
- `best_goal_streak`: con objetivo 2, las semanas [2, 2, 0, 2, 2, 2] dan **3**, no 2: es la mejor racha, no la actual.
- Un entrenamiento del domingo 23:30 en Argentina cuenta para esa semana, no para la siguiente.
- `muscle_sets`: un ejercicio 60 % piernas con 3 series completas + 1 no completada da 3. Un ejercicio 20 % piernas da 0.
- `early_workouts`: 07:59 cuenta y 08:00 no.

Run: `npx vitest run src/server/badges/metrics` → FAIL.

- [ ] **Step 2: Implementar.** Correr hasta PASS.
- [ ] **Step 3: Commit**

```bash
git add src/server/badges/metrics.ts src/server/badges/metrics.test.ts
git commit -m "feat(badges): pure lifetime metrics"
```

---

### Task 2: Evaluación de niveles + definiciones (seed)

**Files:**
- Create: `src/server/badges/evaluate.ts`
- Test: `src/server/badges/evaluate.test.ts`
- Modify: `prisma/seed/badges.ts` (las familias)

**Interfaces:**
- Produce:

```ts
export type BadgeDef = { id: string; code: string; name: string; metric: MetricKey; params: MetricParams; levels: { level: number; threshold: number }[] };
export type BadgeState = { badgeId: string; code: string; level: number; progress: number; nextThreshold: number | null; maxLevel: number };
export function evaluateBadge(def: BadgeDef, value: number): BadgeState;
// level = mayor nivel con threshold ≤ value (0 si ninguno); progress = value; nextThreshold = threshold del nivel siguiente o null
```

- [ ] **Step 1: Tests de `evaluateBadge`**
  - Con niveles [10, 50, 150]: el valor 0 da nivel 0 y next 10; 10 da nivel 1 y next 50; 149 da nivel 2 y next 150; 500 da nivel 3 y next `null`.
  - Los niveles se ordenan aunque vengan desordenados.

- [ ] **Step 2: Implementar.**

- [ ] **Step 3: `prisma/seed/badges.ts`**

Upsert por `code`. Las familias se crean con sus niveles, y las definiciones se reemplazan en cada corrida:

```ts
export const BADGES = [
  { code: "EL_PERSISTENTE", name: "El Persistente", description: "Entrenamientos registrados en total.", metric: "total_workouts", params: {}, iconKey: "flame", levels: [10, 50, 150, 300] },
  { code: "GYM_RAT", name: "Gym Rat", description: "Entrenamientos de fuerza, calistenia, crossfit o funcional.", metric: "category_workouts", params: { categories: ["strength", "calisthenics", "crossfit", "hiit_functional"] }, iconKey: "dumbbell", levels: [10, 50, 150] },
  { code: "CORRE_FORREST", name: "Corre Forrest", description: "Salidas a correr (running o trail).", metric: "category_workouts", params: { categories: ["running", "trail_running"] }, iconKey: "run", levels: [5, 25, 75] },
  { code: "IMPARABLE", name: "Imparable", description: "Tu mejor racha de semanas cumpliendo tu objetivo.", metric: "best_goal_streak", params: {}, iconKey: "bolt", levels: [4, 8, 16] },
  { code: "EL_PIERNAS", name: "El Piernas", description: "Series de ejercicios de piernas.", metric: "muscle_sets", params: { groupKey: "legs", minPercentage: 30 }, iconKey: "leg", levels: [50, 250, 1000] },
  { code: "SIX_PACK", name: "Six Pack", description: "Series de ejercicios de core.", metric: "muscle_sets", params: { groupKey: "core", minPercentage: 30 }, iconKey: "abs", levels: [50, 250, 1000] },
  { code: "TODOTERRENO", name: "Todoterreno", description: "Tipos de actividad distintos que probaste.", metric: "distinct_categories", params: {}, iconKey: "compass", levels: [3, 5, 8] },
  { code: "MARATONISTA", name: "Maratonista", description: "Minutos totales entrenados.", metric: "total_minutes", params: {}, iconKey: "clock", levels: [600, 3000, 10000] },
  { code: "MADRUGADOR", name: "Madrugador", description: "Entrenamientos antes de las 8 de la mañana.", metric: "early_workouts", params: { beforeHour: 8 }, iconKey: "sunrise", levels: [5, 25, 75] },
] as const;
```

Los niveles se guardan como `BadgeLevel` con `level = índice + 1` y `threshold = valor`. Al hacer upsert hay que borrar los `BadgeLevel` que ya no existan, para que el seed sea idempotente.

Run: `npm run seed && npm run seed`. Expected: 9 badges y 28 niveles, sin duplicados.

- [ ] **Step 4: Commit**

```bash
git add src/server/badges/evaluate.ts src/server/badges/evaluate.test.ts prisma/seed/badges.ts
git commit -m "feat(badges): level evaluation and unified badge families"
```

---

### Task 3: Recálculo, persistencia y diff

**Files:**
- Create: `src/server/badges/recompute.ts`
- Create: `src/server/badges/queries.ts`
- Modify: `src/server/badges/index.ts` (reexporta las implementaciones reales)
- Test: `src/server/badges/recompute.int.test.ts`

**Interfaces:**
- Produce §5.6: `recomputeUserBadges(userId): Promise<BadgeChange[]>` y `getUserBadges(userId): Promise<UserBadgeView[]>`.

Reglas:
- Carga **todas** las actividades del usuario con la categoría, las series y los músculos de cada ejercicio, de una sola vez: `include` de `exercises → sets` y `exercise → muscles → muscle`.
- Hace un único upsert por insignia activa. `achievedAt` se actualiza solo cuando `level` cambia: si sube, `now`; si baja a 0, `null`; si baja a un nivel mayor que 0, `now`.
- Devuelve en `BadgeChange[]` las insignias donde cambió el nivel **o** el progreso. Esa lista se filtra en la UI: ver Task 4.
- Corre en una transacción con timeout de 15 s.

- [ ] **Step 1: Tests de integración**

1. El usuario nuevo con 1 entrenamiento de fuerza de 45 min recibe cambios solo en las insignias afectadas: `EL_PERSISTENTE` (progreso 0→1), `GYM_RAT` (0→1), `TODOTERRENO` (0→1) y `MARATONISTA` (0→45). `CORRE_FORREST` **no** aparece. Esto cubre el ítem "la pantalla post-entreno muestra insignias que no fueron afectadas".
2. Con 10 entrenamientos, `EL_PERSISTENTE` sube a nivel 1, con `levelBefore` 9→… y `levelAfter` 1, y setea `achievedAt`.
3. Si se borra uno con `prisma.activity.delete` y se recalcula, el nivel baja a 0 y `achievedAt` queda en `null`. Cubre el ítem "recálculo de insignias al borrar actividad".
4. Correrlo dos veces seguidas devuelve `[]` la segunda vez.
5. `getUserBadges` devuelve las 9 insignias, incluidas las de nivel 0, ordenadas por `sortOrder` y con `maxLevel`.

- [ ] **Step 2: Implementar.**
- [ ] **Step 3: Correr**

Run: `npm run test:int -- src/server/badges`. Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/server/badges
git commit -m "feat(badges): persisted recompute with change diff"
```

---

### Task 4: UI de insignias

**Files:**
- Create: `src/features/badges/BadgeIcon.tsx` (íconos SVG inline por `iconKey`; sin dependencias)
- Create: `src/features/badges/BadgeCard.tsx`
- Create: `src/features/badges/BadgeGrid.tsx`
- Create: `src/features/badges/BadgeChangeList.tsx`
- Create: `src/features/badges/levels.ts` (`romanLevel(n)` y tono por nivel: 1 bronce, 2 plata, 3+ oro)
- Test: `src/features/badges/levels.test.ts`
- Modify: `app/profile/page.tsx` (solo reemplazar la grilla vieja de awards por `<BadgeGrid badges={await getUserBadges(user.id)} />`; el rediseño del perfil es W2-4)

**Interfaces:**
- Produce:
  - `<BadgeGrid badges: UserBadgeView[] />`
  - `<BadgeCard badge: UserBadgeView />`
  - `<BadgeChangeList changes: BadgeChange[] />`

**Diseño:**
- **`BadgeCard`:**
  - Un círculo de 64 px con el ícono, más un anillo de progreso (SVG `stroke-dasharray`) hacia `nextThreshold`.
  - Debajo, el nombre y el nivel en romanos (I, II, III).
  - El color del anillo depende del nivel: `text-bronze`, `text-silver` o `text-gold`. Con nivel 0 se ve atenuado (`opacity-50`), con el texto "Bloqueada" y el progreso "3/10".
  - Al tocarla se abre un `Sheet` con la descripción, la lista de niveles con sus umbrales, el progreso actual y la fecha de logro.
- **`BadgeGrid`:** grilla de 3 columnas en mobile y 4 desde `sm:`.
- **`BadgeChangeList`:** para la pantalla post-entreno (W2-1).
  - Muestra **primero** las que subieron de nivel, como una tarjeta destacada con animación sutil (`animate-[pop_.4s_ease-out]`, definida con `@keyframes` en el propio componente con `<style>`; no se toca `globals.css`).
  - Después, como máximo 3 insignias que avanzaron sin subir de nivel, con una barra "+1 → 7/10".
  - Si `changes` está vacío, no se renderiza.

- [ ] **Step 1:** test de `romanLevel` (1→"I", 4→"IV") y del tono.
- [ ] **Step 2:** implementar los componentes. Agregar una sección "Insignias" al catálogo `/dev/ui`: es la única excepción permitida a la propiedad de W0-B. Va en el archivo `app/dev/ui/sections/badges.tsx`, importado desde el catálogo.
- [ ] **Step 3: Verificación manual (puerto 3012)**
  - El perfil muestra 9 insignias.
  - Después de cargar 10 entrenamientos con el script de abajo, "El Persistente I" aparece en bronce.
  - Al borrar uno, vuelve a "Bloqueada 9/10".
  - Script: crear `scripts/dev/create-workouts.ts` con `npx tsx scripts/dev/create-workouts.ts <email> <n>`, que usa `createActivity`.
- [ ] **Step 4: Commit**

```bash
git add src/features/badges app/profile app/dev/ui scripts/dev
git commit -m "feat(badges): badge grid, detail sheet and change list UI"
```

---

### Verificación final de W1-2
- [ ] `grep -rn "awardDefinition\|awardEarned\|evaluateAwardsForUser" app src` devuelve vacío.
- [ ] Gates verdes (`typecheck`, `lint`, `test`, `test:int`, `build`).
- [ ] Pedir review y merge a `rework/v2`.
