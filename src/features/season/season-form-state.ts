/**
 * Estado puro del formulario de temporada (W2-2 Task 3): valores iniciales, presets de pesos,
 * validación (Zod de W1-1 + superposición de fechas) y conversión a `SeasonInput`.
 * Los puntos de ejemplo salen de `dayPoints` del motor (src/server/scoring/compute.ts): nada se calcula acá.
 */
import { addDays, weekKeyOfLocalDate } from "@/src/lib/time";
import { dayPoints } from "@/src/server/scoring/compute";
import { SEASON_AWARD_TYPES, type SeasonAwardType } from "@/src/server/scoring/awards";
import { rangesOverlap, seasonInputSchema, type SeasonInput } from "@/src/schemas/season";
import { DEFAULT_RULES, scoringRulesOf, type SeasonRulesView, type SeasonSummary } from "./types";

export type CategoryOption = { id: string; slug: string; name: string };
export type CategoryDraft = { enabled: boolean; weight: number };
export type AwardDraft = { enabled: boolean; bonusPoints: number | null };

export const ADVANCED_RULE_KEYS = [
  "dayBasePoints",
  "timePointsFactor",
  "timeCurveMinutes",
  "maxDailyMinutes",
  "weeklyGoalBonus",
  "streakBonusStep",
  "streakBonusCap",
] as const;
export type AdvancedRuleKey = (typeof ADVANCED_RULE_KEYS)[number];
export type RulesDraft = Record<AdvancedRuleKey, number | null>;

export type SeasonFormState = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  weeklyGoal: number | null;
  minDailyMinutes: number | null;
  resultsReveal: "auto" | "manual";
  categories: Record<string, CategoryDraft>; // por activityCategoryId
  awards: Record<SeasonAwardType, AwardDraft>;
  rules: RulesDraft;
};

/** Premios preseleccionados al crear: "El más constante" y "Racha de hierro". */
export const DEFAULT_AWARDS: SeasonAwardType[] = ["most_days", "best_streak"];
export const DEFAULT_SEASON_DAYS = 28;

export const WEIGHT_MIN = 0.25;
export const WEIGHT_MAX = 2;
export const WEIGHT_STEP = 0.25;

export type PresetId = "equal" | "gym" | "cardio";
export const PRESETS: { id: PresetId; label: string }[] = [
  { id: "equal", label: "Todo vale igual" },
  { id: "gym", label: "Solo gimnasio" },
  { id: "cardio", label: "Más puntos al cardio" },
];
export const GYM_SLUGS = new Set(["strength", "calisthenics", "crossfit", "hiit_functional"]);
export const CARDIO_SLUGS = new Set(["running", "trail_running", "cycling", "indoor_cycling", "swimming", "rowing", "elliptical", "walking_trekking"]);
export const CARDIO_WEIGHT = 1.5;

export const RULE_FIELDS: Record<AdvancedRuleKey, { label: string; hint: string; min: number; max: number; suffix?: string }> = {
  dayBasePoints: { label: "Puntos por día entrenado", hint: "Lo que suma presentarte.", min: 0, max: 100, suffix: "pts" },
  timePointsFactor: { label: "Puntos por tiempo", hint: "Cuánto pesa el tiempo en el día.", min: 0, max: 100 },
  timeCurveMinutes: { label: "Curva de tiempo", hint: "Más alto = el tiempo rinde más parejo.", min: 1, max: 600, suffix: "min" },
  maxDailyMinutes: { label: "Tope de minutos por día", hint: "Lo que pasa de acá no suma.", min: 1, max: 1440, suffix: "min" },
  weeklyGoalBonus: { label: "Bonus por semana cumplida", hint: "", min: 0, max: 500, suffix: "pts" },
  streakBonusStep: { label: "Extra por semana de racha", hint: "", min: 0, max: 100, suffix: "pts" },
  streakBonusCap: { label: "Tope del extra por racha", hint: "", min: 0, max: 500, suffix: "pts" },
};

function defaultRules(): RulesDraft {
  return Object.fromEntries(ADVANCED_RULE_KEYS.map((k) => [k, DEFAULT_RULES[k]])) as RulesDraft;
}

function emptyAwards(selected: SeasonAwardType[] = []): Record<SeasonAwardType, AwardDraft> {
  return Object.fromEntries(SEASON_AWARD_TYPES.map((t) => [t, { enabled: selected.includes(t), bonusPoints: 0 }])) as Record<SeasonAwardType, AwardDraft>;
}

/** Inicio sugerido: hoy si es lunes, si no el lunes que viene. */
export function suggestedStart(today: string): string {
  const monday = weekKeyOfLocalDate(today);
  return monday === today ? today : addDays(monday, 7);
}

export function initialSeasonForm(categories: CategoryOption[], today: string): SeasonFormState {
  const start = suggestedStart(today);
  return {
    name: "",
    description: "",
    startDate: start,
    endDate: addDays(start, DEFAULT_SEASON_DAYS - 1),
    weeklyGoal: DEFAULT_RULES.weeklyGoal,
    minDailyMinutes: DEFAULT_RULES.minDailyMinutes,
    resultsReveal: "auto",
    categories: Object.fromEntries(categories.map((c) => [c.id, { enabled: true, weight: 1 }])),
    awards: emptyAwards(DEFAULT_AWARDS),
    rules: defaultRules(),
  };
}

/** Estado para editar una temporada existente. Las categorías que no estaban quedan apagadas (×1 si se prenden). */
export function seasonFormFromSummary(s: SeasonSummary, categories: CategoryOption[]): SeasonFormState {
  const weights = new Map(s.categories.map((c) => [c.id, c.weight]));
  const awards = emptyAwards();
  for (const a of s.awards) awards[a.awardType] = { enabled: true, bonusPoints: a.bonusPoints };
  return {
    name: s.name,
    description: s.description ?? "",
    startDate: s.startDate,
    endDate: s.endDate,
    weeklyGoal: s.rules.weeklyGoal,
    minDailyMinutes: s.rules.minDailyMinutes,
    resultsReveal: s.resultsReveal,
    categories: Object.fromEntries(
      categories.map((c) => {
        const w = weights.get(c.id);
        return [c.id, w !== undefined && w > 0 ? { enabled: true, weight: w } : { enabled: false, weight: 1 }];
      })
    ),
    awards,
    rules: Object.fromEntries(ADVANCED_RULE_KEYS.map((k) => [k, s.rules[k]])) as RulesDraft,
  };
}

export function applyPreset(state: SeasonFormState, preset: PresetId, categories: CategoryOption[]): SeasonFormState {
  const next: Record<string, CategoryDraft> = {};
  for (const c of categories) {
    if (preset === "equal") next[c.id] = { enabled: true, weight: 1 };
    else if (preset === "gym") next[c.id] = { enabled: GYM_SLUGS.has(c.slug), weight: 1 };
    else next[c.id] = { enabled: true, weight: CARDIO_SLUGS.has(c.slug) ? CARDIO_WEIGHT : 1 };
  }
  return { ...state, categories: next };
}

/** Preset que coincide exactamente con el estado actual (para marcar el chip), o null. */
export function activePreset(state: SeasonFormState, categories: CategoryOption[]): PresetId | null {
  for (const p of PRESETS) {
    const applied = applyPreset(state, p.id, categories).categories;
    if (categories.every((c) => {
      const a = applied[c.id];
      const b = state.categories[c.id];
      return !!b && a.enabled === b.enabled && (!a.enabled || a.weight === b.weight);
    })) return p.id;
  }
  return null;
}

/** Peso redondeado al paso del slider y dentro del rango. */
export function clampWeight(w: number): number {
  const stepped = Math.round(w / WEIGHT_STEP) * WEIGHT_STEP;
  return Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, stepped));
}

const num = (v: number | null) => (v === null ? Number.NaN : v);

export function toSeasonInput(state: SeasonFormState, groupId: string): SeasonInput {
  return {
    groupId,
    name: state.name.trim(),
    description: state.description.trim() || null,
    startDate: state.startDate,
    endDate: state.endDate,
    weeklyGoal: num(state.weeklyGoal),
    minDailyMinutes: num(state.minDailyMinutes),
    resultsReveal: state.resultsReveal,
    categories: Object.entries(state.categories)
      .filter(([, c]) => c.enabled)
      .map(([activityCategoryId, c]) => ({ activityCategoryId, weight: c.weight })),
    awards: SEASON_AWARD_TYPES.filter((t) => state.awards[t].enabled).map((awardType) => ({
      awardType,
      bonusPoints: state.awards[awardType].bonusPoints ?? 0,
    })),
    rules: Object.fromEntries(ADVANCED_RULE_KEYS.map((k) => [k, num(state.rules[k])])) as Record<AdvancedRuleKey, number>,
  };
}

export type FormErrors = Record<string, string>;

/**
 * Traduce rutas de issues de Zod (las mismas que devuelve la acción en `fieldErrors`) a claves del formulario:
 * `awards.<i>.bonusPoints` → `award.<tipo>`; `rules.<k>` queda igual; `categories.*` → `categories`.
 */
export function mapFieldErrors(fieldErrors: Record<string, string[]>, state: SeasonFormState): FormErrors {
  const enabledAwards = SEASON_AWARD_TYPES.filter((t) => state.awards[t].enabled);
  const out: FormErrors = {};
  for (const [path, messages] of Object.entries(fieldErrors)) {
    const msg = messages[0];
    if (!msg) continue;
    const parts = path.split(".");
    let key = path;
    if (parts[0] === "awards" && parts.length >= 2 && /^\d+$/.test(parts[1])) key = `award.${enabledAwards[Number(parts[1])] ?? ""}`;
    else if (parts[0] === "awards") key = "awards";
    else if (parts[0] === "categories") key = "categories";
    out[key] ??= msg;
  }
  return out;
}

/** Valida como lo haría la acción, más la superposición con las otras temporadas del grupo. */
export function validateSeasonForm(
  state: SeasonFormState,
  groupId: string,
  others: { name: string; startDate: string; endDate: string }[]
): { ok: true; input: SeasonInput } | { ok: false; errors: FormErrors } {
  const input = toSeasonInput(state, groupId);
  const parsed = seasonInputSchema.safeParse(input);
  const errors: FormErrors = {};
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) (fieldErrors[issue.path.map(String).join(".") || "_"] ??= []).push(issue.message);
    Object.assign(errors, mapFieldErrors(fieldErrors, state));
  }
  if (!errors.startDate && !errors.endDate && state.startDate <= state.endDate) {
    const clash = others.find((o) => rangesOverlap(o, { startDate: state.startDate, endDate: state.endDate }));
    if (clash) errors.startDate = `Las fechas se superponen con la temporada "${clash.name}"`;
  }
  if (Object.keys(errors).length || !parsed.success) return { ok: false, errors };
  return { ok: true, input: parsed.data };
}

/** Reglas efectivas para mostrar puntos de ejemplo (un campo vacío usa el valor por defecto). */
export function previewRules(state: SeasonFormState): SeasonRulesView {
  const r = { ...DEFAULT_RULES };
  for (const k of ADVANCED_RULE_KEYS) if (state.rules[k] !== null && Number.isFinite(state.rules[k])) r[k] = state.rules[k] as number;
  if (state.weeklyGoal !== null) r.weeklyGoal = state.weeklyGoal;
  if (state.minDailyMinutes !== null) r.minDailyMinutes = state.minDailyMinutes;
  return r;
}

/** Puntos de un día de `minutes` minutos reales de una categoría (con su peso) según el formulario. */
export function previewDayPoints(state: SeasonFormState, minutes: number, categoryId?: string): number {
  const c = categoryId ? state.categories[categoryId] : undefined;
  const weight = categoryId ? (c?.enabled ? c.weight : 0) : 1;
  return dayPoints(scoringRulesOf(previewRules(state)), minutes * weight);
}

const LABELS: Record<number, string> = { 30: "30 min", 45: "45 min", 60: "1 h", 120: "2 h", 180: "3 h" };

/** "Un día de 45 min = 23 pts · 1 h = 26 · 2 h = 33 · Semana cumplida = +20" */
export function summaryLine(state: SeasonFormState): string {
  const r = previewRules(state);
  return `Un día de 45 min = ${previewDayPoints(state, 45)} pts · 1 h = ${previewDayPoints(state, 60)} · 2 h = ${previewDayPoints(state, 120)} · Semana cumplida = +${r.weeklyGoalBonus}`;
}

/** Mini tabla "Tu día → puntos". */
export function previewTable(state: SeasonFormState, minutes: number[] = [30, 60, 120, 180]): { label: string; points: number }[] {
  return minutes.map((m) => ({ label: LABELS[m] ?? `${m} min`, points: previewDayPoints(state, m) }));
}
