import { z } from "zod";
import { addDays } from "@/src/lib/time";
import { SEASON_AWARD_TYPES } from "@/src/server/scoring/awards";

const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const localDate = (label: string) =>
  z
    .string({ error: `Elegí la fecha de ${label}` })
    .regex(LOCAL_DATE, `La fecha de ${label} no es válida`)
    .refine((v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    }, `La fecha de ${label} no es válida`);

const int = (min: number, max: number, label: string) =>
  z.coerce
    .number({ error: `${label}: tiene que ser un número` })
    .int(`${label}: tiene que ser un número entero`)
    .min(min, `${label}: mínimo ${min}`)
    .max(max, `${label}: máximo ${max}`);

export const MAX_SEASON_DAYS = 365;

/** Reglas avanzadas de puntaje (D1). Opcional: al crear se usan los valores por defecto; al editar, si falta, no se tocan. */
export const seasonRulesSchema = z.object({
  dayBasePoints: int(0, 100, "Puntos por día"),
  timePointsFactor: int(0, 100, "Factor de tiempo"),
  timeCurveMinutes: int(1, 600, "Curva de tiempo"),
  maxDailyMinutes: int(1, 1440, "Tope diario"),
  weeklyGoalBonus: int(0, 500, "Bonus semanal"),
  streakBonusStep: int(0, 100, "Bonus de racha"),
  streakBonusCap: int(0, 500, "Tope de racha"),
  activeStreakBonusStep: int(0, 100, "Bonus de racha activa"),
  activeStreakBonusCap: int(0, 500, "Tope de racha activa"),
});

export const seasonCategoryInputSchema = z.object({
  activityCategoryId: z.string().min(1, "Elegí un tipo de actividad"),
  weight: z.coerce
    .number()
    .min(0, "El peso va de 0 a 2")
    .max(2, "El peso va de 0 a 2")
    .refine((w) => Number.isInteger(w * 4), "El peso va en pasos de 0,25"),
});

export const seasonAwardInputSchema = z.object({
  awardType: z.enum(SEASON_AWARD_TYPES, { error: "Premio desconocido" }),
  bonusPoints: int(0, 200, "Puntos del premio").default(0),
});

export const seasonInputSchema = z
  .object({
    groupId: z.string().min(1, "Falta el grupo"),
    name: z.string().trim().min(1, "Poné un nombre para la temporada").max(80, "El nombre es muy largo (máx. 80)"),
    description: z.string().trim().max(2000, "La descripción es muy larga").optional().nullable(),
    startDate: localDate("inicio"),
    endDate: localDate("fin"),
    weeklyGoal: int(1, 7, "Objetivo semanal"),
    minDailyMinutes: int(5, 180, "Minutos mínimos por día").default(20),
    resultsReveal: z.enum(["auto", "manual"]).default("auto"),
    categories: z
      .array(seasonCategoryInputSchema)
      .min(1, { error: "Elegí al menos un tipo de actividad", abort: true })
      .refine((cs) => cs.some((c) => c.weight > 0), "Al menos un tipo de actividad tiene que sumar (peso mayor a 0)")
      .refine((cs) => new Set(cs.map((c) => c.activityCategoryId)).size === cs.length, "Hay tipos de actividad repetidos"),
    awards: z
      .array(seasonAwardInputSchema)
      .default([])
      .refine((as) => new Set(as.map((a) => a.awardType)).size === as.length, "Hay premios repetidos"),
    rules: seasonRulesSchema.optional(),
  })
  .superRefine((s, ctx) => {
    if (s.endDate < s.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "La fecha de fin tiene que ser igual o posterior al inicio" });
    } else if (s.endDate > addDays(s.startDate, MAX_SEASON_DAYS)) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "La temporada puede durar como máximo un año" });
    }
  });

export type SeasonInput = z.infer<typeof seasonInputSchema>;

/** Rangos de fechas locales inclusivos que se pisan. */
export function rangesOverlap(a: { startDate: string; endDate: string }, b: { startDate: string; endDate: string }) {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}
