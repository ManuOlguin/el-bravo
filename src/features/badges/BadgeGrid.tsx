import { cn } from "@/src/components/ui";
import type { UserBadgeView } from "@/src/server/badges/types";
import { BadgeCard } from "./BadgeCard";

/** Grilla de insignias: 3 columnas en mobile, 4 desde `sm:`. */
export function BadgeGrid({ badges, timezone, className }: { badges: UserBadgeView[]; timezone?: string; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-3 gap-2 sm:grid-cols-4", className)}>
      {badges.map((b) => (
        <li key={b.code} className="min-w-0">
          <BadgeCard badge={b} timezone={timezone} />
        </li>
      ))}
    </ul>
  );
}
