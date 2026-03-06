"use client";

import { useEffect, useState } from "react";
import ExerciseSelector from "./ExerciseSelector";

function twoDigits(n: number) {
  return String(n).padStart(2, "0");
}

export default function CreateActivityForm(): any {

  const [routineExercises, setRoutineExercises] = useState<any[]>([]);
  const [availableExercises, setAvailableExercises] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);

  const now = new Date();
  const startDefault = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const defaultDate = startDefault.toISOString().slice(0, 10);
  const defaultStartTime = `${twoDigits(startDefault.getHours())}:${twoDigits(startDefault.getMinutes())}`;
  const defaultEndTime = `${twoDigits(now.getHours())}:${twoDigits(now.getMinutes())}`;

  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [notes, setNotes] = useState("");
  const [activityType, setActivityType] = useState("other");
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {

    fetch("/api/exercise/list")
      .then(res => res.json())
      .then(data => setAvailableExercises(data.exercises || data));

    fetch("/api/routine/list")
      .then(res => res.json())
      .then(data => setRoutines(data.routines || data));

  }, []);

  function updateExercise(index: number, value: any) {
    const copy = [...routineExercises];
    copy[index] = value;
    setRoutineExercises(copy);
  }

  async function handleSubmit(e: any) {

    e.preventDefault();
    setSaving(true);

    const processedExercises = [];

    for (const ex of routineExercises) {

      let exerciseId = ex.exerciseId;

      if (exerciseId === "__new") {

        const res = await fetch("/api/exercise/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: ex.newExerciseName })
        });

        const data = await res.json();
        exerciseId = data.id;
      }

      processedExercises.push({
        exerciseId,
        sets: ex.sets,
        reps: ex.reps
      });
    }

    const s = new Date(`${date}T${startTime}:00`);
    const eTime = new Date(`${date}T${endTime}:00`);

    const payload = {
      startedAt: s.toISOString(),
      endedAt: eTime.toISOString(),
      type: activityType,
      notes,
      routineId: selectedRoutineId,
      exercises: processedExercises
    };

    await fetch("/api/activities/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    window.location.href = "/dashboard";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      <div>
        <label>Tipo</label>
        <select
          value={activityType}
          onChange={(e) => setActivityType(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 rounded"
        >
          <option value="gym">Gimnasio</option>
          <option value="run">Correr</option>
          <option value="sport">Deporte</option>
          <option value="mobility">Movilidad</option>
          <option value="other">Otro</option>
        </select>
      </div>

      <div>
        <label>Fecha</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 rounded"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">

        <div>
          <label>Inicio</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 rounded"
          />
        </div>

        <div>
          <label>Fin</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 rounded"
          />
        </div>

      </div>

      <div>
        <label>Notas</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 rounded"
        />
      </div>

      <div>
        <label>Rutina</label>
        <select
            value={selectedRoutineId ?? ""}
            onChange={(e) => {
              const id = e.target.value || null;
              setSelectedRoutineId(id);

              const r = routines.find((x) => x.id === id);

              if (r) {

                const mapped = r.exercises.map((ex: any) => ({
                  exerciseId: ex.exerciseId,
                  name: ex.name,
                  sets: ex.sets,
                  reps: ex.reps
                }));

                setRoutineExercises(mapped);

              } else {
                setRoutineExercises([]);
              }
            }}
            className="w-full px-3 py-2 bg-gray-700 rounded"
          >
            <option value="">-- Ninguna --</option>

            {routines.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}

          </select>
      </div>

      {routineExercises.length > 0 && (
        <div className="bg-gray-800 p-3 rounded space-y-2">

          <h3>Ejercicios</h3>

          {routineExercises.map((ex, i) => (
            <ExerciseSelector
              key={i}
              index={i}
              exercise={ex}
              availableExercises={availableExercises}
              onChange={updateExercise}
            />
          ))}

          <button
            type="button"
            onClick={() =>
              setRoutineExercises([
                ...routineExercises,
                { sets: 3, reps: 10 }
              ])
            }
            className="text-sm px-3 py-1 bg-gray-700 rounded"
          >
            + Agregar ejercicio
          </button>

        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-indigo-600 rounded"
      >
        Guardar actividad
      </button>

    </form>
  );
}