import Link from "next/link";
import { EmptyState } from "@/src/components/ui";
import { formatDate, formatDuration } from "@/src/lib/time";
import type { PublicProfile } from "@/src/server/social/profile";
import type { UserBadgeView } from "@/src/server/badges";
import type { UserStats } from "@/src/server/stats";
import type { HistoryItem } from "@/src/server/stats/history";
import { BadgeGrid } from "@/src/features/badges";
import { ProfileHeader } from "./ProfileHeader";
import { ProfileStatsRow } from "./ProfileStatsRow";
import { WorkoutHistory } from "./WorkoutHistory";

function SectionTitle({ id, children, action }: { id: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 id={id} className="text-sm font-bold uppercase tracking-wide text-fg-subtle">
        {children}
      </h2>
      {action}
    </div>
  );
}

/**
 * Perfil unificado (propio y ajeno). Convención: los avatares y nombres de otros usuarios linkean a `/u/[id]`.
 * - `isOwner` (por defecto `profile.relation.isMe`): botón "Editar perfil", link a stats e historial completo.
 * - Ajeno: botón seguir, grupos en común y las últimas 10 actividades (sin notas).
 */
export function ProfileView({
  profile,
  badges,
  viewerTz,
  stats,
  isOwner = profile.relation.isMe,
  history,
}: {
  profile: PublicProfile;
  badges: UserBadgeView[];
  viewerTz: string;
  stats?: UserStats;
  isOwner?: boolean;
  /** Primera página del historial (solo el dueño). */
  history?: { items: HistoryItem[]; nextCursor: string | null };
}) {
  const { sharedGroups, recentActivities } = profile;
  const earned = badges.filter((b) => b.level > 0).length;

  return (
    <div className="mx-auto max-w-screen-sm space-y-6">
      <ProfileHeader profile={profile} isOwner={isOwner} viewerTz={viewerTz} />

      {stats && (
        <section aria-label="Estadísticas" className="space-y-2">
          <ProfileStatsRow
            workouts={stats.totals.workouts}
            streak={stats.currentStreakWeeks}
            perfectWeeks={stats.perfectWeeks}
            minutes={stats.totals.minutes}
          />
          {isOwner && (
            <Link href="/stats" className="block text-right text-sm font-semibold text-primary hover:underline">
              Ver mis stats →
            </Link>
          )}
        </section>
      )}

      <section aria-labelledby="badges-title" className="space-y-2">
        <SectionTitle id="badges-title" action={<span className="text-xs text-fg-subtle tabular-nums">{earned}/{badges.length}</span>}>
          Insignias
        </SectionTitle>
        {badges.length === 0 ? <p className="text-sm text-fg-muted">Todavía no hay insignias.</p> : <BadgeGrid badges={badges} timezone={viewerTz} />}
      </section>

      {sharedGroups.length > 0 && (
        <section aria-labelledby="groups-title" className="space-y-2">
          <SectionTitle id="groups-title">{isOwner ? "Mis grupos" : "Grupos en común"}</SectionTitle>
          <ul className="flex flex-wrap gap-2">
            {sharedGroups.map((g) => (
              <li key={g.id} className="max-w-full">
                <Link
                  href={`/group/${g.id}`}
                  className="inline-flex h-9 max-w-full items-center truncate rounded-full border border-border bg-surface-2 px-4 text-sm font-semibold transition-transform hover:bg-surface-3 active:scale-95"
                >
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="history-title" className="space-y-2">
        <SectionTitle id="history-title">{isOwner ? "Mis entrenamientos" : "Actividad reciente"}</SectionTitle>
        {isOwner && history ? (
          <WorkoutHistory initialItems={history.items} initialCursor={history.nextCursor} tz={viewerTz} />
        ) : recentActivities.length === 0 ? (
          <EmptyState title="Sin entrenamientos todavía" />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface-1">
            {recentActivities.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                {a.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniaturas externas (R2)
                  <img src={a.photoUrl} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg bg-surface-2 object-cover" />
                ) : (
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-surface-3 text-lg font-bold text-fg-muted" aria-hidden="true">
                    {a.categoryName.charAt(0)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.categoryName}</p>
                  <p className="text-sm text-fg-muted">
                    {formatDate(a.startedAt, viewerTz)} · {formatDuration(a.durationMinutes)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
