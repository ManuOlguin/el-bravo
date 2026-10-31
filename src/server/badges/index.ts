// Insignias v2 (roadmap D2, contrato §5.6). Dueño: W1-2.
// Sin "server-only" a propósito: scripts/migrate-v2-data.ts lo importa desde tsx.
export type { BadgeChange, UserBadgeView } from "./types";
export { recomputeUserBadges } from "./recompute";
export { getUserBadges } from "./queries";
