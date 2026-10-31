/** Estado derivado de una temporada (roadmap D3). Puro: `today` es la fecha local en la zona del grupo. */
export type SeasonStatus = "upcoming" | "active" | "ended" | "finalized";

export function seasonStatus(s: { startDate: string; endDate: string; finalizedAt: Date | null }, today: string): SeasonStatus {
  if (s.finalizedAt) return "finalized";
  if (today < s.startDate) return "upcoming";
  if (today <= s.endDate) return "active";
  return "ended";
}
