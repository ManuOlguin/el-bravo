# W2-4 — Home, perfil y stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leé primero `00-roadmap.md` (§4, §5, §6.2–6.3) y el skill `dataviz` antes de escribir gráficos.

**Goal:** una home que motive a entrenar (tu semana, tu racha, tu posición en cada grupo, novedades y un acceso rápido a registrar), un perfil propio y ajeno unificado, y una página de **Stats** nueva y accesible desde la navegación. Todo calculado con una sola fuente de estadísticas, timezone-aware y sin truncar datos, lo que corrige "semana activa muestra 1 menos".

**Architecture:**
- `src/server/stats/getUserStats(userId, tz)` arma las estadísticas personales: rachas, semanas, totales y récords. La parte de cálculo es pura, en `compute.ts`, y se prueba con unit tests.
- Las páginas son Server Components que componen secciones.
- Los gráficos son SVG simples hechos a mano, sin librería, siguiendo el skill `dataviz` y los tokens.

**Tech Stack:** RSC, `src/lib/time`, primitivas UI, `BadgeGrid` (W1-2), `ProfileView` (W1-4), `HomeFeed` (W2-3, si ya está mergeado; si no, un slot vacío).

**Spec:** `00-roadmap.md`. **Depende de:** W1-1, W1-2 y W1-4. **Rama:** `v2/w2-4-home`. Puerto 3024.

## Global Constraints
Ver `00-roadmap.md` §4.

---

### Task 1: Estadísticas personales (puro + query)

**Files:**
- Create: `src/server/stats/compute.ts`
- Create: `src/server/stats/getUserStats.ts`
- Test: `src/server/stats/compute.test.ts`

**Interfaces:**
- Produce:

```ts
export type StatsActivity = { id: string; startedAt: Date; durationMinutes: number; categoryId: string; categoryName: string; volumeKg: number; sets: number };
export type UserStats = {
  thisWeek: { weekKey: string; workouts: number; goal: number; days: { date: string; count: number }[] };
  currentStreakWeeks: number;   // semanas consecutivas cumpliendo el objetivo, terminando en la actual (si ya cumple) o en la anterior
  activeWeeksStreak: number;    // semanas consecutivas con ≥1 entrenamiento (lo que la home llamaba "semanas activas")
  bestStreakWeeks: number;
  perfectWeeks: number;         // total de semanas con objetivo cumplido
  totals: { workouts: number; minutes: number; volumeKg: number; sets: number };
  averages: { workoutsPerWeek: number; minutesPerWorkout: number };  // últimas 12 semanas
  longestWorkoutMinutes: number;
  weekly: { weekKey: string; workouts: number; minutes: number }[];  // últimas 12 semanas, con ceros
  byCategory: { categoryId: string; name: string; workouts: number; minutes: number }[];
  byWeekday: number[];          // lun..dom
  byMuscleGroup: { groupKey: string; sets: number }[];
  personalRecords: { exerciseId: string; exerciseName: string; bestWeightKg: number | null; bestReps: number | null; date: string }[]; // top 10 por peso
};
export function computeUserStats(activities: StatsActivity[], ctx: { tz: string; weeklyGoal: number; now: Date }): Omit<UserStats, "byMuscleGroup" | "personalRecords">;
export async function getUserStats(userId: string): Promise<UserStats>; // SIN take: todas las actividades
```

Tests obligatorios (cubren el bug de "1 semana menos"):
- 4 semanas consecutivas con actividad, incluida la actual, dan `activeWeeksStreak = 4`.
- **Un hueco** de una semana corta la racha: las semanas [x, x, -, x, x(actual)] dan 2. En v1 daba 4, porque contaba semanas distintas.
- Si la semana actual todavía no tiene actividad, **no** corta la racha: con [x, x, x, -(actual)] da 3.
- Domingo 23:30 AR cuenta para su semana en la zona AR, aunque el proceso corra en UTC o en Europe/Madrid. Para el test, setear `process.env.TZ = "Europe/Madrid"` en un `beforeAll` y restaurarlo después; ese es exactamente el escenario que producía N−1.
- `currentStreakWeeks` con objetivo 3 y las semanas [3, 3, 2(actual, en curso)] da 2.
- `weekly` devuelve 12 entradas aunque haya semanas sin actividad.

- [ ] **Step 1:** escribir los tests. Run → FAIL.
- [ ] **Step 2:** implementar `compute.ts` usando solo `src/lib/time`, y `getUserStats` con una query eficiente: actividades con categoría + series agregadas por ejercicio vía `groupBy`/`select` mínimo.
- [ ] **Step 3:** correr hasta PASS. `getUserStats` lleva un test de integración con 200 actividades que debe terminar en menos de 500 ms localmente.
- [ ] **Step 4: Commit**

```bash
git add src/server/stats
git commit -m "feat(stats): timezone-correct personal stats (fixes active weeks off-by-one)"
```

---

### Task 2: Home

**Files:**
- Rewrite: `app/home/page.tsx`
- Create en `src/features/home/`:
  - `Greeting.tsx`: "Hola, Manu" con un mensaje dinámico según el estado. Ejemplos: "Te falta 1 entrenamiento para cumplir la semana 💪", "¡Semana cumplida! 🔥 Racha de 4", "Arrancá la semana con todo". Reemplaza el texto fijo de v1.
  - `WeekProgress.tsx`: 7 círculos lun–dom con el día de hoy marcado, "2/3" y una barra de progreso.
  - `StreakCard.tsx`: racha actual de semanas cumplidas 🔥 y mejor racha.
  - `GroupStandingsStrip.tsx`: una tarjeta por grupo con temporada activa: "#2 en Temporada Verano · 340 pts · a 15 del #1", que linkea al grupo.
  - `QuickStart.tsx`: botón primario grande "Registrar entrenamiento" y, si hay rutinas, chips "Empezar <rutina>" para las 3 más usadas (→ live).
  - `HomeEmptyState.tsx`: para un usuario nuevo, pasos "1. Unite o creá un grupo · 2. Registrá tu primer entrenamiento · 3. Creá una rutina".
- Monta `HomeFeed` (W2-3) como sección "Novedades".
- Modify: `src/components/shell/nav-items.ts` (`stats.enabled = true` en Task 4).

Orden: `Greeting` → `QuickStart` → `WeekProgress` + `StreakCard` (lado a lado desde `sm:`) → `GroupStandingsStrip` → `HomeFeed`.

- [ ] **Step 1:** implementar.
- [ ] **Step 2:** verificar en 375 px con el usuario demo y con un usuario nuevo. Los números tienen que coincidir con `/stats` y con el grupo.
- [ ] **Step 3: Commit**

```bash
git add app/home src/features/home
git commit -m "feat(home): motivating home with week progress, streak, standings and feed"
```

---

### Task 3: Perfil (propio y ajeno)

**Files:**
- Rewrite: `src/features/profile/ProfileView.tsx` (la versión de W1-4 se rediseña; se mantienen las props y se agregan `stats?` e `isOwner`)
- Rewrite: `app/profile/page.tsx` → `ProfileView` con `isOwner`, que agrega el botón "Editar perfil" (→ `/settings/profile`) y la lista completa "Mis entrenamientos"
- Modify: `app/u/[id]/page.tsx` (si `id === viewer.id`, `redirect("/profile")`)
- Create: `src/features/profile/WorkoutHistory.tsx`: lista paginada de entrenamientos agrupados por mes. Cada ítem muestra fecha local, categoría, duración, series y volumen, **puntos ganados por temporada** (`getActivityPoints`; cubre el ítem 31), miniatura de foto y link a `/workout/[id]`.
- Create: `src/features/profile/ProfileHeader.tsx`, `src/features/profile/ProfileStatsRow.tsx`

Contenido de `ProfileView`:
- un header con avatar, nombre, bio, `FollowButton` (si no es el dueño) y contadores;
- la fila de stats: entrenamientos, racha 🔥, semanas cumplidas y horas totales;
- las insignias (`BadgeGrid`);
- para el dueño, un link "Ver mis stats →";
- los grupos (en común, si es ajeno);
- el historial: para el dueño, `WorkoutHistory`; para otros, las últimas 10 sin notas.

- [ ] **Step 1:** implementar. Borrar el código viejo de `app/profile/page.tsx` (751 líneas) y `app/profile/edit` si W1-4 no lo hizo.
- [ ] **Step 2:** verificar el perfil propio y el ajeno con 2 usuarios. El historial pagina y muestra puntos.
- [ ] **Step 3: Commit**

```bash
git add -A app/profile app/u src/features/profile
git commit -m "feat(profile): unified profile view with history and points per workout"
```

---

### Task 4: Página de Stats

**Files:**
- Create: `app/stats/page.tsx`
- Create en `src/features/stats/`:
  - `WeeklyBarChart.tsx`: barras de las últimas 12 semanas (entrenamientos), con una línea del objetivo semanal. SVG con `viewBox`, responsive y tooltip al tocar.
  - `CategoryBreakdown.tsx`: barras horizontales por categoría (minutos).
  - `WeekdayHeatmap.tsx`: 7 celdas lun–dom con intensidad por cantidad.
  - `MuscleBalance.tsx`: series por grupo muscular, con barras horizontales y la nota "Más volumen en …".
  - `PersonalRecords.tsx`: tabla de los mejores pesos por ejercicio, con fecha.
  - `StatsSummary.tsx`: `StatCard`s de totales y promedios.
- Modify: `src/components/shell/nav-items.ts` (`stats.enabled = true`)

Notas de diseño:
- Seguir el skill `dataviz`: un solo color de serie (`primary`), ejes mínimos y etiquetas legibles en 375 px.
- Los estados vacíos usan `EmptyState` con el texto "Registrá entrenamientos para ver tus stats".
- Hay un selector de rango con `Tabs` (4 semanas / 12 semanas / Todo) que afecta `weekly` y `byCategory`. Pasar `range` a `getUserStats`; se agrega un parámetro opcional sin romper la firma.

- [ ] **Step 1:** implementar.
- [ ] **Step 2:** verificar en 375 px y 1280 px con datos demo y con un usuario vacío. Los gráficos no se desbordan y los tooltips funcionan con touch.
- [ ] **Step 3: Commit**

```bash
git add app/stats src/features/stats src/components/shell/nav-items.ts
git commit -m "feat(stats): stats page with weekly chart, categories, weekday, muscles and PRs"
```

---

### Verificación final de W2-4
- [ ] Ítems cubiertos: 13 (diseño), 23, 24 y 31.
- [ ] `grep -rn "getWeekStart\|getWeekKey" app src` devuelve vacío (todas las copias viejas borradas).
- [ ] Gates verdes. Pedir review y merge.
