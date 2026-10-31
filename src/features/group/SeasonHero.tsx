import Link from "next/link";
import { Card, EmptyState, LinkButton, Pill } from "@/src/components/ui";
import type { StandingRow } from "@/src/server/scoring/types";
import { formatSeasonRange, medalOf, plural, startsInLabel, timeLeftLabel } from "@/src/features/season/format";
import { SeasonMembershipButton } from "@/src/features/season/SeasonMembershipButton";
import type { SeasonSummary } from "@/src/features/season/types";

function seasonHref(groupId: string, seasonId: string) {
  return `/group/${groupId}/season/${seasonId}`;
}

/**
 * Temporada en curso (o la próxima): nombre, fechas, tiempo restante, tu posición y la acción que
 * corresponde al estado ("Unirme", "Ver temporada", "Ver resultados", "Crear temporada").
 */
export function SeasonHero({
  groupId,
  current,
  upcoming,
  me,
  today,
  isAdmin,
}: {
  groupId: string;
  current: SeasonSummary | null;
  upcoming: SeasonSummary | null;
  me: StandingRow | null;
  today: string; // fecha local en la zona del grupo
  isAdmin: boolean;
}) {
  const season = current ?? upcoming;
  if (!season) {
    return (
      <EmptyState
        icon={<span className="text-2xl">🏁</span>}
        title="No hay ninguna temporada en juego"
        description={isAdmin ? "Armá una temporada para que empiece la competencia." : "Cuando un admin cree una temporada, aparece acá."}
        action={isAdmin ? <LinkButton href={`/group/${groupId}/season/new`}>Crear temporada</LinkButton> : undefined}
      />
    );
  }

  const status = season.status;
  const ended = status === "ended" || status === "finalized";
  const label =
    status === "upcoming" ? startsInLabel(today, season.startDate) : status === "active" ? timeLeftLabel(today, season.endDate) : "Terminó";

  return (
    <Card className="space-y-4 border-primary/40 bg-gradient-to-br from-primary/15 via-surface-1 to-surface-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {status === "upcoming" ? "Próxima temporada" : status === "active" ? "Temporada en curso" : "Temporada terminada"}
          </p>
          <Link href={seasonHref(groupId, season.id)} className="block truncate text-xl font-extrabold hover:underline">
            {season.name}
          </Link>
          <p className="text-sm text-fg-muted">{formatSeasonRange(season.startDate, season.endDate)}</p>
        </div>
        <Pill tone={status === "active" ? "primary" : ended ? "gold" : "default"}>{label}</Pill>
      </div>

      {status === "active" && season.joined && me && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface-2 p-2">
            <p className="text-2xl font-extrabold tabular-nums">
              {medalOf(me.rank) ?? `${me.rank}°`}
            </p>
            <p className="text-xs text-fg-muted">tu puesto</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-2">
            <p className="text-2xl font-extrabold tabular-nums text-primary">{me.points}</p>
            <p className="text-xs text-fg-muted">puntos</p>
          </div>
          <div className="rounded-xl bg-surface-2 p-2">
            <p className="text-2xl font-extrabold tabular-nums">{me.currentStreak > 0 ? `${me.currentStreak}🔥` : "0"}</p>
            <p className="text-xs text-fg-muted">racha</p>
          </div>
        </div>
      )}

      {!ended && !season.joined && (
        <p className="text-sm text-fg-muted">
          {plural(season.memberCount, "persona compite", "personas compiten")}. Sumate y tus entrenamientos empiezan a contar.
        </p>
      )}

      {ended && (
        <p className="text-sm text-fg-muted">
          {season.resultsPublished ? "Ya están los resultados." : isAdmin ? "Revisá el ranking final y publicá los resultados." : "Esperando que un admin publique los resultados 🥁"}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {!ended && !season.joined && <SeasonMembershipButton seasonId={season.id} joined={false} />}
        <LinkButton href={seasonHref(groupId, season.id)} variant={ended && (season.resultsPublished || isAdmin) ? "primary" : "secondary"}>
          {ended ? (season.resultsPublished ? "Ver resultados" : isAdmin ? "Publicar resultados" : "Ver temporada") : "Ver temporada"}
        </LinkButton>
        {isAdmin && !upcoming && status !== "upcoming" && (
          <LinkButton href={`/group/${groupId}/season/new`} variant="ghost">
            Nueva temporada
          </LinkButton>
        )}
      </div>

      {current && upcoming && (
        <p className="border-t border-border pt-3 text-sm text-fg-muted">
          Después:{" "}
          <Link href={seasonHref(groupId, upcoming.id)} className="font-semibold text-fg hover:underline">
            {upcoming.name}
          </Link>{" "}
          · {startsInLabel(today, upcoming.startDate).toLowerCase()}
        </p>
      )}
    </Card>
  );
}
