"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { calculateRoutineMuscleShare } from "@/src/lib/muscles/calculateRoutineMuscleShare";

export type RoutineExerciseInput = {
  exerciseId: string;
  sets: number;
  reps: number;
  weightKg?: number | null;
  newExerciseName?: string;
  newExerciseMuscles?: {
    muscleId: string;
    percentage: number;
  }[];
};

type Exercise = {
  id: string;
  name: string;
  muscles?: {
    exerciseId?: string;
    muscleId?: string;
    percentage: number;
    muscle: {
      id: string;
      name: string;
      slug?: string;
      groupKey?: string;
    };
  }[];
};

type Muscle = {
  id: string;
  name: string;
  slug?: string;
  groupKey?: string;
};

type RoutineFormProps = {
  mode: "create" | "edit";
  routineId?: string;
  initialName?: string;
  initialExercises?: RoutineExerciseInput[];
};

function formatGroupLabel(groupKey?: string) {
  switch (groupKey) {
    case "legs":
      return "Piernas";
    case "core":
      return "Core";
    case "chest":
      return "Pecho";
    case "back":
      return "Espalda";
    case "arms":
      return "Brazos";
    case "shoulders":
      return "Hombros";
    case "glutes":
      return "Glúteos";
    default:
      return groupKey || "Otros";
  }
}

function getTotalMusclePercentage(
  muscles: { muscleId: string; percentage: number }[] | undefined
) {
  return (muscles ?? []).reduce(
    (sum, item) => sum + (Number(item.percentage) || 0),
    0
  );
}

export default function RoutineForm({
  mode,
  routineId,
  initialName = "",
  initialExercises = [],
}: RoutineFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [name, setName] = useState<string>(initialName);
  const [exercises, setExercises] = useState<RoutineExerciseInput[]>(
    initialExercises.length > 0
      ? initialExercises.map((item) => ({
          ...item,
          weightKg: item.weightKg ?? null,
          newExerciseName: item.newExerciseName ?? "",
          newExerciseMuscles: item.newExerciseMuscles ?? [],
        }))
      : []
  );

  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [availableMuscles, setAvailableMuscles] = useState<Muscle[]>([]);
  const [searchTerms, setSearchTerms] = useState<Record<number, string>>({});
  const [openSearchIndex, setOpenSearchIndex] = useState<number | null>(null);
  const [isCreatingNewExercise, setIsCreatingNewExercise] = useState<Record<number, boolean>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [loadingExercises, setLoadingExercises] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoadingExercises(true);

        const [exerciseRes, muscleRes] = await Promise.all([
          fetch("/api/exercise/list", { cache: "no-store" }),
          fetch("/api/muscle/list", { cache: "no-store" }),
        ]);

        const exerciseData = await exerciseRes.json().catch(() => ({}));
        const muscleData = await muscleRes.json().catch(() => ({}));

        if (!exerciseRes.ok) {
          throw new Error(exerciseData?.error || "Error cargando ejercicios");
        }

        if (!muscleRes.ok) {
          throw new Error(muscleData?.error || "Error cargando músculos");
        }

        setAvailableExercises(
          Array.isArray(exerciseData) ? exerciseData : exerciseData.exercises || []
        );
        setAvailableMuscles(
          Array.isArray(muscleData) ? muscleData : muscleData.muscles || []
        );
      } catch (err: any) {
        setAvailableExercises([]);
        setAvailableMuscles([]);
        setError(err?.message || "No se pudieron cargar ejercicios o músculos");
      } finally {
        setLoadingExercises(false);
      }
    }

    loadInitialData();
  }, []);

  function addExercise() {
    setExercises((prev) => [
      ...prev,
      {
        exerciseId: "",
        sets: 3,
        reps: 10,
        weightKg: null,
        newExerciseName: "",
        newExerciseMuscles: [],
      },
    ]);
  }

  function updateExercise(
    index: number,
    field: keyof RoutineExerciseInput,
    value:
      | string
      | number
      | null
      | undefined
      | RoutineExerciseInput["newExerciseMuscles"]
  ) {
    setExercises((prev) =>
      prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex))
    );
  }

  function removeExercise(index: number) {
    setExercises((prev) => prev.filter((_, i) => i !== index));

    setSearchTerms((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });

    setIsCreatingNewExercise((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });

    if (openSearchIndex === index) {
      setOpenSearchIndex(null);
    }
  }

  function getExerciseName(exerciseId?: string) {
    if (!exerciseId || exerciseId === "__new") return "";
    return availableExercises.find((e) => e.id === exerciseId)?.name ?? "";
  }

  function getFilteredExercises(index: number) {
    const term = (searchTerms[index] ?? "").toLowerCase().trim();

    if (!term) return availableExercises.slice(0, 8);

    return availableExercises
      .filter((e) => e.name.toLowerCase().includes(term))
      .slice(0, 8);
  }

  function addNewExerciseMuscle(index: number) {
    const current = exercises[index]?.newExerciseMuscles ?? [];
    const total = getTotalMusclePercentage(current);

    if (total >= 100) return;

    setExercises((prev) =>
      prev.map((ex, i) =>
        i === index
          ? {
              ...ex,
              newExerciseMuscles: [
                ...(ex.newExerciseMuscles ?? []),
                { muscleId: "", percentage: 0 },
              ],
            }
          : ex
      )
    );
  }

  function updateNewExerciseMuscle(
    exerciseIndex: number,
    muscleIndex: number,
    field: "muscleId" | "percentage",
    value: string | number
  ) {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exerciseIndex) return ex;

        const nextMuscles = [...(ex.newExerciseMuscles ?? [])];
        const current = nextMuscles[muscleIndex];

        if (!current) return ex;

        if (field === "percentage") {
          const numericValue = Number(value) || 0;

          const otherTotal = nextMuscles.reduce((sum, item, idx) => {
            if (idx === muscleIndex) return sum;
            return sum + (Number(item.percentage) || 0);
          }, 0);

          const clamped = Math.max(0, Math.min(100 - otherTotal, numericValue));

          nextMuscles[muscleIndex] = {
            ...current,
            percentage: clamped,
          };
        } else {
          nextMuscles[muscleIndex] = {
            ...current,
            muscleId: String(value),
          };
        }

        return {
          ...ex,
          newExerciseMuscles: nextMuscles,
        };
      })
    );
  }

  function removeNewExerciseMuscle(exerciseIndex: number, muscleIndex: number) {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exerciseIndex) return ex;

        return {
          ...ex,
          newExerciseMuscles: (ex.newExerciseMuscles ?? []).filter(
            (_, idx) => idx !== muscleIndex
          ),
        };
      })
    );
  }

  function validateNewExerciseMuscles(
    newExerciseMuscles: { muscleId: string; percentage: number }[]
  ) {
    if (newExerciseMuscles.length === 0) {
      return "Tenés que definir al menos un músculo para el nuevo ejercicio.";
    }

    const usedMuscles = new Set<string>();
    let total = 0;

    for (const item of newExerciseMuscles) {
      if (!item.muscleId) {
        return "Todos los músculos del nuevo ejercicio deben estar seleccionados.";
      }

      if (usedMuscles.has(item.muscleId)) {
        return "No podés repetir el mismo músculo en el nuevo ejercicio.";
      }

      usedMuscles.add(item.muscleId);

      if (!Number.isFinite(item.percentage) || item.percentage <= 0) {
        return "Todos los porcentajes del nuevo ejercicio deben ser mayores a 0.";
      }

      total += item.percentage;
    }

    if (total !== 100) {
      return "Los porcentajes del nuevo ejercicio deben sumar exactamente 100.";
    }

    return null;
  }

  const routineShare = useMemo(() => {
    const normalizedExercises = exercises
      .map((routineExercise, index) => {
        const exercise = availableExercises.find(
          (item) => item.id === routineExercise.exerciseId
        );

        if (!exercise) {
          return null;
        }

        return {
          id: `${exercise.id}-${index}`,
          sets: routineExercise.sets,
          reps: routineExercise.reps,
          weightKg: routineExercise.weightKg ?? null,
          exercise: {
            id: exercise.id,
            name: exercise.name,
            muscles: (exercise.muscles ?? []).map((m) => ({
              percentage: m.percentage,
              muscle: {
                id: m.muscle.id,
                name: m.muscle.name,
                slug: m.muscle.slug ?? m.muscle.id,
                groupKey: m.muscle.groupKey ?? "other",
              },
            })),
          },
        };
      })
      .filter(Boolean) as Parameters<typeof calculateRoutineMuscleShare>[0];

    return calculateRoutineMuscleShare(normalizedExercises);
  }, [exercises, availableExercises]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("El nombre de la rutina es requerido");
      return;
    }

    if (exercises.length === 0) {
      setError("La rutina debe tener al menos un ejercicio");
      return;
    }

    const finalExercises = [...exercises];

    for (let i = 0; i < finalExercises.length; i++) {
      const current = finalExercises[i];

      if (!current.exerciseId && !current.newExerciseName?.trim()) {
        setError("Cada bloque debe tener un ejercicio seleccionado o creado.");
        return;
      }

      if (
        current.exerciseId === "__new" ||
        (!current.exerciseId && current.newExerciseName)
      ) {
        const newName = current.newExerciseName?.trim();

        if (!newName) {
          setError("El nombre del nuevo ejercicio es requerido.");
          return;
        }

        const newExerciseMuscles = current.newExerciseMuscles ?? [];
        const muscleValidationError = validateNewExerciseMuscles(newExerciseMuscles);

        if (muscleValidationError) {
          setError(muscleValidationError);
          return;
        }

        const res = await fetch("/api/exercise/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newName,
            muscles: newExerciseMuscles,
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setError(data?.error || "Error creando ejercicio");
          return;
        }

        finalExercises[i] = {
          ...current,
          exerciseId: data.id,
          newExerciseName: undefined,
          newExerciseMuscles: undefined,
        };

        setAvailableExercises((prev) => [
          ...prev,
          {
            id: data.id,
            name: data.name ?? newName,
            muscles: Array.isArray(data.muscles) ? data.muscles : [],
          },
        ]);
      }
    }

    setLoading(true);

    const endpoint = isEdit ? `/api/routine/${routineId}` : "/api/routine/create";
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          exercises: finalExercises.map((item) => ({
            exerciseId: item.exerciseId,
            sets: item.sets,
            reps: item.reps,
            weightKg:
              item.weightKg === null || item.weightKg === undefined || item.weightKg === 0
                ? null
                : Number(item.weightKg),
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Error guardando rutina");
        return;
      }

      router.push("/routine");
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#08142d] p-6 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center rounded-md bg-slate-600 px-4 py-2 text-sm font-medium hover:bg-slate-500"
          >
            ← Volver atrás
          </button>
        </div>

        <div className="rounded-2xl bg-slate-800 p-6 shadow-lg">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">
              {isEdit ? "Editar rutina" : "Crear rutina"}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Armá tu rutina y revisá qué grupos musculares predominan.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-2xl bg-slate-900/70 p-5">
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Nombre de la rutina
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre de la rutina"
                className="w-full rounded-lg bg-slate-700 px-3 py-2 text-white outline-none ring-1 ring-transparent placeholder:text-slate-400 focus:ring-lime-500"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-900/70 p-5">
                <h3 className="mb-3 text-lg font-semibold">Grupos principales</h3>

                {routineShare.groups.length === 0 ? (
                  <div className="text-sm text-slate-400">
                    Sin datos suficientes todavía.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {routineShare.groups.map((group) => (
                      <span
                        key={group.groupKey}
                        className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200"
                      >
                        {formatGroupLabel(group.groupKey)} {group.sharePct}%
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-slate-900/70 p-5">
                <h3 className="mb-3 text-lg font-semibold">Músculos trabajados</h3>

                {routineShare.muscles.length === 0 ? (
                  <div className="text-sm text-slate-400">
                    A medida que agregues ejercicios, vas a ver el porcentaje estimado.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {routineShare.muscles.slice(0, 6).map((muscle) => (
                      <div key={muscle.muscleId}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="text-slate-200">{muscle.muscleName}</span>
                          <span className="text-slate-400">{muscle.sharePct}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-700">
                          <div
                            className="h-2 rounded-full bg-lime-500"
                            style={{ width: `${muscle.sharePct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/70 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Ejercicios</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Agregá ejercicios, series, repeticiones y peso.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addExercise}
                  className="rounded-md bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500"
                >
                  + Agregar ejercicio
                </button>
              </div>

              {loadingExercises ? (
                <div className="text-sm text-slate-400">Cargando ejercicios...</div>
              ) : exercises.length === 0 ? (
                <div className="rounded-xl bg-slate-800 p-4 text-sm text-slate-400">
                  Todavía no agregaste ejercicios.
                </div>
              ) : (
                <div className="space-y-4">
                  {exercises.map((ex, index) => {
                    const selectedExerciseName = getExerciseName(ex.exerciseId);
                    const filteredExercises = getFilteredExercises(index);
                    const newExerciseMuscles = ex.newExerciseMuscles ?? [];
                    const muscleTotal = getTotalMusclePercentage(newExerciseMuscles);

                    return (
                      <div key={index} className="rounded-xl bg-slate-800 p-4 space-y-4">
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.8fr_120px_140px_140px]">
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-200">
                              Ejercicio
                            </label>

                            {!isCreatingNewExercise[index] ? (
                              <>
                                {ex.exerciseId && openSearchIndex !== index ? (
                                  <div className="rounded-lg bg-slate-900 px-3 py-2">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-slate-100">{selectedExerciseName}</span>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenSearchIndex(index);
                                          setSearchTerms((prev) => ({
                                            ...prev,
                                            [index]: "",
                                          }));
                                        }}
                                        className="text-sm text-lime-400 hover:text-lime-300"
                                      >
                                        Cambiar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <input
                                      value={searchTerms[index] ?? ""}
                                      onChange={(e) => {
                                        setSearchTerms((prev) => ({
                                          ...prev,
                                          [index]: e.target.value,
                                        }));
                                        setOpenSearchIndex(index);
                                        updateExercise(index, "exerciseId", "");
                                      }}
                                      onFocus={() => setOpenSearchIndex(index)}
                                      placeholder="Buscar ejercicio..."
                                      className="w-full rounded-lg bg-slate-900 px-3 py-2 text-white outline-none ring-1 ring-transparent placeholder:text-slate-400 focus:ring-lime-500"
                                    />

                                    {openSearchIndex === index ? (
                                      <div className="max-h-48 overflow-y-auto rounded-lg bg-slate-900">
                                        {filteredExercises.length > 0 ? (
                                          filteredExercises.map((exercise) => (
                                            <button
                                              key={exercise.id}
                                              type="button"
                                              onClick={() => {
                                                updateExercise(index, "exerciseId", exercise.id);
                                                updateExercise(index, "newExerciseName", "");
                                                updateExercise(index, "newExerciseMuscles", []);
                                                setSearchTerms((prev) => {
                                                  const next = { ...prev };
                                                  delete next[index];
                                                  return next;
                                                });
                                                setOpenSearchIndex(null);
                                              }}
                                              className="block w-full text-left px-3 py-2 text-slate-100 hover:bg-slate-700"
                                            >
                                              {exercise.name}
                                            </button>
                                          ))
                                        ) : (
                                          <div className="px-3 py-2 text-sm text-slate-400">
                                            No hay coincidencias.
                                          </div>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setIsCreatingNewExercise((prev) => ({
                                              ...prev,
                                              [index]: true,
                                            }));
                                            updateExercise(index, "exerciseId", "__new");
                                            setOpenSearchIndex(null);
                                          }}
                                          className="block w-full text-left px-3 py-2 text-lime-400 hover:bg-slate-700"
                                        >
                                          + Crear nuevo ejercicio
                                        </button>
                                      </div>
                                    ) : null}
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                <input
                                  value={ex.newExerciseName || ""}
                                  onChange={(e) =>
                                    updateExercise(index, "newExerciseName", e.target.value)
                                  }
                                  placeholder="Nombre del nuevo ejercicio"
                                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-white outline-none ring-1 ring-transparent placeholder:text-slate-400 focus:ring-lime-500"
                                />

                                <div className="rounded-xl bg-slate-900 p-3 space-y-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <div className="text-sm font-medium text-slate-200">
                                        Músculos trabajados
                                      </div>
                                      <div className="text-xs text-slate-400">
                                        Total actual: {muscleTotal} / 100
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => addNewExerciseMuscle(index)}
                                      disabled={muscleTotal >= 100}
                                      className="rounded-md bg-slate-600 px-3 py-1 text-xs font-medium text-white hover:bg-slate-500 disabled:opacity-50"
                                    >
                                      + Agregar músculo
                                    </button>
                                  </div>

                                  {newExerciseMuscles.length === 0 ? (
                                    <div className="text-sm text-slate-400">
                                      Agregá al menos un músculo y su porcentaje.
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {newExerciseMuscles.map((item, muscleIndex) => (
                                        <div
                                          key={`${index}-${muscleIndex}`}
                                          className="grid grid-cols-1 gap-3 md:grid-cols-[1.5fr_120px_90px]"
                                        >
                                          <select
                                            value={item.muscleId}
                                            onChange={(e) =>
                                              updateNewExerciseMuscle(
                                                index,
                                                muscleIndex,
                                                "muscleId",
                                                e.target.value
                                              )
                                            }
                                            className="rounded-lg bg-slate-800 px-3 py-2 text-white outline-none ring-1 ring-transparent focus:ring-lime-500"
                                          >
                                            <option value="">Seleccionar músculo</option>
                                            {availableMuscles.map((muscle) => (
                                              <option key={muscle.id} value={muscle.id}>
                                                {muscle.name} ({formatGroupLabel(muscle.groupKey)})
                                              </option>
                                            ))}
                                          </select>

                                          <input
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={item.percentage}
                                            onChange={(e) =>
                                              updateNewExerciseMuscle(
                                                index,
                                                muscleIndex,
                                                "percentage",
                                                Number(e.target.value)
                                              )
                                            }
                                            className="rounded-lg bg-slate-800 px-3 py-2 text-white outline-none ring-1 ring-transparent focus:ring-lime-500"
                                            placeholder="%"
                                          />

                                          <button
                                            type="button"
                                            onClick={() =>
                                              removeNewExerciseMuscle(index, muscleIndex)
                                            }
                                            className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
                                          >
                                            Quitar
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <div className="text-xs text-slate-400">
                                    La suma total de porcentajes debe ser exactamente 100.
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCreatingNewExercise((prev) => ({
                                      ...prev,
                                      [index]: false,
                                    }));
                                    updateExercise(index, "exerciseId", "");
                                    updateExercise(index, "newExerciseName", "");
                                    updateExercise(index, "newExerciseMuscles", []);
                                  }}
                                  className="text-sm text-slate-400 hover:text-slate-200"
                                >
                                  Cancelar creación
                                </button>
                              </>
                            )}
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-200">
                              Series
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={ex.sets}
                              onChange={(e) =>
                                updateExercise(index, "sets", Number(e.target.value))
                              }
                              className="w-full rounded-lg bg-slate-700 px-3 py-2 text-white outline-none ring-1 ring-transparent focus:ring-lime-500"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-200">
                              Repeticiones
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={ex.reps}
                              onChange={(e) =>
                                updateExercise(index, "reps", Number(e.target.value))
                              }
                              className="w-full rounded-lg bg-slate-700 px-3 py-2 text-white outline-none ring-1 ring-transparent focus:ring-lime-500"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-200">
                              Peso (kg)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="0.5"
                              value={ex.weightKg ?? ""}
                              onChange={(e) =>
                                updateExercise(
                                  index,
                                  "weightKg",
                                  e.target.value === "" ? null : Number(e.target.value)
                                )
                              }
                              placeholder="Opcional"
                              className="w-full rounded-lg bg-slate-700 px-3 py-2 text-white outline-none ring-1 ring-transparent placeholder:text-slate-400 focus:ring-lime-500"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeExercise(index)}
                          className="text-sm text-red-400 hover:text-red-300"
                        >
                          Eliminar ejercicio
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {error ? (
              <div className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-gradient-to-b from-lime-600 to-lime-800 px-6 py-2 font-semibold text-white shadow-md hover:from-lime-500 hover:to-lime-700 disabled:opacity-60"
              >
                {loading ? "Guardando..." : "Guardar rutina"}
              </button>

              <button
                type="button"
                onClick={() => router.back()}
                className="rounded-md bg-slate-600 px-4 py-2 font-medium hover:bg-slate-500"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}