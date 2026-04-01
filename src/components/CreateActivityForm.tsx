"use client";

import { useEffect, useMemo, useState } from "react";

type AvailableExercise = {
  id: string;
  name: string;
};

type RoutineExercise = {
  id?: string;
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  weightKg?: number | null;
};

type RoutineItem = {
  id: string;
  name: string;
  exercises: RoutineExercise[];
};

type ActivityExerciseFormItem = {
  exerciseId: string;
  sets: number;
  reps: number;
  weightKg: string;
};

function twoDigits(n: number) {
  return String(n).padStart(2, "0");
}

function getDefaultDate() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function getDefaultStartTime() {
  const now = new Date();
  return `${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}`;
}

function buildDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

export default function CreateActivityForm() {
  const [availableExercises, setAvailableExercises] = useState<AvailableExercise[]>([]);
  const [routines, setRoutines] = useState<RoutineItem[]>([]);

  const [activityType, setActivityType] = useState("gym");
  const [date, setDate] = useState(getDefaultDate());
  const [startTime, setStartTime] = useState(getDefaultStartTime());
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [selectedRoutineId, setSelectedRoutineId] = useState("");
  const [notes, setNotes] = useState("");

  const [exercises, setExercises] = useState<ActivityExerciseFormItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoadingData(true);
        setError("");

        const [exerciseRes, routineRes] = await Promise.all([
          fetch("/api/exercise/list", { cache: "no-store" }),
          fetch("/api/routine/list", { cache: "no-store" }),
        ]);

        const exerciseData = await exerciseRes.json().catch(() => ({}));
        const routineData = await routineRes.json().catch(() => ({}));

        if (!exerciseRes.ok) {
          throw new Error(exerciseData?.error || "No se pudieron cargar los ejercicios.");
        }

        if (!routineRes.ok) {
          throw new Error(routineData?.error || "No se pudieron cargar las rutinas.");
        }

        setAvailableExercises(
          Array.isArray(exerciseData)
            ? exerciseData
            : Array.isArray(exerciseData?.exercises)
              ? exerciseData.exercises
              : []
        );

        setRoutines(
          Array.isArray(routineData)
            ? routineData
            : Array.isArray(routineData?.routines)
              ? routineData.routines
              : []
        );
      } catch (err: any) {
        console.error("Error cargando datos de actividades:", err);
        setError(err?.message || "Error cargando ejercicios y rutinas.");
      } finally {
        setLoadingData(false);
      }
    }

    loadData();
  }, []);

  const selectedRoutine = useMemo(
    () => routines.find((routine) => routine.id === selectedRoutineId) ?? null,
    [routines, selectedRoutineId]
  );

  function applyRoutine(routineId: string) {
    setSelectedRoutineId(routineId);
    setError("");

    const routine = routines.find((item) => item.id === routineId);

    if (!routine) {
      setExercises([]);
      return;
    }

    const mapped = routine.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      sets: Number(exercise.sets ?? 3),
      reps: Number(exercise.reps ?? 10),
      weightKg:
        exercise.weightKg !== null && exercise.weightKg !== undefined
          ? String(exercise.weightKg)
          : "",
    }));

    setExercises(mapped);
  }

  function addExercise() {
    setError("");
    setExercises((prev) => [
      ...prev,
      {
        exerciseId: "",
        sets: 3,
        reps: 10,
        weightKg: "",
      },
    ]);
  }

  function updateExercise(index: number, patch: Partial<ActivityExerciseFormItem>) {
    setError("");
    setExercises((prev) =>
      prev.map((exercise, i) => (i === index ? { ...exercise, ...patch } : exercise))
    );
  }

  function removeExercise(index: number) {
    setError("");
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");

    if (!date || !startTime) {
      setError("Completá la fecha y la hora de inicio.");
      return;
    }

    const duration = Number(durationMinutes);

    if (!Number.isFinite(duration) || duration <= 0) {
      setError("La duración debe ser mayor a 0 minutos.");
      return;
    }

    if (exercises.length === 0) {
      setError("Tenés que agregar al menos un ejercicio para guardar la actividad.");
      return;
    }

    for (const exercise of exercises) {
      if (!exercise.exerciseId) {
        setError("Todos los ejercicios deben estar seleccionados.");
        return;
      }

      if (!exercise.sets || exercise.sets <= 0) {
        setError("Todas las series deben ser mayores a 0.");
        return;
      }

      if (!exercise.reps || exercise.reps <= 0) {
        setError("Todas las repeticiones deben ser mayores a 0.");
        return;
      }

      if (
        exercise.weightKg.trim() !== "" &&
        (!Number.isFinite(Number(exercise.weightKg)) || Number(exercise.weightKg) < 0)
      ) {
        setError("El peso debe ser un número válido mayor o igual a 0.");
        return;
      }
    }

    const startedAt = buildDateTime(date, startTime);

    if (Number.isNaN(startedAt.getTime())) {
      setError("La fecha u hora de inicio no son válidas.");
      return;
    }

    const endedAt = new Date(startedAt.getTime() + duration * 60 * 1000);

    setSaving(true);

    try {
      const payload = {
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        type: activityType,
        notes: notes.trim() || null,
        routineId: selectedRoutineId || null,
        exercises: exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          sets: Number(exercise.sets),
          reps: Number(exercise.reps),
          weightKg: exercise.weightKg.trim() === "" ? null : Number(exercise.weightKg),
        })),
      };

      const res = await fetch("/api/activities/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "No se pudo crear la actividad.");
        return;
      }

      window.history.back();
    } catch (err) {
      console.error("Error creando actividad:", err);
      setError("Ocurrió un error de red al guardar la actividad.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl bg-slate-900/60 p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Cargar actividad</h1>
        <p className="mt-2 text-sm text-slate-400">
          Registrá tu entrenamiento de forma simple, con rutina, ejercicios y peso.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-slate-800 p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Tipo de actividad
            </label>
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="w-full rounded-lg bg-slate-700 px-3 py-3 text-white outline-none"
            >
              <option value="gym">Gimnasio</option>
              <option value="run">Running</option>
              <option value="sport">Deporte</option>
              <option value="mobility">Movilidad</option>
              <option value="other">Otro</option>
            </select>
          </div>

          <div className="rounded-xl bg-slate-800 p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Rutina
            </label>
            <select
              value={selectedRoutineId}
              onChange={(e) => applyRoutine(e.target.value)}
              className="w-full rounded-lg bg-slate-700 px-3 py-3 text-white outline-none"
            >
              <option value="">-- Ninguna --</option>
              {routines.map((routine) => (
                <option key={routine.id} value={routine.id}>
                  {routine.name}
                </option>
              ))}
            </select>

            {selectedRoutine ? (
              <p className="mt-2 text-xs text-slate-400">
                Se cargaron automáticamente {selectedRoutine.exercises.length} ejercicios.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-slate-800 p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg bg-slate-700 px-3 py-3 text-white outline-none"
            />
          </div>

          <div className="rounded-xl bg-slate-800 p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Hora de inicio
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg bg-slate-700 px-3 py-3 text-white outline-none"
            />
          </div>

          <div className="rounded-xl bg-slate-800 p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-200">
              Duración (minutos)
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-full rounded-lg bg-slate-700 px-3 py-3 text-white outline-none"
              placeholder="Ej: 90"
            />
          </div>
        </div>

        <div className="rounded-xl bg-slate-800 p-4">
          <label className="mb-2 block text-sm font-semibold text-slate-200">
            Notas
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded-lg bg-slate-700 px-3 py-3 text-white outline-none"
            placeholder="Cómo te sentiste, observaciones, etc."
          />
        </div>

        <div className="rounded-xl bg-slate-800 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Ejercicios</h2>
              <p className="text-sm text-slate-400">
                Agregá ejercicios, series, repeticiones y peso.
              </p>
            </div>

            <button
              type="button"
              onClick={addExercise}
              className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-500"
            >
              + Agregar ejercicio
            </button>
          </div>

          {loadingData ? (
            <div className="rounded-lg bg-slate-900 px-4 py-4 text-sm text-slate-400">
              Cargando ejercicios y rutinas...
            </div>
          ) : exercises.length === 0 ? (
            <div className="rounded-lg bg-slate-900 px-4 py-4 text-sm text-slate-400">
              Todavía no agregaste ejercicios.
            </div>
          ) : (
            <div className="space-y-4">
              {exercises.map((exercise, index) => (
                <div
                  key={`${exercise.exerciseId}-${index}`}
                  className="rounded-xl bg-slate-900 p-4"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-200">
                        Ejercicio
                      </label>
                      <select
                        value={exercise.exerciseId}
                        onChange={(e) =>
                          updateExercise(index, { exerciseId: e.target.value })
                        }
                        className="w-full rounded-lg bg-slate-700 px-3 py-3 text-white outline-none"
                      >
                        <option value="">Seleccionar ejercicio</option>
                        {availableExercises.map((availableExercise) => (
                          <option key={availableExercise.id} value={availableExercise.id}>
                            {availableExercise.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-200">
                        Series
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={exercise.sets}
                        onChange={(e) =>
                          updateExercise(index, { sets: Number(e.target.value) })
                        }
                        className="w-full rounded-lg bg-slate-700 px-3 py-3 text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-200">
                        Reps
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={exercise.reps}
                        onChange={(e) =>
                          updateExercise(index, { reps: Number(e.target.value) })
                        }
                        className="w-full rounded-lg bg-slate-700 px-3 py-3 text-white outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-200">
                        Peso (kg)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.5"
                        value={exercise.weightKg}
                        onChange={(e) =>
                          updateExercise(index, { weightKg: e.target.value })
                        }
                        className="w-full rounded-lg bg-slate-700 px-3 py-3 text-white outline-none"
                        placeholder="Opcional"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => removeExercise(index)}
                        className="rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {exercises.length === 0 ? (
            <p className="mt-3 text-sm text-amber-300">
              Tenés que agregar al menos un ejercicio para guardar la actividad.
            </p>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving || exercises.length === 0}
            className="rounded-lg bg-gradient-to-b from-lime-600 to-lime-800 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:from-lime-500 hover:to-lime-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar actividad"}
          </button>

          <button
            type="button"
            onClick={() => window.history.back()}
            className="rounded-lg bg-slate-600 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-500"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}