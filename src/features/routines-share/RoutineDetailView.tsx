import Link from "next/link";
import { Avatar, Card, LinkButton, PageHeader, Pill } from "@/src/components/ui";
import { ExerciseThumb } from "@/src/features/exercises/ExerciseThumb";
import { restLabel, setLabels } from "@/src/features/workout/format";
import { PlayIcon } from "@/src/features/workout/icons";
import { CopiedFromNote, VisibilityPill, routineCountsLabel } from "@/src/features/workout/RoutineMeta";
import type { RoutineView } from "@/src/schemas/routine";
import { CopyRoutineButton } from "./CopyRoutineButton";
import { oneSetText } from "./format";
import { ShareRoutineButton } from "./ShareRoutineButton";

/**
 * `/routines/[id]` (fase 2). Dueño: su rutina (pública o privada) con Empezar / Editar / Compartir / Duplicar.
 * Otro usuario (solo si es pública): ejercicios y series en lectura, autor, "Copiar a mis rutinas" y "Compartir".
 * Sin botón de info de ejercicio: los ejercicios propios del autor no se pueden abrir para otros (`getExerciseDetail`)
 * y la vista no distingue cuáles son.
 */
export function RoutineDetailView({ routine, shareUrl }: { routine: RoutineView; shareUrl?: string }) {
  const { owner, isOwner } = routine;
  const sets = routine.exercises.reduce((n, e) => n + e.sets.length, 0);
  return (
    <div className="space-y-4">
      <PageHeader
        title={routine.name}
        back={isOwner ? "/routines" : `/u/${owner.id}`}
        subtitle={routineCountsLabel(routine.exercises.length, sets)}
        actions={isOwner && routine.visibility === "public" ? <VisibilityPill visibility={routine.visibility} /> : undefined}
      />

      {!isOwner && (
        <div className="flex items-center gap-3">
          <Avatar name={owner.name} src={owner.photoUrl} size="sm" />
          <p className="text-sm text-fg-muted">
            Rutina de{" "}
            <Link href={`/u/${owner.id}`} className="font-semibold text-fg hover:underline">
              {owner.name ?? "Usuario de El Bravo"}
            </Link>
          </p>
        </div>
      )}
      <CopiedFromNote userName={routine.copiedFromUserName} />
      {routine.notes && <Card className="whitespace-pre-line text-sm text-fg-muted">{routine.notes}</Card>}

      <div className="flex items-center gap-2">
        {isOwner ? (
          <>
            <LinkButton href={`/routines/${routine.id}/live`} className="min-w-0 flex-1">
              <PlayIcon size={16} className="shrink-0" />
              Empezar
            </LinkButton>
            <LinkButton href={`/routines/${routine.id}/edit`} variant="secondary">
              Editar
            </LinkButton>
            <ShareRoutineButton routineId={routine.id} routine={routine} url={shareUrl} />
            <CopyRoutineButton routineId={routine.id} label="Duplicar" variant="ghost" size="sm" />
          </>
        ) : (
          <>
            <CopyRoutineButton routineId={routine.id} label="Copiar a mis rutinas" className="flex-1" />
            <ShareRoutineButton routineId={routine.id} routine={routine} url={shareUrl} />
          </>
        )}
      </div>

      <section aria-labelledby="routine-exercises" className="space-y-2">
        <h2 id="routine-exercises" className="px-1 text-sm font-bold uppercase tracking-wide text-fg-subtle">
          Ejercicios
        </h2>
        <ol className="space-y-2">
          {routine.exercises.map((e, i) => {
            const labels = setLabels(e.sets);
            return (
              <Card as="li" key={i} className="space-y-2 p-3">
                <div className="flex items-center gap-3">
                  <ExerciseThumb mediaUrl={e.exercise.mediaUrl} groupKey={e.exercise.primaryGroupKey} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold">{e.exercise.name}</h3>
                    {e.restSeconds !== null && <p className="text-xs text-fg-subtle">{restLabel(e.restSeconds)}</p>}
                  </div>
                </div>
                {e.notes && <p className="text-sm text-fg-muted">{e.notes}</p>}
                <ul className="flex flex-wrap gap-1.5" aria-label={`Series de ${e.exercise.name}`}>
                  {e.sets.map((s, j) => (
                    <li key={j}>
                      <Pill>
                        {labels[j]} · {oneSetText(s, false)}
                      </Pill>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
