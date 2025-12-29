"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type RoutineExerciseInput = {
  exerciseId: string;
  sets: number;
  reps: number;
};

export default function CreateRoutinePage() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [exercises, setExercises] = useState<RoutineExerciseInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = () => setStep((s) => Math.min(s + 1, 2));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  function addExercise() {
    setExercises((prev) => [
      ...prev,
      { exerciseId: "", sets: 3, reps: 10 }
    ]);
  }

  const [newExerciseName, setNewExerciseName] = useState("");

  type Exercise = {
    id: string;
    name: string;
  };
  
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);

  useEffect(() => {
    fetch("/api/exercise/list")
      .then(async (res) => {
        if (!res.ok) throw new Error("Error cargando ejercicios");
        return res.json();
      })
      .then((data) => {
        // 🔴 CLAVE: aseguramos que sea array
        if (Array.isArray(data)) {
          setAvailableExercises(data);
        } else if (Array.isArray(data.exercises)) {
          setAvailableExercises(data.exercises);
        } else {
          setAvailableExercises([]);
        }
      })
      .catch(() => setAvailableExercises([]));
  }, []);

  function updateExercise(index: number, field: keyof RoutineExerciseInput, value: any) {
    setExercises((prev) =>
      prev.map((ex, i) =>
        i === index ? { ...ex, [field]: value } : ex
      )
    );
  }

  function removeExercise(index: number) {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreate(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("El nombre de la rutina es requerido");
      setStep(0);
      return;
    }

    if (exercises.length === 0) {
      setError("La rutina debe tener al menos un ejercicio");
      setStep(1);
      return;
    }

    if (exercises.some(e => !e.exerciseId || e.sets < 1 || e.reps < 1)) {
      setError("Todos los ejercicios deben tener sets, reps y ejercicio válido");
      setStep(1);
      return;
    }

    setLoading(true);

    let finalExercises = [...exercises];

    for (let i = 0; i < finalExercises.length; i++) {
      if (finalExercises[i].exerciseId === "__new") {
        if (!newExerciseName.trim()) {
          setError("El nombre del nuevo ejercicio es requerido");
          setStep(1);
          setLoading(false);
          return;
        }

        const res = await fetch("/api/exercise/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newExerciseName })
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data?.error || "Error creando el ejercicio");
          setLoading(false);
          return;
        }

        finalExercises[i].exerciseId = data.id;
      }
    }

    try {
      const res = await fetch("/api/routine/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          exercises: finalExercises
        })
      });

      const data = await res.json().catch(() => ({}));
      setLoading(false);

      if (!res.ok) {
        setError(data?.error || "Error creando la rutina");
        return;
      }

      router.push("/routine");
    } catch {
      setLoading(false);
      setError("Error de red");
    }
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center">
      <div className="w-full max-w-2xl">
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h1 className="text-2xl font-semibold mb-4">Crear rutina</h1>

          {/* Steps */}
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <StepDot active={step >= 0} label="Nombre" />
              <div className="h-px bg-gray-700 flex-1" />
              <StepDot active={step >= 1} label="Ejercicios" />
              <div className="h-px bg-gray-700 flex-1" />
              <StepDot active={step >= 2} label="Confirmar" />
            </div>
          </div>

          <form onSubmit={handleCreate} className="space-y-4">
            {/* STEP 0 */}
            {step === 0 && (
              <div>
                <label className="block text-sm text-gray-200 mb-1">
                  Nombre de la rutina
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Push Day"
                  className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md placeholder-gray-400"
                />
              </div>
            )}

            {/* STEP 1 */}
            {step === 1 && (
              <div className="space-y-4">
                {exercises.map((ex, index) => (
                  <div key={index} className="bg-gray-700 p-4 rounded-md space-y-2">
                    <div className="space-y-2">
                      <label className="block text-xs text-gray-300 mb-1">
                        Ejercicio
                      </label>

                      <select
                        value={ex.exerciseId}
                        onChange={(e) => updateExercise(index, "exerciseId", e.target.value)}
                        className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded-md text-sm"
                      >
                        <option value="">Seleccionar ejercicio</option>

                        {Array.isArray(availableExercises) &&
                        availableExercises.map((exercise) => (
                          <option key={exercise.id} value={exercise.id}>
                            {exercise.name}
                          </option>
                        ))}

                        <option value="__new">➕ Crear nuevo ejercicio</option>
                      </select>

                      {ex.exerciseId === "__new" && (
                        <input
                          value={newExerciseName}
                          onChange={(e) => setNewExerciseName(e.target.value)}
                          placeholder="Nombre del nuevo ejercicio"
                          className="w-full px-2 py-1 bg-gray-900 border border-gray-600 rounded-md text-sm"
                        />
                      )}
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-300 mb-1">Sets</label>
                        <input
                          type="number"
                          min={1}
                          value={ex.sets}
                          onChange={(e) => updateExercise(index, "sets", Number(e.target.value))}
                          className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded-md"
                        />
                      </div>

                      <div className="flex-1">
                        <label className="block text-xs text-gray-300 mb-1">Reps</label>
                        <input
                          type="number"
                          min={1}
                          value={ex.reps}
                          onChange={(e) => updateExercise(index, "reps", Number(e.target.value))}
                          className="w-full px-2 py-1 bg-gray-800 border border-gray-600 rounded-md"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeExercise(index)}
                      className="text-xs text-red-400 mt-2"
                    >
                      Eliminar ejercicio
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addExercise}
                  className="px-3 py-2 bg-indigo-600 rounded-md text-sm"
                >
                  + Agregar ejercicio
                </button>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div>
                <h3 className="text-lg font-medium mb-2">Confirmar rutina</h3>
                <div className="text-sm text-gray-300 space-y-2">
                  <div><strong>Nombre:</strong> {name}</div>
                  <div>
                    <strong>Ejercicios:</strong>
                    <ul className="list-disc ml-5 mt-1">
                      {exercises.map((ex, i) => (
                        <li key={i}>
                          {ex.exerciseId} – {ex.sets}x{ex.reps}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={back}
                disabled={step === 0}
                className="px-3 py-2 bg-gray-700 rounded-md"
              >
                Atrás
              </button>

              {step < 2 ? (
                <button
                  type="button"
                  onClick={next}
                  className="px-4 py-2 bg-indigo-600 rounded-md"
                >
                  Siguiente
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 rounded-md disabled:opacity-50"
                >
                  {loading ? "Creando..." : "Crear rutina"}
                </button>
              )}

              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="ml-auto px-3 py-2 bg-gray-600 rounded-md"
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

function StepDot({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center ${
          active ? "bg-indigo-500" : "bg-gray-700"
        }`}
      >
        <div className="w-3 h-3 rounded-full bg-white/80" />
      </div>
      <div className="text-xs text-gray-300 hidden sm:block">{label}</div>
    </div>
  );
}