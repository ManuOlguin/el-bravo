"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ================== Types ==================
type RoutineExercise = {
  id: string;
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
};

type Routine = {
  id: string;
  name: string;
  exercises: RoutineExercise[];
};

// ================== Page ==================
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
      const res = await fetch("/api/routine/list");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error cargando rutinas");
      setRoutines(Array.isArray(data) ? data : data.routines || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteRoutine(id: string) {
    if (!confirm("¿Eliminar rutina?") ) return;
    const res = await fetch(`/api/routine/${id}`, { method: "DELETE" });
    if (res.ok) load();
  }

  if (loading) {
    return <div className="p-6 text-white">Cargando...</div>;
  }

  return (
    
    <main className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
      <a href="/dashboard" className="inline-flex items-center px-3 py-2 bg-gray-700 rounded-md text-sm hover:bg-gray-600">← Volver al dashboard</a>
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Mis rutinas</h1>
          <button
            onClick={() => router.push("/../create-routine")}
            className="px-4 py-2 bg-indigo-600 rounded-md"
          >
            + Nueva rutina
          </button>
        </header>

        {error && <p className="text-red-400">{error}</p>}

        {routines.length === 0 ? (
          <div className="bg-gray-800 p-6 rounded-md text-gray-300">
            No tenés rutinas creadas.
          </div>
        ) : (
          <div className="space-y-4">
            {routines.map((r) => (
              <div key={r.id} className="bg-gray-800 rounded-md p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">{r.name}</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/routine/${r.id}/edit`)}
                      className="px-3 py-1 bg-yellow-600 rounded text-sm"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteRoutine(r.id)}
                      className="px-3 py-1 bg-red-600 rounded text-sm"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                <ul className="text-sm text-gray-300 list-disc ml-5">
                  {r.exercises.map((ex) => (
                    <li key={ex.id}>
                      {ex.name} – {ex.sets}x{ex.reps}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
