"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateRoutineMuscleShare } from "@/src/lib/muscles/calculateRoutineMuscleShare";

type RoutineExerciseMuscle = {
  id: string;
  percentage: number;
  muscle: {
    id: string;
    name: string;
    slug: string;
    groupKey: string;
  };
};

type RoutineExercise = {
  id: string;
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  weightKg?: number | null;
  muscles: RoutineExerciseMuscle[];
};

type Routine = {
  id: string;
  name: string;
  createdAt?: string;
  exercises: RoutineExercise[];
};

function getGroupLabel(groupKey: string) {
  const labels: Record<string, string> = {
    legs: "Piernas",
    chest: "Pecho",
    back: "Espalda",
    shoulders: "Hombros",
    arms: "Brazos",
    core: "Core",
    glutes: "Glúteos",
    full_body: "Full body",
  };

  return labels[groupKey] ?? groupKey;
}

export default function RoutinesPage() {
  const router = useRouter();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/routine/list", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Error cargando rutinas");
      }

      setRoutines(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error("load routines error:", e);
      setError(e?.message || "Error cargando rutinas");
      setRoutines([]);
    } finally {
      setLoading(false);
    }
  }

  async function deleteRoutine(id: string) {
    const confirmed = window.confirm("¿Eliminar rutina?");
    if (!confirmed) return;

    const res = await fetch(`/api/routine/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data?.error || "No se pudo eliminar la rutina.");
      return;
    }

    load();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#08142d] p-6 text-white">
        <div className="mx-auto max-w-4xl rounded-2xl bg-slate-800 p-6 shadow-lg">
          Cargando rutinas...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08142d] p-6 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center rounded-md bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500"
          >
            ← Volver atrás
          </button>

          <button
            onClick={() => router.push("/create-routine")}
            className="rounded-lg bg-gradient-to-b from-lime-600 to-lime-800 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:from-lime-500 hover:to-lime-700"
          >
            + Nueva rutina
          </button>
        </div>

        <section className="rounded-2xl bg-slate-800 p-6 shadow-lg">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-white">Mis rutinas</h1>
            <p className="mt-2 text-sm text-slate-400">
              Gestioná tus rutinas y mirá qué grupos musculares trabajan.
            </p>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {routines.length === 0 ? (
            <div className="rounded-xl bg-slate-900/70 p-6 text-slate-300">
              No tenés rutinas creadas.
            </div>
          ) : (
            <div className="space-y-6">
              {routines.map((routine) => {
                const distribution = calculateRoutineMuscleShare(
                  routine.exercises.map((exercise) => ({
                    id: exercise.id,
                    sets: exercise.sets,
                    reps: exercise.reps,
                    exercise: {
                      id: exercise.exerciseId,
                      name: exercise.name,
                      muscles: exercise.muscles ?? [],
                    },
                  }))
                );

                const topGroups = distribution.groups.slice(0, 3);
                const muscles = distribution.muscles.slice(0, 6);

                return (
                  <article
                    key={routine.id}
                    className="rounded-2xl bg-slate-900/70 p-4 shadow-md"
                  >
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-3xl font-bold text-white">{routine.name}</h2>
                        <p className="mt-2 text-sm text-slate-400">
                          {distribution.ignoredExercises.length > 0
                            ? "Algunos ejercicios no tienen mapeo muscular completo."
                            : "Distribución muscular calculada correctamente."}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push(`/routine/${routine.id}/edit`)}
                          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-400"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteRoutine(routine.id)}
                          className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>

                    <div className="mb-5 flex flex-wrap gap-2">
                      {topGroups.length > 0 ? (
                        topGroups.map((group) => (
                          <span
                            key={group.groupKey}
                            className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200"
                          >
                            {getGroupLabel(group.groupKey)} {group.sharePct.toFixed(1)}%
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
                          Sin distribución muscular calculable
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className="rounded-xl bg-slate-800 p-4">
                        <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
                          Ejercicios
                        </div>

                        <div className="space-y-3">
                          {routine.exercises.map((exercise) => (
                            <div
                              key={exercise.id}
                              className="flex items-center justify-between rounded-lg bg-slate-700 px-3 py-2 text-sm"
                            >
                              <div className="font-medium text-white">{exercise.name}</div>

                              <div className="flex items-center gap-3 text-slate-200">
                                <span>
                                  {exercise.sets}x{exercise.reps}
                                </span>
                                {exercise.weightKg !== null &&
                                exercise.weightKg !== undefined ? (
                                  <span>{exercise.weightKg}kg</span>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl bg-slate-800 p-4">
                        <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-300">
                          Músculos trabajados
                        </div>

                        {muscles.length === 0 ? (
                          <div className="text-sm text-slate-400">
                            No hay datos musculares suficientes para esta rutina.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {muscles.map((muscle) => (
                              <div key={muscle.muscleSlug}>
                                <div className="mb-1 flex items-center justify-between text-sm">
                                  <span className="font-medium text-white">
                                    {muscle.muscleName}
                                  </span>
                                  <span className="text-slate-300">
                                    {muscle.sharePct.toFixed(1)}%
                                  </span>
                                </div>

                                <div className="h-2 overflow-hidden rounded-full bg-slate-600">
                                  <div
                                    className="h-full rounded-full bg-lime-500"
                                    style={{ width: `${Math.min(muscle.sharePct, 100)}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}