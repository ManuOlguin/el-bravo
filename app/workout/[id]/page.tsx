import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Card, LinkButton, PageHeader, Pill } from "@/src/components/ui";
import { ExerciseInfoButton, ExerciseThumb } from "@/src/features/exercises";
import { PhotoGrid } from "@/src/features/media";
import { ReactionBar } from "@/src/features/social/ReactionBar";
import { categoryIcon } from "@/src/features/workout/category-icons";
import { DeleteWorkoutButton } from "@/src/features/workout/DeleteWorkoutButton";
import { KIND_LABEL, displayReason, formatSeconds, setLabels, setText } from "@/src/features/workout/format";
import { getWorkoutDetail } from "@/src/features/workout/server/queries";
import { WorkoutSummaryStats } from "@/src/features/workout/WorkoutResult";
import { formatDateTime } from "@/src/lib/time";
import { requirePageUser } from "@/src/server/auth/dal";
import { getActivityPoints } from "@/src/server/scoring";
import { canViewUserActivities, getReactionSummaries } from "@/src/server/social/reactions";

export const metadata: Metadata = { title: "Entrenamiento" };

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requirePageUser();
  const { id } = await params;
  const w = await getWorkoutDetail(id);
  // Mismo permiso que las reacciones: dueño, seguidor o compañero de grupo. Si no, 404 (no filtra existencia).
  if (!w || !(await canViewUserActivities(viewer.id, w.userId))) notFound();
  const isOwner = w.userId === viewer.id;
  const tz = w.user.timezone;

  const [pointsMap, reactions] = await Promise.all([getActivityPoints([w.id]), getReactionSummaries([w.id], viewer.id)]);
  const points = (pointsMap.get(w.id) ?? []).map((p) => {
    const meta = w.points.find((x) => x.seasonId === p.seasonId);
    return { ...p, seasonName: meta?.seasonName ?? "Temporada", groupId: meta?.groupId, groupName: meta?.groupName ?? "", sharedDay: !!meta?.sharedDay };
  });

  let sets = 0;
  let volumeKg = 0;
  for (const e of w.exercises) {
    for (const s of e.sets) {
      sets++;
      if (s.reps !== null && s.weightKg !== null) volumeKg += s.reps * s.weightKg;
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        back={isOwner ? "/profile" : `/u/${w.userId}`}
        title={
          <span className="flex items-center gap-2">
            <span aria-hidden="true">{categoryIcon(w.activityCategory.slug)}</span>
            {w.activityCategory.name}
          </span>
        }
        subtitle={formatDateTime(w.startedAt, tz)}
      />

      {!isOwner && (
        <Link href={`/u/${w.user.id}`} className="flex items-center gap-3 rounded-card p-1 transition-colors hover:bg-surface-1">
          <Avatar src={w.user.photoUrl} name={w.user.name} size="sm" />
          <span className="font-semibold">{w.user.name ?? "Usuario"}</span>
        </Link>
      )}

      <WorkoutSummaryStats summary={{ durationMinutes: w.durationMinutes, exercises: w.exercises.length, sets, volumeKg }} />

      {w.routine && (
        <p className="text-sm text-fg-muted">
          Rutina:{" "}
          {isOwner ? (
            <Link href={`/routines/${w.routine.id}/edit`} className="font-semibold text-primary hover:underline">
              {w.routine.name}
            </Link>
          ) : (
            <span className="font-semibold text-fg">{w.routine.name}</span>
          )}
        </p>
      )}

      <PhotoGrid photos={w.media} />

      <ReactionBar activityId={w.id} initial={reactions.get(w.id) ?? []} viewer={{ id: viewer.id, name: viewer.name }} />

      {points.length > 0 && (
        <section className="space-y-2" aria-label="Puntos">
          <h2 className="text-xs font-bold uppercase tracking-wide text-fg-subtle">Puntos</h2>
          {points.map((p) => {
            const reason = displayReason(p.reason) ?? (p.sharedDay ? "Se sumó al tiempo de tu día" : null);
            return (
              <Card key={p.seasonId} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {p.groupId ? (
                      <Link href={`/group/${p.groupId}`} className="hover:underline">
                        {p.seasonName}
                      </Link>
                    ) : (
                      p.seasonName
                    )}{" "}
                    <span className="font-normal text-fg-subtle">({p.groupName})</span>
                  </p>
                  {reason && <p className="text-xs text-fg-subtle">{reason}</p>}
                </div>
                <span className={p.points > 0 ? "text-lg font-extrabold text-primary tabular-nums" : "text-lg font-extrabold text-fg-subtle tabular-nums"}>
                  +{p.points}
                </span>
              </Card>
            );
          })}
        </section>
      )}

      {w.exercises.length > 0 && (
        <section className="space-y-2" aria-label="Ejercicios">
          <h2 className="text-xs font-bold uppercase tracking-wide text-fg-subtle">Ejercicios</h2>
          {w.exercises.map((e) => {
            const labels = setLabels(e.sets);
            return (
              <Card key={e.id} className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <ExerciseThumb mediaUrl={e.exercise.mediaUrl} groupKey={e.exercise.primaryGroupKey} className="h-10 w-10" />
                  <h3 className="min-w-0 flex-1 truncate font-bold">{e.exercise.name}</h3>
                  <ExerciseInfoButton exerciseId={e.exercise.id} name={e.exercise.name} />
                </div>
                {isOwner && e.notes && <p className="text-sm text-fg-muted">{e.notes}</p>}
                <ol className="divide-y divide-border rounded-xl bg-surface-2/50">
                  {e.sets.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="w-6 text-center font-bold text-fg-muted" title={KIND_LABEL[s.kind]}>
                        {labels[i]}
                      </span>
                      <span className="flex-1 font-semibold tabular-nums">{setText(s)}</span>
                      {s.kind !== "normal" && <Pill>{KIND_LABEL[s.kind]}</Pill>}
                      {s.restSeconds ? <span className="text-xs text-fg-subtle">⏱ {formatSeconds(s.restSeconds)}</span> : null}
                    </li>
                  ))}
                </ol>
              </Card>
            );
          })}
        </section>
      )}

      {isOwner && w.notes && (
        <Card className="p-3">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-fg-subtle">Notas</h2>
          <p className="whitespace-pre-wrap text-sm">{w.notes}</p>
        </Card>
      )}

      {isOwner && (
        <div className="flex gap-2">
          <LinkButton href={`/workout/${w.id}/edit`} variant="secondary" className="flex-1">
            Editar
          </LinkButton>
          <DeleteWorkoutButton activityId={w.id} redirectTo="/home" />
        </div>
      )}
    </div>
  );
}
