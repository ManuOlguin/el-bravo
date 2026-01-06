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

  // 👉 CLAVE: step inicial depende del modo
  const [step, setStep] = useState<number>(isEdit ? 1 : 0);

  const [name, setName] = useState<string>(initialName);
  const [exercises, setExercises] =
    useState<RoutineExerciseInput[]>(initialExercises);

  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
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
      setStep(1);
      return;
    }

    setLoading(true);

    const finalExercises: RoutineExerciseInput[] = [...exercises];

    // Crear ejercicios nuevos
    for (let i = 0; i < finalExercises.length; i++) {
      if (finalExercises[i].exerciseId === "__new") {
        const newName = finalExercises[i].newExerciseName;

        if (!newName || !newName.trim()) {
          setError("El nombre del nuevo ejercicio es requerido");
          setStep(1);
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

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "Error guardando rutina");
        setLoading(false);
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
    <main className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center">
      <div className="w-full max-w-2xl bg-gray-800 rounded-lg p-6 space-y-4">
        <h1 className="text-2xl font-semibold">
          {isEdit ? "Editar rutina" : "Crear rutina"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ===== Nombre (solo CREATE) ===== */}
          {!isEdit && step === 0 && (
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre de la rutina"
              className="w-full px-3 py-2 bg-gray-700 rounded-md"
            />
          )}

          {/* ===== Ejercicios ===== */}
          {step === 1 && (
            <div className="space-y-4">
              {exercises.map((ex, index) => (
                <div key={index} className="bg-gray-700 p-4 rounded-md">
                  <select
                    value={ex.exerciseId}
                    onChange={e =>
                      updateExercise(index, "exerciseId", e.target.value)
                    }
                    className="w-full bg-gray-800 p-2 rounded"
                  >
                    <option value="">Seleccionar ejercicio</option>
                    {availableExercises.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                    <option value="__new">➕ Crear nuevo</option>
                  </select>

                  {ex.exerciseId === "__new" && (
                    <input
                      value={ex.newExerciseName || ""}
                      onChange={e =>
                        updateExercise(
                          index,
                          "newExerciseName",
                          e.target.value
                        )
                      }
                      placeholder="Nombre del nuevo ejercicio"
                      className="w-full mt-2 p-2 bg-gray-900 rounded"
                    />
                  )}

                  <div className="flex gap-2 mt-2">
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
                    className="text-red-400 text-xs mt-2"
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

          {/* ===== Navegación ===== */}
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
