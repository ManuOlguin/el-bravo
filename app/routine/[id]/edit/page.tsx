"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import RoutineForm from "@/src/components/RoutineForm";

export default function EditRoutinePage() {
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [routine, setRoutine] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/routine/${id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setRoutine(data);
      } catch {
        setError("No se pudo cargar la rutina");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id]);

  if (loading) return <div className="p-6 text-white">Cargando...</div>;
  if (error) return <div className="p-6 text-red-400">{error}</div>;
  if (!routine) return null;

  return (
    <RoutineForm
      mode="edit"
      routineId={id}
      initialName={routine.name}
      initialExercises={routine.exercises}
    />
  );
}