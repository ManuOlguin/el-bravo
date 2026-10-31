// Estadísticas personales (W2-4). `getUserStats` es la única fuente para home, perfil y /stats.
export { getUserStats } from "./getUserStats";
export {
  computeUserStats,
  computePersonalRecords,
  computeMuscleMinutes,
  DAYPARTS,
  type Daypart,
  type MuscleMinutes,
  isStatsRange,
  STATS_RANGES,
  type StatsRange,
  type StatsActivity,
  type StatsSet,
  type UserStats,
  type PersonalRecord,
} from "./compute";
