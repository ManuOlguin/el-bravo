"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ================== Types ==================
export type RoutineExerciseInput = {
  exerciseId: string;
  sets: number;
  reps: number;
  newExerciseName?: string;
};

type Exercise = {
  id: string;
  name: string;
};

type RoutineFormProps = {
  mode: "create" | "edit";
  routineId?: string;
  initialName?: string;
  initialExercises?: RoutineExerciseInput[];
};

// ================== Component ==================
export default function RoutineForm({
  mode,
  routineId,
  initialName = "",
  initialExercises = []
}: RoutineFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [step, setStep] = useState<number>(isEdit ? 1 : 0);
  const [name, setName] = useState<string>(initialName);
  const [exercises, setExercises] =
    useState<RoutineExerciseInput[]>(initialExercises);

  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [searchTerms, setSearchTerms] = useState<Record<number, string | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ================== Load exercises ==================
  useEffect(() => {
    fetch("/api/exercise/list")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableExercises(data);
        else if (Array.isArray(data.exercises))
          setAvailableExercises(data.exercises);
      })
      .catch(() => setAvailableExercises([]));
  }, []);

  // ================== Helpers ==================
  function addExercise() {
    setExercises(prev => [
      ...prev,
      { exerciseId: "", sets: 3, reps: 10 }
    ]);
  }

  function updateExercise(
    index: number,
    field: keyof RoutineExerciseInput,
    value: any
  ) {
    setExercises(prev =>
      prev.map((ex, i) =>
        i === index ? { ...ex, [field]: value } : ex
      )
    );
  }

  function removeExercise(index: number) {
    setExercises(prev => prev.filter((_, i) => i !== index));
  }

  function startSearch(index: number, value: string) {
    setSearchTerms(prev => ({ ...prev, [index]: value }));
  }

  function closeSearch(index: number) {
    setSearchTerms(prev => {
      const copy = { ...prev };
      delete copy[index];
      return copy;
    });
  }

  function getFilteredExercises(index: number) {
    const term = searchTerms[index]?.toLowerCase() ?? "";
    return availableExercises.filter(e =>
      e.name.toLowerCase().includes(term)
    );
  }

  function getExerciseName(exerciseId?: string) {
    if (!exerciseId || exerciseId === "__new") return "";
    return availableExercises.find(e => e.id === exerciseId)?.name ?? "";
  }

  function getInputValue(index: number, exerciseId?: string) {
    if (searchTerms[index] !== undefined) {
      return searchTerms[index];
    }
    return getExerciseName(exerciseId);
  }

  // ================== Submit ==================
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isEdit && !name.trim()) {
      setError("El nombre de la rutina es requerido");
      setStep(0);
      return;
    }

    if (exercises.length === 0) {
      setError("La rutina debe tener al menos un ejercicio");
      return;
    }

    setLoading(true);

    const finalExercises = [...exercises];

    for (let i = 0; i < finalExercises.length; i++) {
      if (finalExercises[i].exerciseId === "__new") {
        const newName = finalExercises[i].newExerciseName;

        if (!newName?.trim()) {
          setError("El nombre del nuevo ejercicio es requerido");
          setLoading(false);
          return;
        }

        const res = await fetch("/api/exercise/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName })
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data?.error || "Error creando ejercicio");
          setLoading(false);
          return;
        }

        finalExercises[i].exerciseId = data.id;
        delete finalExercises[i].newExerciseName;
      }
    }

    const endpoint = isEdit
      ? `/api/routine/${routineId}`
      : "/api/routine/create";

    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, exercises: finalExercises })
      });

      if (!res.ok) {
        const data = await res.json();
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

  // ================== UI ==================
  return (
    <main className="min-h-screen bg-gray-900 text-white p-6 flex justify-center">
      <div className="w-full max-w-2xl bg-gray-800 rounded-lg p-6 space-y-4">
        <h1 className="text-2xl font-semibold">
          {isEdit ? "Editar rutina" : "Crear rutina"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && step === 0 && (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre de la rutina"
              className="w-full px-3 py-2 bg-gray-700 rounded-md"
            />
          )}

          {step === 1 && (
            <div className="space-y-4">
              {exercises.map((ex, index) => (
                <div key={index} className="bg-gray-700 p-4 rounded-md space-y-2">
                  <input
                    value={getInputValue(index, ex.exerciseId)}
                    onChange={e => startSearch(index, e.target.value)}
                    placeholder="Buscar ejercicio..."
                    className="w-full bg-gray-900 p-2 rounded"
                  />

                  {searchTerms[index] !== undefined && (
                    <div className="max-h-40 overflow-y-auto bg-gray-900 rounded">
                      {getFilteredExercises(index).map(e => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => {
                            updateExercise(index, "exerciseId", e.id);
                            closeSearch(index);
                          }}
                          className="block w-full text-left px-3 py-2 hover:bg-gray-700"
                        >
                          {e.name}
                        </button>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          updateExercise(index, "exerciseId", "__new");
                          closeSearch(index);
                        }}
                        className="block w-full text-left px-3 py-2 text-indigo-400 hover:bg-gray-700"
                      >
                        ➕ Crear nuevo ejercicio
                      </button>
                    </div>
                  )}

                  {ex.exerciseId === "__new" && (
                    <input
                      value={ex.newExerciseName || ""}
                      onChange={e =>
                        updateExercise(index, "newExerciseName", e.target.value)
                      }
                      placeholder="Nombre del nuevo ejercicio"
                      className="w-full bg-gray-900 p-2 rounded"
                    />
                  )}

                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={ex.sets}
                      onChange={e =>
                        updateExercise(index, "sets", Number(e.target.value))
                      }
                      className="flex-1 bg-gray-800 p-2 rounded"
                    />
                    <input
                      type="number"
                      min={1}
                      value={ex.reps}
                      onChange={e =>
                        updateExercise(index, "reps", Number(e.target.value))
                      }
                      className="flex-1 bg-gray-800 p-2 rounded"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => removeExercise(index)}
                    className="text-red-400 text-xs"
                  >
                    Eliminar
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addExercise}
                className="bg-indigo-600 px-3 py-2 rounded"
              >
                + Agregar ejercicio
              </button>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-2">
            {!isEdit && step === 0 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="bg-indigo-600 px-3 py-2 rounded"
              >
                Siguiente
              </button>
            )}

            {step === 1 && (
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 px-4 py-2 rounded"
              >
                {loading ? "Guardando..." : "Guardar rutina"}
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
