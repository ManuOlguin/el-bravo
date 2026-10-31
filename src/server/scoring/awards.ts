/**
 * Premios de temporada (roadmap D3). Catálogo en código; puro.
 * Los clásicos salen de los totales del puntaje. Los divertidos (músculos, horarios, deportes, social)
 * necesitan además un `AwardContext` con datos por actividad (series por grupo muscular, kilos, fotos,
 * categoría) y las reacciones; `recompute.ts` lo carga solo si la temporada tiene alguno de esos premios.
 */
import { addDays, daysInWeekWithin, localDateOf, localTimeOf, weekKeyOfLocalDate, weekKeysBetween } from "@/src/lib/time";
import type { ScoringActivity, SeasonRules, SeasonScores, UserTotals } from "./types";

export const SEASON_AWARD_TYPES = [
  // Clásicos
  "most_days",
  "most_minutes",
  "best_streak",
  "longest_session",
  "most_categories",
  "perfect_attendance",
  // Músculos
  "legs",
  "arms",
  "core",
  "chest",
  "back",
  "shoulders",
  "volume",
  // Horarios
  "early_bird",
  "night_owl",
  "weekend",
  "monday",
  "last_minute",
  "double_shift",
  // Deportes
  "running",
  "cycling",
  "swimming",
  "yoga",
  "gym_rat",
  // Social
  "influencer",
  "popular",
  "fan",
  // De la vergüenza
  "ghost",
] as const;
export type SeasonAwardType = (typeof SEASON_AWARD_TYPES)[number];

export type AwardGroup = "classic" | "muscles" | "schedule" | "sports" | "social" | "shame";
export const AWARD_GROUPS: { id: AwardGroup; label: string }[] = [
  { id: "classic", label: "Clásicos" },
  { id: "muscles", label: "💪 Músculos" },
  { id: "schedule", label: "⏰ Horarios" },
  { id: "sports", label: "🏅 Deportes" },
  { id: "social", label: "💬 Social" },
  { id: "shame", label: "👻 De la vergüenza" },
];

export type AwardInfo = {
  name: string;
  description: string;
  icon: string;
  unit: string;
  group: AwardGroup;
  /** Cómo mostrar el valor ganador. */
  format?: "minutes" | "kg";
  /** Premio "de la vergüenza": no suma puntos extra aunque el admin los cargue. */
  shame?: boolean;
};

export const SEASON_AWARD_INFO: Record<SeasonAwardType, AwardInfo> = {
  most_days: { name: "El más constante", description: "Más días entrenados", icon: "📅", unit: "días", group: "classic" },
  most_minutes: { name: "Incansable", description: "Más minutos entrenados", icon: "⏱️", unit: "min", group: "classic", format: "minutes" },
  best_streak: { name: "Racha de hierro", description: "Mejor racha de semanas cumplidas", icon: "🔥", unit: "semanas", group: "classic" },
  longest_session: { name: "Maratonista", description: "Entrenamiento más largo", icon: "🏃", unit: "min", group: "classic", format: "minutes" },
  most_categories: { name: "Todoterreno", description: "Más tipos de actividad distintos", icon: "🧭", unit: "categorías", group: "classic" },
  perfect_attendance: { name: "Asistencia perfecta", description: "Cumplió el objetivo todas las semanas", icon: "🏅", unit: "semanas", group: "classic" },

  legs: { name: "El Piernas", description: "Más series de piernas", icon: "🦵", unit: "series", group: "muscles" },
  arms: { name: "Brazos de Popeye", description: "Más series de brazos", icon: "💪", unit: "series", group: "muscles" },
  core: { name: "Six Pack", description: "Más series de abdominales y core", icon: "🍫", unit: "series", group: "muscles" },
  chest: { name: "Pecho Paloma", description: "Más series de pecho", icon: "🐦", unit: "series", group: "muscles" },
  back: { name: "El Ropero", description: "Más series de espalda", icon: "🚪", unit: "series", group: "muscles" },
  shoulders: { name: "Hombros de Atlas", description: "Más series de hombros", icon: "🌍", unit: "series", group: "muscles" },
  volume: { name: "Mueve Montañas", description: "Más kilos levantados (peso × repeticiones)", icon: "🏔️", unit: "kg", group: "muscles", format: "kg" },

  early_bird: { name: "El Gallo", description: "Más entrenamientos antes de las 8 de la mañana", icon: "🐓", unit: "entrenamientos", group: "schedule" },
  night_owl: { name: "El Búho", description: "Más entrenamientos desde las 21", icon: "🦉", unit: "entrenamientos", group: "schedule" },
  weekend: { name: "Fiebre de Finde", description: "Más entrenamientos el sábado y el domingo", icon: "🍻", unit: "entrenamientos", group: "schedule" },
  monday: { name: "Lunes Sagrado", description: "Más lunes entrenados", icon: "🙏", unit: "lunes", group: "schedule" },
  last_minute: { name: "Último Minuto", description: "Más semanas salvadas entrenando el domingo", icon: "⏳", unit: "semanas", group: "schedule" },
  double_shift: { name: "Doble Turno", description: "Más días con dos actividades o más", icon: "🔁", unit: "días", group: "schedule" },

  running: { name: "Forrest Gump", description: "Más minutos corriendo", icon: "🏃‍♂️", unit: "min", group: "sports", format: "minutes" },
  cycling: { name: "Pedal de Oro", description: "Más minutos en bici", icon: "🚴", unit: "min", group: "sports", format: "minutes" },
  swimming: { name: "El Tiburón", description: "Más minutos nadando", icon: "🦈", unit: "min", group: "sports", format: "minutes" },
  yoga: { name: "Modo Zen", description: "Más minutos de yoga o pilates", icon: "🧘", unit: "min", group: "sports", format: "minutes" },
  gym_rat: { name: "Rata de Gimnasio", description: "Más sesiones de fuerza, calistenia, crossfit o funcional", icon: "🐀", unit: "sesiones", group: "sports" },

  influencer: { name: "El Influencer", description: "Más fotos subidas", icon: "📸", unit: "fotos", group: "social" },
  popular: { name: "El Popular", description: "Más reacciones recibidas", icon: "🗣️", unit: "reacciones", group: "social" },
  fan: { name: "El Hincha", description: "Más reacciones a los demás", icon: "📣", unit: "reacciones", group: "social" },

  ghost: { name: "El Fantasma", description: "El que menos días entrenó. Sin puntos, solo honor", icon: "👻", unit: "días", group: "shame", shame: true },
};

export function isSeasonAwardType(v: string): v is SeasonAwardType {
  return (SEASON_AWARD_TYPES as readonly string[]).includes(v);
}

/** Datos extra por actividad y reacciones, para los premios que no salen de los totales. */
export type AwardContext = {
  activities: Map<string, { categorySlug: string | null; setsByGroup: Partial<Record<string, number>>; volumeKg: number; photos: number }>;
  reactionsReceived: Map<string, number>;
  reactionsGiven: Map<string, number>;
};

export const EMPTY_AWARD_CONTEXT: AwardContext = { activities: new Map(), reactionsReceived: new Map(), reactionsGiven: new Map() };

const CLASSIC = new Set<SeasonAwardType>(["most_days", "most_minutes", "best_streak", "longest_session", "most_categories", "perfect_attendance", "ghost"]);
const SCHEDULE = new Set<SeasonAwardType>(["early_bird", "night_owl", "weekend", "monday", "last_minute", "double_shift"]);
/** Premios que necesitan `AwardContext` (cargarlo cuesta queries: solo si la temporada tiene alguno). */
export const needsAwardContext = (t: SeasonAwardType) => !CLASSIC.has(t) && !SCHEDULE.has(t);

const MUSCLE_GROUP: Partial<Record<SeasonAwardType, string>> = { legs: "legs", arms: "arms", core: "core", chest: "chest", back: "back", shoulders: "shoulders" };
const SPORT_SLUGS: Partial<Record<SeasonAwardType, string[]>> = {
  running: ["running", "trail_running"],
  cycling: ["cycling", "indoor_cycling"],
  swimming: ["swimming"],
  yoga: ["yoga_pilates"],
};
const GYM_SLUGS = new Set(["strength", "calisthenics", "crossfit", "hiit_functional"]);

/** Semanas de la temporada que tienen objetivo (> 0 días). */
export function seasonGoalWeeks(rules: SeasonRules): number {
  if (rules.weeklyGoal <= 0 || rules.endDate < rules.startDate) return 0;
  return weekKeysBetween(rules.startDate, rules.endDate).filter((w) => daysInWeekWithin(w, rules.startDate, rules.endDate) > 0).length;
}

const CLASSIC_METRIC: Record<"most_days" | "most_minutes" | "best_streak" | "longest_session" | "most_categories", (t: UserTotals) => number> = {
  most_days: (t) => t.daysTrained,
  most_minutes: (t) => t.minutes,
  best_streak: (t) => t.bestStreak,
  longest_session: (t) => t.longestActivityMinutes,
  most_categories: (t) => t.categories,
};

/** 0 = lunes … 6 = domingo. */
const weekday = (date: string) => Math.round((Date.parse(date) - Date.parse(weekKeyOfLocalDate(date))) / 86_400_000);

/** Valor de un premio "nuevo" para un usuario, a partir de sus actividades dentro de la temporada. */
function metricFor(type: SeasonAwardType, userId: string, acts: ScoringActivity[], rules: SeasonRules, totals: UserTotals, ctx: AwardContext): number {
  const local = acts.map((a) => ({ a, date: localDateOf(a.startedAt, rules.timezone), hour: Number(localTimeOf(a.startedAt, rules.timezone).slice(0, 2)) }));
  const extra = (id: string) => ctx.activities.get(id);
  const group = MUSCLE_GROUP[type];
  if (group) return local.reduce((s, { a }) => s + (extra(a.id)?.setsByGroup[group] ?? 0), 0);
  const sport = SPORT_SLUGS[type];
  if (sport) return local.reduce((s, { a }) => s + (sport.includes(extra(a.id)?.categorySlug ?? "") ? a.durationMinutes : 0), 0);
  switch (type) {
    case "volume":
      return local.reduce((s, { a }) => s + (extra(a.id)?.volumeKg ?? 0), 0);
    case "gym_rat":
      return local.filter(({ a }) => GYM_SLUGS.has(extra(a.id)?.categorySlug ?? "")).length;
    case "influencer":
      return local.reduce((s, { a }) => s + (extra(a.id)?.photos ?? 0), 0);
    case "popular":
      return ctx.reactionsReceived.get(userId) ?? 0;
    case "fan":
      return ctx.reactionsGiven.get(userId) ?? 0;
    case "early_bird":
      return local.filter((x) => x.hour < 8).length;
    case "night_owl":
      return local.filter((x) => x.hour >= 21).length;
    case "weekend":
      return local.filter((x) => weekday(x.date) >= 5).length;
    case "monday":
      return new Set(local.filter((x) => weekday(x.date) === 0).map((x) => x.date)).size;
    case "double_shift": {
      const perDay = new Map<string, number>();
      for (const x of local) perDay.set(x.date, (perDay.get(x.date) ?? 0) + 1);
      return [...perDay.values()].filter((n) => n >= 2).length;
    }
    case "last_minute": {
      // Semanas cumplidas gracias al domingo: el domingo fue un día que cuenta y sin él no llegaba al objetivo.
      const dayMinutes = new Map<string, number>();
      for (const { a, date } of local) {
        const w = rules.categoryWeights[a.activityCategoryId];
        if (w) dayMinutes.set(date, (dayMinutes.get(date) ?? 0) + a.durationMinutes * w);
      }
      return totals.weeks.filter((w) => w.goalMet && w.days - 1 < w.target && (dayMinutes.get(addDays(w.weekKey, 6)) ?? 0) >= rules.minDailyMinutes).length;
    }
    default:
      return 0;
  }
}

/**
 * Ganadores de un premio. Ganan todos los empatados con el máximo; si el máximo es 0, no hay ganadores.
 * "El Fantasma" es al revés (el mínimo de días), y solo hay ganador si no todos entrenaron lo mismo.
 */
export function computeAwardWinners(
  type: SeasonAwardType,
  scores: SeasonScores,
  activities: ScoringActivity[],
  rules: SeasonRules,
  ctx: AwardContext = EMPTY_AWARD_CONTEXT
): { userId: string; value: number }[] {
  if (type === "perfect_attendance") {
    const weeks = seasonGoalWeeks(rules);
    if (weeks === 0) return [];
    return scores.totals.filter((t) => t.weeksGoalMet >= weeks).map((t) => ({ userId: t.userId, value: weeks }));
  }
  if (type === "ghost") {
    if (scores.totals.length < 2) return [];
    const days = scores.totals.map((t) => t.daysTrained);
    const min = Math.min(...days);
    if (min === Math.max(...days)) return [];
    return scores.totals.filter((t) => t.daysTrained === min).map((t) => ({ userId: t.userId, value: min }));
  }
  let values: { userId: string; value: number }[];
  if (type in CLASSIC_METRIC) {
    const metric = CLASSIC_METRIC[type as keyof typeof CLASSIC_METRIC];
    values = scores.totals.map((t) => ({ userId: t.userId, value: metric(t) }));
  } else {
    const inSeason = activities.filter((a) => {
      const d = localDateOf(a.startedAt, rules.timezone);
      return d >= rules.startDate && d <= rules.endDate;
    });
    values = scores.totals.map((t) => ({
      userId: t.userId,
      value: Math.round(metricFor(type, t.userId, inSeason.filter((a) => a.userId === t.userId), rules, t, ctx) * 10) / 10,
    }));
  }
  const max = Math.max(0, ...values.map((v) => v.value));
  if (max <= 0) return [];
  return values.filter((v) => v.value === max).map((v) => ({ userId: v.userId, value: max }));
}
