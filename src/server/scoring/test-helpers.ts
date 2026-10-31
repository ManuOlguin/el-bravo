// Fixtures compartidos por los tests del motor (no se importa desde código de producción).
import { addDays, zonedToUtc } from "@/src/lib/time";
import type { SeasonRules, ScoringActivity } from "./types";

export const TZ = "America/Argentina/Buenos_Aires";
export const rules = (o: Partial<SeasonRules> = {}): SeasonRules => ({
  startDate: "2026-11-02", endDate: "2026-11-29", timezone: TZ, // 4 semanas: lun 2/11 → dom 29/11
  weeklyGoal: 3, minDailyMinutes: 20, dayBasePoints: 10, timePointsFactor: 10, timeCurveMinutes: 30, maxDailyMinutes: 240,
  weeklyGoalBonus: 20, streakBonusStep: 5, streakBonusCap: 25,
  categoryWeights: { gym: 1, run: 2, yoga: 0.5 }, ...o,
});
let n = 0;
export const act = (userId: string, date: string, time = "18:00", minutes = 45, cat = "gym"): ScoringActivity =>
  ({ id: `a${String(++n).padStart(4, "0")}`, userId, activityCategoryId: cat, startedAt: zonedToUtc(date, time, TZ), durationMinutes: minutes });
export const addD = (d: string, i: number) => addDays(d, i);
export const week = (u: string, monday: string, k = 3, minutes = 45) => Array.from({ length: k }, (_, i) => act(u, addD(monday, i), "18:00", minutes));
export const AFTER = new Date("2026-12-15T12:00:00Z");
