import Link from "next/link";
import { Avatar, Card, EmptyState, LinkButton, Pill } from "@/src/components/ui";
import { formatDate, formatDuration } from "@/src/lib/time";
import type { PublicProfile } from "@/src/server/social/profile";
import type { UserBadgeView } from "@/src/server/badges";
import { FollowButton } from "@/src/features/social/FollowButton";

/**
 * Perfil público (versión inicial de W1-4; W2-4 la rediseña manteniendo las props).
 * Convención para toda la app: los avatares y nombres de otros usuarios linkean a `/u/[id]`
 * (`<Avatar href={`/u/${id}`}>`); ese cableado lo hacen W2-2 (grupo) y W2-4 (home/feed).
 */
export function ProfileView({ profile, badges, viewerTz }: { profile: PublicProfile; badges: UserBadgeView[]; viewerTz: string }) {
  const { user, counts, relation, sharedGroups, recentActivities } = profile;
  const earned = badges.filter((b) => b.level > 0);

  return (
    <div className="mx-auto max-w-screen-sm space-y-5">
      <header className="flex flex-col items-center gap-3 pt-2 text-center">
        <Avatar name={user.name} src={user.photoUrl} size="xl" />
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight break-words">{user.name ?? "Usuario"}</h1>
          {relation.followsMe && !relation.isFriend && <Pill className="mt-1">Te sigue</Pill>}
          {user.bio && <p className="mt-2 text-sm text-fg-muted break-words">{user.bio}</p>}
          <p className="mt-1 text-xs text-fg-subtle">En El Bravo desde {formatDate(user.createdAt, viewerTz, "long")}</p>
        </div>

        <nav aria-label="Contadores" className="flex flex-wrap items-center justify-center gap-x-2 text-sm text-fg-muted">
          <Link href={`/u/${user.id}/followers`} className="rounded-md px-1 hover:text-fg">
            <strong className="text-fg tabular-nums">{counts.followers}</strong> {counts.followers === 1 ? "seguidor" : "seguidores"}
          </Link>
          <span aria-hidden="true">·</span>
          <Link href={`/u/${user.id}/following`} className="rounded-md px-1 hover:text-fg">
            <strong className="text-fg tabular-nums">{counts.following}</strong> {counts.following === 1 ? "seguido" : "seguidos"}
          </Link>
          <span aria-hidden="true">·</span>
          <span className="px-1">
            <strong className="text-fg tabular-nums">{counts.workouts}</strong> {counts.workouts === 1 ? "entrenamiento" : "entrenamientos"}
          </span>
        </nav>

        <div className="flex w-full max-w-xs gap-2">
          {relation.isMe ? (
            <>
              <LinkButton href="/settings/profile" variant="secondary" fullWidth>
                Editar perfil
              </LinkButton>
              <LinkButton href="/u" variant="secondary" fullWidth>
                Buscar personas
              </LinkButton>
            </>
          ) : (
            <FollowButton
              userId={user.id}
              userName={user.name}
              isFollowing={relation.isFollowing}
              followsMe={relation.followsMe}
              fullWidth
            />
          )}
        </div>
      </header>

      <section aria-labelledby="badges-title" className="space-y-2">
        <h2 id="badges-title" className="text-sm font-bold uppercase tracking-wide text-fg-subtle">
          Insignias
        </h2>
        {/* TODO(W1-2/W2-4): reemplazar por <BadgeGrid badges={badges} /> cuando exista. */}
        {earned.length === 0 ? (
          <p className="text-sm text-fg-muted">Todavía no ganó insignias.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {earned.map((b) => (
              <li key={b.code}>
                <Card className="h-full p-3">
                  <p className="truncate text-sm font-bold">{b.name}</p>
                  <p className="text-xs text-fg-muted">
                    Nivel {b.level}
                    {b.maxLevel > 1 ? ` de ${b.maxLevel}` : ""}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!relation.isMe && sharedGroups.length > 0 && (
        <section aria-labelledby="groups-title" className="space-y-2">
          <h2 id="groups-title" className="text-sm font-bold uppercase tracking-wide text-fg-subtle">
            Grupos en común
          </h2>
          <ul className="flex flex-wrap gap-2">
            {sharedGroups.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/group/${g.id}`}
                  className="inline-flex h-9 items-center rounded-full border border-border bg-surface-2 px-4 text-sm font-semibold transition-transform hover:bg-surface-3 active:scale-95"
                >
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="recent-title" className="space-y-2">
        <h2 id="recent-title" className="text-sm font-bold uppercase tracking-wide text-fg-subtle">
          Actividad reciente
        </h2>
        {recentActivities.length === 0 ? (
          <EmptyState title="Sin entrenamientos todavía" />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface-1">
            {recentActivities.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                {a.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- miniaturas externas (R2)
                  <img src={a.photoUrl} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
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
