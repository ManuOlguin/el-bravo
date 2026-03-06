"use client";

import { useEffect, useState } from "react";

type Exercise = {
  exerciseId?: string;
  name?: string;
  sets: number;
  reps: number;
  newExerciseName?: string;
};

export default function ExerciseSelector({
  index,
  exercise,
  availableExercises,
  onChange
}: {
  index: number;
  exercise: Exercise;
  availableExercises: any[];
  onChange: (index: number, value: Exercise) => void;
}) {

  const [search, setSearch] = useState("");

  const filtered = availableExercises.filter((e: any) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="grid grid-cols-4 gap-2 items-center">

      <div className="col-span-2 relative">

        <input
          value={search || exercise.name || ""}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar ejercicio..."
          className="w-full px-2 py-1 bg-gray-700 rounded"
        />

        {search !== "" && (
          <div className="absolute z-10 w-full bg-gray-900 rounded max-h-40 overflow-y-auto mt-1">

            {filtered.map((e: any) => (
              <button
                key={e.id}
                type="button"
                onClick={() => {
                  onChange(index, {
                    ...exercise,
                    exerciseId: e.id,
                    name: e.name
                  });
                  setSearch("");
                }}
                className="block w-full text-left px-3 py-2 hover:bg-gray-700"
              >
                {e.name}
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                onChange(index, {
                  ...exercise,
                  exerciseId: "__new"
                });
                setSearch("");
              }}
              className="block w-full text-left px-3 py-2 text-indigo-400 hover:bg-gray-700"
            >
              ➕ Crear nuevo ejercicio
            </button>

          </div>
        )}

      </div>

      {exercise.exerciseId === "__new" && (
        <input
          value={exercise.newExerciseName || ""}
          onChange={(e) =>
            onChange(index, {
              ...exercise,
              newExerciseName: e.target.value
            })
          }
          placeholder="Nombre del nuevo ejercicio"
          className="col-span-2 px-2 py-1 bg-gray-700 rounded"
        />
      )}

      <input
        type="number"
        value={exercise.sets}
        onChange={(e) =>
          onChange(index, {
            ...exercise,
            sets: Number(e.target.value)
          })
        }
        className="px-2 py-1 bg-gray-700 rounded"
      />

      <input
        type="number"
        value={exercise.reps}
        onChange={(e) =>
          onChange(index, {
            ...exercise,
            reps: Number(e.target.value)
          })
        }
        className="px-2 py-1 bg-gray-700 rounded"
      />

    </div>
  );
}