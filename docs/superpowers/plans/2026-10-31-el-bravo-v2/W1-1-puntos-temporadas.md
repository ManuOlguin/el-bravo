# W1-1 — Motor de puntos y temporadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Leé primero `00-roadmap.md` (§3 D1 y D3, §4, §5.4–5.5, §6.2).

**Goal:** reemplazar el sistema de puntos dependiente del orden por un motor puro y determinista que recalcula una temporada completa ante cualquier cambio. Además cubre premios de temporada, finalización idempotente (automática o manual) y acciones de temporada (crear/editar/unirse/salir/finalizar/publicar) que siempre recalculan.

**Architecture:**
- `computeSeasonScores` (puro, sin I/O) recibe la temporada, los miembros y las actividades, y devuelve las entradas de puntaje y las posiciones.
- `recomputeSeason` carga los datos, bloquea la fila de la temporada (`SELECT … FOR UPDATE`) y, en una transacción, reemplaza `ScoreEntry` y `SeasonStanding`.
- Todas las mutaciones (actividades vía `runActivityEffects`, acciones de temporada, cron) pasan por ahí.

**Tech Stack:** TypeScript puro, Prisma 7, Vitest.

**Spec:** `00-roadmap.md` (D1, D3). **Depende de:** W0-C. **Rama:** `v2/w1-1-scoring`. Puerto 3011. Preparar la DB con `npm run db:worktree -- w1-1 3011`.

## Global Constraints
Ver `00-roadmap.md` §4. No tocar `prisma/schema.prisma`. Reemplazar los stubs de `src/server/scoring/index.ts` **manteniendo los exports**.

---

### Task 1: Motor puro `computeSeasonScores`

**Files:**
- Create: `src/server/scoring/types.ts` (ya existe con `ScoringEffect`; agregar los tipos de abajo)
- Create: `src/server/scoring/compute.ts`
- Test: `src/server/scoring/compute.test.ts`

**Interfaces:**
- Produce:

```ts
export type SeasonRules = {
  startDate: string; endDate: string; timezone: string;      // LocalDate y tz del grupo
  weeklyGoal: number; minWorkoutMinutes: number; pointsPerWorkout: number;
  longSessionMinutes: number; longSessionBonus: number; weeklyGoalBonus: number;
  streakBonusStep: number; streakBonusCap: number;
  categoryWeights: Record<string, number>;                   // activityCategoryId → 0..2 (ausente = no cuenta)
};
export type ScoringActivity = { id: string; userId: string; activityCategoryId: string; startedAt: Date; durationMinutes: number };
export type ScoreLine = { userId: string; activityId: string | null; kind: "workout" | "weekly_goal" | "streak" | "award"; weekKey: string | null; points: number; reason: string | null; detail?: Record<string, unknown> };
export type UserWeek = { weekKey: string; workouts: number; target: number; goalMet: boolean; streak: number; finished: boolean };
export type UserTotals = { userId: string; points: number; workouts: number; minutes: number; weeksGoalMet: number; currentStreak: number; bestStreak: number; weeks: UserWeek[] };
export type SeasonScores = { lines: ScoreLine[]; totals: UserTotals[]; ranked: (UserTotals & { rank: number })[] };
export function computeSeasonScores(rules: SeasonRules, memberIds: string[], activities: ScoringActivity[], now: Date): SeasonScores;
export function rankTotals(totals: UserTotals[]): (UserTotals & { rank: number })[];
```

- [ ] **Step 1: Tests (cada regla de D1 tiene al menos un caso)**

`src/server/scoring/compute.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeSeasonScores, type SeasonRules, type ScoringActivity } from "./compute";
import { zonedToUtc } from "@/src/lib/time";

const TZ = "America/Argentina/Buenos_Aires";
const rules = (o: Partial<SeasonRules> = {}): SeasonRules => ({
  startDate: "2026-11-02", endDate: "2026-11-29", timezone: TZ, // 4 semanas lun 2/11 → dom 29/11
  weeklyGoal: 3, minWorkoutMinutes: 20, pointsPerWorkout: 10, longSessionMinutes: 60, longSessionBonus: 5,
  weeklyGoalBonus: 20, streakBonusStep: 5, streakBonusCap: 25,
  categoryWeights: { gym: 1, run: 1, yoga: 0.5 }, ...o,
});
let n = 0;
const act = (userId: string, date: string, time = "18:00", minutes = 45, cat = "gym"): ScoringActivity =>
  ({ id: `a${String(++n).padStart(4, "0")}`, userId, activityCategoryId: cat, startedAt: zonedToUtc(date, time, TZ), durationMinutes: minutes });
const AFTER = new Date("2026-12-15T12:00:00Z");
const sumFor = (r: ReturnType<typeof computeSeasonScores>, u: string) => r.totals.find((t) => t.userId === u)!.points;

describe("puntos por entrenamiento", () => {
  it("10 pts base; +5 si dura 60+; × peso de categoría", () => {
    const r = computeSeasonScores(rules(), ["u"], [act("u", "2026-11-02", "18:00", 45), act("u", "2026-11-03", "18:00", 60), act("u", "2026-11-04", "18:00", 60, "yoga")], AFTER);
    const w = r.lines.filter((l) => l.kind === "workout").map((l) => l.points);
    expect(w).toEqual([10, 15, 8]); // round(15*0.5)=8
  });
  it("no puntúa si dura menos del mínimo, si la categoría no está o si está fuera de fechas", () => {
    const r = computeSeasonScores(rules(), ["u"], [
      act("u", "2026-11-02", "18:00", 19), act("u", "2026-11-03", "18:00", 45, "swim"), act("u", "2026-11-30", "10:00", 45),
    ], AFTER);
    const w = r.lines.filter((l) => l.kind === "workout");
    expect(w.map((l) => l.points)).toEqual([0, 0]); // fuera de fechas no genera línea
    expect(w.map((l) => l.reason)).toEqual(["Duró menos de 20 min", "Esta actividad no cuenta en la temporada"]);
  });
  it("un solo entrenamiento puntuable por día local: el de más puntos", () => {
    const r = computeSeasonScores(rules(), ["u"], [act("u", "2026-11-02", "07:00", 30), act("u", "2026-11-02", "19:00", 70)], AFTER);
    const w = r.lines.filter((l) => l.kind === "workout");
    expect(w.map((l) => [l.points, l.reason])).toEqual([[0, "Ya sumaste un entrenamiento este día"], [15, null]]);
  });
  it("el día se calcula en la zona del grupo (domingo 23:30 AR no es lunes)", () => {
    const r = computeSeasonScores(rules(), ["u"], [act("u", "2026-11-08", "23:30"), act("u", "2026-11-09", "00:30")], AFTER);
    expect(r.lines.filter((l) => l.kind === "workout" && l.points > 0)).toHaveLength(2);
  });
});

describe("objetivo semanal y racha", () => {
  const week = (u: string, monday: string, k = 3) => Array.from({ length: k }, (_, i) => act(u, addD(monday, i)));
  function addD(d: string, i: number) { const t = new Date(d + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + i); return t.toISOString().slice(0, 10); }

  it("+20 por semana cumplida y racha +5, +10, +15 (tope 25)", () => {
    const acts = [...week("u", "2026-11-02"), ...week("u", "2026-11-09"), ...week("u", "2026-11-16"), ...week("u", "2026-11-23")];
    const r = computeSeasonScores(rules(), ["u"], acts, AFTER);
    expect(r.lines.filter((l) => l.kind === "weekly_goal").map((l) => l.points)).toEqual([20, 20, 20, 20]);
    expect(r.lines.filter((l) => l.kind === "streak").map((l) => l.points)).toEqual([5, 10, 15]);
    expect(sumFor(r, "u")).toBe(12 * 10 + 80 + 30);
    expect(r.totals[0]).toMatchObject({ weeksGoalMet: 4, bestStreak: 4, currentStreak: 4, workouts: 12 });
  });
  it("una semana sin cumplir corta la racha", () => {
    const acts = [...week("u", "2026-11-02"), ...week("u", "2026-11-09", 2), ...week("u", "2026-11-16"), ...week("u", "2026-11-23")];
    const r = computeSeasonScores(rules(), ["u"], acts, AFTER);
    expect(r.lines.filter((l) => l.kind === "streak").map((l) => l.points)).toEqual([5]);
    expect(r.totals[0]).toMatchObject({ bestStreak: 2, currentStreak: 2 });
  });
  it("semana parcial: objetivo = días de la semana dentro de la temporada", () => {
    const r = computeSeasonScores(rules({ startDate: "2026-11-07" }), ["u"], [act("u", "2026-11-07"), act("u", "2026-11-08")], AFTER);
    expect(r.totals[0].weeks[0]).toMatchObject({ weekKey: "2026-11-02", target: 2, goalMet: true });
  });
  it("la semana en curso no corta la racha", () => {
    const now = zonedToUtc("2026-11-17", "12:00", TZ); // martes de la 3ª semana
    const acts = [...week("u", "2026-11-02"), ...week("u", "2026-11-09"), act("u", "2026-11-16")];
    const r = computeSeasonScores(rules(), ["u"], acts, now);
    expect(r.totals[0].currentStreak).toBe(2);
    expect(r.totals[0].weeks.at(-1)).toMatchObject({ finished: false, goalMet: false });
    expect(r.totals[0].weeks).toHaveLength(3); // no inventa semanas futuras
  });
});

describe("miembros y ranking", () => {
  it("ignora actividades de no-miembros e incluye miembros sin actividad con 0", () => {
    const r = computeSeasonScores(rules(), ["u", "v"], [act("x", "2026-11-02")], AFTER);
    expect(r.totals.map((t) => [t.userId, t.points])).toEqual([["u", 0], ["v", 0]]);
  });
  it("ranking por puntos → semanas cumplidas → entrenamientos, empates comparten puesto", () => {
    const r = computeSeasonScores(rules(), ["a", "b", "c"], [act("a", "2026-11-02"), act("b", "2026-11-02")], AFTER);
    expect(r.ranked.map((t) => [t.userId, t.rank])).toEqual([["a", 1], ["b", 1], ["c", 3]]);
  });
  it("es determinista: el orden de entrada no cambia el resultado", () => {
    const acts = [act("u", "2026-11-02", "07:00", 30), act("u", "2026-11-02", "19:00", 70), act("u", "2026-11-03")];
    const a = computeSeasonScores(rules(), ["u"], acts, AFTER);
    const b = computeSeasonScores(rules(), ["u"], [...acts].reverse(), AFTER);
    expect(b).toEqual(a);
  });
});
```

Run: `npx vitest run src/server/scoring/compute`
Expected: FAIL.

- [ ] **Step 2: Implementación `src/server/scoring/compute.ts`**

```ts
import { localDateOf, weekKeyOfLocalDate, weekKeysBetween, daysInWeekWithin, addDays } from "@/src/lib/time";
import type { SeasonRules, ScoringActivity, ScoreLine, UserTotals, UserWeek, SeasonScores } from "./types";
export type { SeasonRules, ScoringActivity } from "./types";

const REASON = {
  short: (m: number) => `Duró menos de ${m} min`,
  category: "Esta actividad no cuenta en la temporada",
  sameDay: "Ya sumaste un entrenamiento este día",
};

function workoutPoints(r: SeasonRules, a: ScoringActivity, weight: number) {
  const base = r.pointsPerWorkout + (a.durationMinutes >= r.longSessionMinutes ? r.longSessionBonus : 0);
  return Math.round(base * weight);
}

export function computeSeasonScores(r: SeasonRules, memberIds: string[], activities: ScoringActivity[], now: Date): SeasonScores {
  const members = [...new Set(memberIds)].sort();
  const memberSet = new Set(members);
  const today = localDateOf(now, r.timezone);
  const lastDay = today < r.endDate ? today : r.endDate;
  const sorted = [...activities].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime() || a.id.localeCompare(b.id));

  const lines: ScoreLine[] = [];
  const totals: UserTotals[] = [];

  for (const userId of members) {
    const mine = sorted.filter((a) => a.userId === userId && memberSet.has(a.userId));
    const byDay = new Map<string, { a: ScoringActivity; pts: number }[]>();
    const userLines: ScoreLine[] = [];
    let minutes = 0;

    for (const a of mine) {
      const day = localDateOf(a.startedAt, r.timezone);
      if (day < r.startDate || day > r.endDate) continue;
      const weight = r.categoryWeights[a.activityCategoryId];
      const weekKey = weekKeyOfLocalDate(day);
      if (weight === undefined || weight <= 0) {
        userLines.push({ userId, activityId: a.id, kind: "workout", weekKey, points: 0, reason: REASON.category });
        continue;
      }
      if (a.durationMinutes < r.minWorkoutMinutes) {
        userLines.push({ userId, activityId: a.id, kind: "workout", weekKey, points: 0, reason: REASON.short(r.minWorkoutMinutes) });
        continue;
      }
      const list = byDay.get(day) ?? [];
      list.push({ a, pts: workoutPoints(r, a, weight) });
      byDay.set(day, list);
    }

    const countedByWeek = new Map<string, number>();
    for (const [day, list] of byDay) {
      const best = list.reduce((x, y) => (y.pts > x.pts ? y : x)); // empate → el primero (orden por startedAt)
      const weekKey = weekKeyOfLocalDate(day);
      for (const it of list) {
        const counted = it === best;
        userLines.push({ userId, activityId: it.a.id, kind: "workout", weekKey, points: counted ? it.pts : 0, reason: counted ? null : REASON.sameDay, detail: { durationMinutes: it.a.durationMinutes } });
      }
      countedByWeek.set(weekKey, (countedByWeek.get(weekKey) ?? 0) + 1);
      minutes += best.a.durationMinutes;
    }

    const weeks: UserWeek[] = [];
    let streak = 0, best = 0, weeksGoalMet = 0;
    for (const weekKey of lastDay >= r.startDate ? weekKeysBetween(r.startDate, lastDay) : []) {
      const target = Math.min(r.weeklyGoal, daysInWeekWithin(weekKey, r.startDate, r.endDate));
      const workouts = countedByWeek.get(weekKey) ?? 0;
      const goalMet = target > 0 && workouts >= target;
      const finished = addDays(weekKey, 6) < today || today > r.endDate; // domingo ya pasó, o la temporada terminó
      if (goalMet) {
        streak += 1; weeksGoalMet += 1; best = Math.max(best, streak);
        userLines.push({ userId, activityId: null, kind: "weekly_goal", weekKey, points: r.weeklyGoalBonus, reason: null });
        const bonus = Math.min((streak - 1) * r.streakBonusStep, r.streakBonusCap);
        if (bonus > 0) userLines.push({ userId, activityId: null, kind: "streak", weekKey, points: bonus, reason: null, detail: { streak } });
      } else if (finished) {
        streak = 0;
      }
      weeks.push({ weekKey, workouts, target, goalMet, streak, finished });
    }

    userLines.sort((x, y) => (x.weekKey ?? "").localeCompare(y.weekKey ?? "") || (x.kind === "workout" ? 0 : 1) - (y.kind === "workout" ? 0 : 1) || (x.activityId ?? "").localeCompare(y.activityId ?? ""));
    lines.push(...userLines);
    totals.push({
      userId, points: userLines.reduce((s, l) => s + l.points, 0), workouts: [...countedByWeek.values()].reduce((s, v) => s + v, 0),
      minutes, weeksGoalMet, currentStreak: streak, bestStreak: best, weeks,
    });
  }
  return { lines, totals, ranked: rankTotals(totals) };
}

export function rankTotals(totals: UserTotals[]) {
  const sorted = [...totals].sort((a, b) => b.points - a.points || b.weeksGoalMet - a.weeksGoalMet || b.workouts - a.workouts || a.userId.localeCompare(b.userId));
  let rank = 0;
  return sorted.map((t, i) => {
    const prev = sorted[i - 1];
    const tie = prev && prev.points === t.points && prev.weeksGoalMet === t.weeksGoalMet && prev.workouts === t.workouts;
    if (!tie) rank = i + 1; // competición estándar: 1, 1, 3
    return { ...t, rank };
  });
}
```

Mover los tipos de §Interfaces a `types.ts`. **Ojo:** en el test de "la semana en curso" la última semana no está terminada, así que no corta la racha: `currentStreak` queda en 2 aunque la semana tenga 1 entrenamiento.

Si algún caso falla, **corregir la implementación, no el test**, salvo que el test contradiga D1.

- [ ] **Step 3: Correr los tests**

Run: `npx vitest run src/server/scoring/compute`
Expected: PASS (12 tests).

- [ ] **Step 4: Commit**

```bash
git add src/server/scoring/compute.ts src/server/scoring/compute.test.ts src/server/scoring/types.ts
git commit -m "feat(scoring): deterministic pure season scoring engine"
```

---

### Task 2: Premios de temporada (puro)

**Files:**
- Create: `src/server/scoring/awards.ts`
- Test: `src/server/scoring/awards.test.ts`

**Interfaces:**
- Produce:

```ts
export const SEASON_AWARD_TYPES = ["most_workouts", "most_minutes", "best_streak", "longest_session", "most_categories", "perfect_attendance"] as const;
export type SeasonAwardType = (typeof SEASON_AWARD_TYPES)[number];
export const SEASON_AWARD_INFO: Record<SeasonAwardType, { name: string; description: string; icon: string; unit: string }>;
// name/description es-AR, por ej. most_workouts → { name: "El más constante", description: "Más entrenamientos puntuables", icon: "🏋️", unit: "entrenamientos" }
export function computeAwardWinners(type: SeasonAwardType, scores: SeasonScores, activities: ScoringActivity[], rules: SeasonRules): { userId: string; value: number }[];
```

Reglas:
- `most_workouts`: máximo de `totals.workouts`.
- `most_minutes`: máximo de `totals.minutes` (solo entrenamientos puntuables).
- `best_streak`: máximo de `bestStreak`.
- `longest_session`: la `durationMinutes` más alta entre los entrenamientos **puntuables**.
- `most_categories`: la mayor cantidad de categorías distintas entre los puntuables.
- `perfect_attendance`: todos los que tienen `weeksGoalMet` igual a la cantidad de semanas con objetivo > 0. Su `value` es esa cantidad.

En todos los casos ganan todos los empatados con el máximo. Si el máximo es 0, no hay ganadores.

- [ ] **Step 1:** tests de cada tipo, incluyendo empate (2 ganadores) y máximo 0 (sin ganadores). Para los fixtures, reusar los helpers `act`/`rules` del test de compute (moverlos a `src/server/scoring/test-helpers.ts`).
- [ ] **Step 2:** implementar.
- [ ] **Step 3:** `npx vitest run src/server/scoring`. Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add src/server/scoring
git commit -m "feat(scoring): season awards catalog and winners"
```

---

### Task 3: Recalcular y finalizar (I/O, transaccional, idempotente)

**Files:**
- Create: `src/server/scoring/recompute.ts`
- Create: `src/server/scoring/queries.ts`
- Create: `src/server/seasons/status.ts` (puro: `seasonStatus`)
- Modify: `src/server/scoring/index.ts` (reexporta las implementaciones reales; borra los stubs)
- Test: `src/server/seasons/status.test.ts`
- Test: `src/server/scoring/recompute.int.test.ts`

**Interfaces:**
- Produce (§5.5):
  - `recomputeSeason(seasonId)`, `recomputeSeasonsForChange(change)` y `finalizeSeason(seasonId, { publish })`.
  - `publishSeasonResults(seasonId)`, `getSeasonStandings(seasonId)` y `getActivityPoints(ids)`.
  - Además `seasonStatus(s: { startDate: string; endDate: string; finalizedAt: Date | null }, today: string): "upcoming" | "active" | "ended" | "finalized"`.

- [ ] **Step 1: `status.ts` + test**

```ts
export type SeasonStatus = "upcoming" | "active" | "ended" | "finalized";
export function seasonStatus(s: { startDate: string; endDate: string; finalizedAt: Date | null }, today: string): SeasonStatus {
  if (s.finalizedAt) return "finalized";
  if (today < s.startDate) return "upcoming";
  if (today <= s.endDate) return "active";
  return "ended";
}
```

El test cubre los 4 estados y los bordes (`today === startDate` da `active`, `today === endDate` da `active`).

- [ ] **Step 2: Tests de integración**

`src/server/scoring/recompute.int.test.ts` cubre:
1. `recomputeSeason` con 2 miembros y 4 actividades escribe `ScoreEntry` (una por línea) y `SeasonStanding` con `rank` correcto.
2. Correrlo dos veces deja el mismo resultado (sin duplicados).
3. **Borrar reprocesa todo:**
   - Con 3 semanas cumplidas seguidas, borrar una actividad de la semana 2 hace bajar el total.
   - La racha de la semana 3 pasa de +10 a 0, porque la racha se reinicia.
   - Confirma el ítem "que reprocese bien los puntos viejos cuando borro".
4. **Editar la temporada recalcula:**
   - Cambiar `weeklyGoal` de 3 a 2 + `recomputeSeason` hace que las semanas con 2 entrenamientos pasen a contar el bonus.
   - Cambiar el peso de una categoría a 0 deja sus actividades con 0 pts y la razón "no cuenta".
5. `recomputeSeasonsForChange` con una actividad `after` cuyo día cae en 2 temporadas de grupos distintos (el usuario es miembro de ambas):
   - Recalcula las dos.
   - Devuelve 2 `ScoringEffect` con `activityPoints`, `totalBefore`/`totalAfter` y `rankBefore`/`rankAfter`.
   - Para un cambio que mueve la fecha de una temporada a otra (`before` en T1, `after` en T2), recalcula ambas.
6. **Finalizar es idempotente:**
   - `finalizeSeason` **dos veces en paralelo** (`Promise.all`) crea los ganadores una sola vez, con `finalizedAt` seteado.
   - Las `ScoreEntry` de premios (kind `award`) se crean solo si `bonusPoints > 0`.
7. Después de `finalizedAt`, `recomputeSeason` **no** cambia nada (resultados congelados), salvo con `{ force: true }`, que es la opción para "reabrir" (solo admin).
8. Una temporada con `resultsReveal: "manual"`:
   - `finalizeSeason(id, { publish: false })` deja `resultsPublishedAt = null`.
   - `publishSeasonResults` lo setea.

Fixtures:
- Grupo con `timezone` AR, temporada con `startDate`/`endDate` vía `localDateToDbDate` y `SeasonCategory`.
- Actividades creadas con `prisma.activity.create` directo (no a través del servicio, para aislar).

Run: `npm run test:int -- src/server/scoring`
Expected: FAIL.

- [ ] **Step 3: `recompute.ts`**

Puntos clave de la implementación:

```ts
import "server-only";
import { prisma } from "@/src/lib/db";
import { dbDateToLocalDate, localDateOf } from "@/src/lib/time";
import { computeSeasonScores } from "./compute";
import { computeAwardWinners, SEASON_AWARD_TYPES, type SeasonAwardType } from "./awards";
import type { ActivityChange } from "@/src/server/activities/effects";
import type { ScoringEffect } from "./types";

async function loadSeasonInput(tx: typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0], seasonId: string) {
  const s = await tx.season.findUniqueOrThrow({
    where: { id: seasonId },
    include: { group: { select: { timezone: true, name: true } }, categories: true, members: { where: { leftAt: null }, select: { userId: true } }, awards: true },
  });
  const rules = {
    startDate: dbDateToLocalDate(s.startDate), endDate: dbDateToLocalDate(s.endDate), timezone: s.group.timezone,
    weeklyGoal: s.weeklyGoal, minWorkoutMinutes: s.minWorkoutMinutes, pointsPerWorkout: s.pointsPerWorkout,
    longSessionMinutes: s.longSessionMinutes, longSessionBonus: s.longSessionBonus, weeklyGoalBonus: s.weeklyGoalBonus,
    streakBonusStep: s.streakBonusStep, streakBonusCap: s.streakBonusCap,
    categoryWeights: Object.fromEntries(s.categories.map((c) => [c.activityCategoryId, Number(c.weight)])),
  };
  const memberIds = s.members.map((m) => m.userId);
  // margen de ±1 día en UTC para cubrir la zona horaria; compute filtra por día local
  const from = new Date(s.startDate.getTime() - 86_400_000), to = new Date(s.endDate.getTime() + 2 * 86_400_000);
  const activities = await tx.activity.findMany({
    where: { userId: { in: memberIds }, startedAt: { gte: from, lt: to } },
    select: { id: true, userId: true, activityCategoryId: true, startedAt: true, durationMinutes: true },
  });
  return { season: s, rules, memberIds, activities };
}
```

- **`recomputeSeason(seasonId, opts?: { force?: boolean; now?: Date })`:**
  1. Dentro de `prisma.$transaction(..., { timeout: 15000 })`, bloquear la fila de la temporada:
     ```ts
     await tx.$queryRaw`SELECT id FROM \`Season\` WHERE id = ${seasonId} FOR UPDATE`;
     ```
  2. Si `finalizedAt && !force`, termina sin hacer nada.
  3. Carga el input y corre `computeSeasonScores`.
  4. Borra con `deleteMany` las `ScoreEntry` cuyo kind **no** es `award` y todos los `SeasonStanding`.
  5. Hace `createMany` de las líneas y de los `ranked`.
  6. Setea `lastComputedAt`.
- **`recomputeSeasonsForChange(change)`:**
  1. Calcula las temporadas candidatas: las de los grupos donde el usuario es `SeasonMember` sin `leftAt` y cuyo rango cubre la fecha local de `before` o de `after`, con la zona horaria de cada grupo.
  2. Para cada una, **antes** de recalcular lee el standing del usuario (`totalBefore`, `rankBefore`).
  3. Llama a `recomputeSeason`.
  4. Lee de nuevo el standing y la `ScoreEntry` de esa actividad (kind `workout`).
  5. Arma el `ScoringEffect`. Si la temporada está finalizada, la saltea: no se recalcula.
- **`finalizeSeason(seasonId, { publish })`:**
  1. En una transacción con `FOR UPDATE`, si `finalizedAt` ya está seteado, retorna.
  2. Si no, recalcula **dentro de la misma transacción**. Para eso, extraer `recomputeWithin(tx, seasonId, now)` y usarlo tanto desde `recomputeSeason` como desde acá.
  3. Para cada `SeasonAward` calcula los ganadores, crea `SeasonAwardWinner` y, si `bonusPoints > 0`, una `ScoreEntry` kind `award` por ganador.
  4. Recalcula los standings sumando los puntos de premios, con `rankTotals` sobre los totales + los bonus.
  5. Setea `finalizedAt = now` y, si `publish`, `resultsPublishedAt = now`.
- **`publishSeasonResults(seasonId)`:** setea `resultsPublishedAt` si está `null`.

`queries.ts`:
- `getSeasonStandings` hace join con el usuario (`name`, `photoUrl`) y ordena por `rank`.
- `getActivityPoints` agrupa las `ScoreEntry` kind `workout` por `activityId`.

- [ ] **Step 4: `index.ts`** reexporta todo y elimina los stubs.

Run: `npm run test:int -- src/server/scoring && npx vitest run src/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/scoring src/server/seasons
git commit -m "feat(scoring): transactional recompute, finalize and publish"
```

---

### Task 4: Acciones de temporada + cron

**Files:**
- Create: `src/schemas/season.ts`
- Create: `src/server/actions/seasons.ts`
- Create: `app/api/cron/seasons/route.ts`
- Delete: `app/api/seasons/**`, `app/api/groups/[id]/seasons/route.ts` (después de migrar sus consumidores; ver Step 4)
- Test: `src/schemas/season.test.ts`
- Test: `src/server/actions/seasons.int.test.ts`

**Interfaces:**
- Produce (las consume W2-2):

```ts
// src/schemas/season.ts
export const seasonInputSchema; // { groupId, name, description?, startDate: LocalDate, endDate: LocalDate (≥ start, ≤ start+365d),
                                //   weeklyGoal 1..7, minWorkoutMinutes 5..180, resultsReveal: "auto"|"manual",
                                //   categories: { activityCategoryId, weight 0..2 step .25 }[] (≥1 con weight>0),
                                //   awards: { awardType: SeasonAwardType, bonusPoints 0..200 }[],
                                //   rules?: { pointsPerWorkout, longSessionMinutes, longSessionBonus, weeklyGoalBonus, streakBonusStep, streakBonusCap } (opcional, avanzado) }
export type SeasonInput = z.infer<typeof seasonInputSchema>;

// src/server/actions/seasons.ts  ("use server")
export async function createSeasonAction(input: SeasonInput): Promise<ActionResult<{ seasonId: string }>>;
export async function updateSeasonAction(seasonId: string, input: SeasonInput): Promise<ActionResult<void>>;   // recalcula
export async function deleteSeasonAction(seasonId: string): Promise<ActionResult<void>>;
export async function joinSeasonAction(seasonId: string): Promise<ActionResult<void>>;     // recalcula
export async function leaveSeasonAction(seasonId: string): Promise<ActionResult<void>>;    // recalcula
export async function finalizeSeasonAction(seasonId: string): Promise<ActionResult<void>>; // admin; publish según resultsReveal
export async function publishSeasonResultsAction(seasonId: string): Promise<ActionResult<void>>; // admin
export async function reopenSeasonAction(seasonId: string): Promise<ActionResult<void>>;   // admin: borra finalizedAt/ganadores/premios y recalcula
export async function ensureSeasonFinalizedIfDue(seasonId: string): Promise<void>; // para la página: si ended && auto → finalize(publish)
```

Reglas de negocio (con tests de integración):
- Solo un admin (`requireGroupAdmin`) crea, edita, borra, finaliza, publica o reabre. Unirse y salir requiere ser miembro del grupo.
- **No puede haber temporadas superpuestas** en el mismo grupo, ni al crear ni al editar (hoy update no lo valida).
- Editar una temporada `finalized` no está permitido: hay que reabrirla primero.
- Las fechas ya pasadas de una temporada activa sí se pueden editar, porque el recálculo las cubre. Se guarda el input con `localDateToDbDate`.
- Al crear, el creador queda como `SeasonMember` automáticamente.
- Al unirse a una temporada `ended` o `finalized`, el error es "La temporada ya terminó".
- Todas las acciones usan `runAction` y `parseInput`, y llaman a `revalidatePath(\`/group/${groupId}\`)`.
- El cron `GET /api/cron/seasons` requiere `Authorization: Bearer ${CRON_SECRET}` (401 si no lo trae). Busca temporadas `ended` según la zona horaria de su grupo, con `resultsReveal=auto` y `finalizedAt=null`, y las finaliza publicando. Agregar `CRON_SECRET` a `.env.example`.

- [ ] **Step 1:** tests del schema (superposición de fechas, pesos fuera de rango y la regla de "al menos una categoría con peso > 0").
- [ ] **Step 2:** tests de integración de las acciones. Mockear `next/cache` con `vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))` y mockear `getSession` para inyectar el usuario.
- [ ] **Step 3:** implementar.
- [ ] **Step 4: Migrar los consumidores** del puente de W0-C (`app/group/[id]/create-season/page.tsx`, `src/components/EditSeasonForm.tsx`, `DeleteSeasonButton` y los botones de unirse/finalizar en `GroupPageClient.tsx`) para que llamen a las acciones nuevas en lugar de `fetch("/api/seasons/...")`. **Solo el cableado**, sin rediseño (es de W2-2): cada botón pasa a usar `<Button pending>` + `toastResult`. Después borrar `app/api/seasons/**`.
- [ ] **Step 5:** `npm run typecheck && npm run lint && npm test && npm run test:int && npm run build`.
- [ ] **Step 6: Commit**

```bash
git add -A src/schemas/season.ts src/server/actions/seasons.ts app/api/cron app/api/seasons app/group src/components .env.example
git commit -m "feat(seasons): season server actions with recompute, finalize/publish and cron"
```

---

### Task 5: Conectar la página de grupo al motor nuevo (puente)

**Files:**
- Modify: `app/group/[id]/page.tsx`: el leaderboard sale de `getSeasonStandings`; antes de leer, `await ensureSeasonFinalizedIfDue(activeOrLastSeason.id)`.
- Modify: `app/group/[id]/GroupPageClient.tsx`: mostrar `points`, `weeksGoalMet` y `currentStreak` de `StandingRow` en "Tu posición" y en la lista de miembros, ordenada por `rank`.

- [ ] **Step 1:** implementar el cableado mínimo. Sin rediseño (W2-2).
- [ ] **Step 2: Verificación manual (puerto 3011)**
  - Con 2 usuarios en una temporada, cargar 3 entrenamientos en una semana para uno: el ranking muestra 30 + 20 = 50.
  - Borrar uno: vuelve a 20 y la semana deja de estar cumplida.
  - Editar la temporada a objetivo 2: vuelve a 40.
- [ ] **Step 3: Commit**

```bash
git add app/group
git commit -m "feat(group): read standings from the new scoring engine"
```

---

### Verificación final de W1-1
- [ ] Toda la lógica de puntos vive en `src/server/scoring` y está cubierta por tests (unitarios + integración).
- [ ] `grep -rn "scoreEvent\|seasonWeekProgress\|calculateActivityScore" app src` devuelve vacío.
- [ ] Gates verdes. Pedir review y merge a `rework/v2` (primer merge de la Ola 1).
