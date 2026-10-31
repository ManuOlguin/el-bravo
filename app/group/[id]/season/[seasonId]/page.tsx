import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Card, CardHeader, LinkButton, PageHeader, Pill } from "@/src/components/ui";
import { AuthError, requirePageUser } from "@/src/server/auth/dal";
import { getSeasonPageData } from "@/src/features/season/data";
import { formatSeasonRange, medalOf, plural, startsInLabel, timeLeftLabel } from "@/src/features/season/format";
import { PointsRules } from "@/src/features/season/PointsRules";
import { SeasonMembershipButton } from "@/src/features/season/SeasonMembershipButton";
import { SeasonLive } from "@/src/features/season/SeasonLive";
import { SeasonResults } from "@/src/features/season/SeasonResults";
import { ResultsPendingCard } from "@/src/features/season/ResultsPendingCard";
import { FinalizeSeasonButton, ReopenSeasonButton } from "@/src/features/season/SeasonAdminActions";
import { awaitingResults } from "@/src/features/season/types";

export const metadata: Metadata = { title: "Temporada" };

function RulesCard({ season, open = false }: { season: Parameters<typeof PointsRules>[0]["season"]; open?: boolean }) {
  return (
    <Card>
      <details open={open} className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-bold">
          <span>Reglas y premios</span>
          <span className="text-sm font-normal text-fg-muted group-open:hidden">Ver</span>
        </summary>
        <div className="pt-4">
          <PointsRules season={season} />
        </div>
      </details>
    </Card>
  );
}

export default async function SeasonPage({ params }: { params: Promise<{ id: string; seasonId: string }> }) {
  const user = await requirePageUser();
  const { id, seasonId } = await params;
  let data;
  try {
    data = await getSeasonPageData(id, seasonId, user);
  } catch (e) {
    if (e instanceof AuthError) notFound();
    throw e;
  }
  if (!data) notFound();

  const { season, group, viewer, today, standings } = data;
  const isAdmin = viewer.role === "admin";
  const groupHref = `/group/${group.id}`;
  const editHref = `${groupHref}/season/${season.id}/edit`;
  const status = season.status;
  const statusPill =
    status === "upcoming" ? (
      <Pill>{startsInLabel(today, season.startDate)}</Pill>
    ) : status === "active" ? (
      <Pill tone="primary">{timeLeftLabel(today, season.endDate)}</Pill>
    ) : (
      <Pill tone="gold">{season.resultsPublished ? "Finalizada" : "Terminó"}</Pill>
    );
  const me = standings.find((s) => s.userId === viewer.id) ?? null;

  return (
    <div className="mx-auto max-w-screen-sm space-y-4">
      <PageHeader
        title={season.name}
        subtitle={`${group.name} · ${formatSeasonRange(season.startDate, season.endDate)}`}
        back={groupHref}
        actions={
          isAdmin && status !== "finalized" ? (
            <LinkButton href={editHref} variant="secondary" size="sm">
              Editar
            </LinkButton>
          ) : undefined
        }
      />
      <div className="-mt-2 flex flex-wrap items-center gap-2">
        {statusPill}
        <Pill>{plural(season.memberCount, "participante", "participantes")}</Pill>
        <Pill>Objetivo: {season.weeklyGoal} días/semana</Pill>
      </div>
      {season.description && <p className="text-sm text-fg-muted">{season.description}</p>}

      {status === "upcoming" && (
        <>
          <Card className="space-y-3 text-center">
            <p className="text-4xl" aria-hidden="true">
              ⏳
            </p>
            <p className="text-lg font-bold">{startsInLabel(today, season.startDate)}</p>
            <p className="text-sm text-fg-muted">
              {season.joined ? "Ya estás adentro. Desde el primer día, tus entrenamientos suman." : "Sumate ahora y arrancás desde el primer día."}
            </p>
            <SeasonMembershipButton seasonId={season.id} joined={season.joined} fullWidth />
          </Card>
          <RulesCard season={season} open />
        </>
      )}

      {status === "active" && (
        <>
          {season.joined && me ? (
            <Card className="flex items-center gap-4">
              <span className="text-3xl font-extrabold tabular-nums">{medalOf(me.rank) ?? `${me.rank}°`}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {me.points} pts · {me.daysTrained} {me.daysTrained === 1 ? "día" : "días"}
                </p>
                <p className="text-xs text-fg-muted">
                  {me.weeksGoalMet} {me.weeksGoalMet === 1 ? "semana cumplida" : "semanas cumplidas"}
                  {me.currentStreak > 0 ? ` · racha de ${me.currentStreak} 🔥` : ""}
                </p>
              </div>
            </Card>
          ) : !season.joined ? (
            <Card className="space-y-3">
              <CardHeader title="No estás participando" subtitle="Sumate y tus entrenamientos de toda la temporada empiezan a contar." />
              <SeasonMembershipButton seasonId={season.id} joined={false} fullWidth />
            </Card>
          ) : null}
          <SeasonLive standings={standings} weeks={data.weeks.byUser} viewerId={viewer.id} weeklyGoal={season.weeklyGoal} />
          <RulesCard season={season} />
          <div className="flex flex-col gap-2">
            {season.joined && <SeasonMembershipButton seasonId={season.id} joined />}
            {isAdmin && <FinalizeSeasonButton seasonId={season.id} auto={season.resultsReveal === "auto"} />}
          </div>
        </>
      )}

      {awaitingResults(season) && (
        <>
          <ResultsPendingCard seasonId={season.id} admins={group.admins} isAdmin={isAdmin} finalized={status === "finalized"} />
          {isAdmin && data.canSeeStandings && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-muted">Vista previa (solo admins)</h2>
              <SeasonResults
                seasonId={season.id}
                seasonName={season.name}
                standings={standings}
                awards={status === "finalized" ? data.awards : []}
                stats={data.stats}
                me={data.me}
                viewerId={viewer.id}
                reveal={false}
              />
              {status !== "finalized" && <p className="text-xs text-fg-subtle">Los premios se calculan al publicar.</p>}
            </section>
          )}
        </>
      )}

      {data.canSeeResults && (
        <>
          <SeasonResults
            seasonId={season.id}
            seasonName={season.name}
            standings={standings}
            awards={data.awards}
            stats={data.stats}
            me={data.me}
            viewerId={viewer.id}
          />
          <RulesCard season={season} />
          {isAdmin && (
            <Card className="space-y-2">
              <CardHeader title="Administración" subtitle="Si hubo un error en los datos, podés reabrirla: se borran los premios y se recalcula todo." />
              <ReopenSeasonButton seasonId={season.id} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
