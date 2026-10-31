"use client";
import { useState } from "react";
import { Button, toast } from "@/src/components/ui";
import { CreateExerciseSheet, ExerciseInfoButton, ExercisePicker, useExerciseCatalog } from "@/src/features/exercises";

/** Sección de W1-3 en /dev/ui: picker simple y múltiple, botón "?" y crear ejercicio. */
export function ExercisesSection() {
  const [single, setSingle] = useState(false);
  const [multi, setMulti] = useState(false);
  const [create, setCreate] = useState(false);
  const { catalog } = useExerciseCatalog();
  const press = catalog.find((e) => e.name === "Press de Banca");

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-fg-subtle">Ejercicios</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={() => setSingle(true)}>
          Picker simple
        </Button>
        <Button variant="secondary" onClick={() => setMulti(true)}>
          Picker múltiple
        </Button>
        <Button variant="secondary" onClick={() => setCreate(true)}>
          Crear ejercicio
        </Button>
        {press ? (
          <span className="flex items-center gap-2 text-sm text-fg-muted">
            Press de Banca <ExerciseInfoButton exerciseId={press.id} name={press.name} />
          </span>
        ) : (
          <span className="text-sm text-fg-subtle">(cargando Press de Banca…)</span>
        )}
      </div>
      <ExercisePicker
        open={single}
        onClose={() => setSingle(false)}
        onConfirm={(list) => toast.success(`Elegiste: ${list.map((e) => e.name).join(", ")}`)}
      />
      <ExercisePicker
        open={multi}
        multiple
        onClose={() => setMulti(false)}
        onConfirm={(list) => toast.success(`Agregaste ${list.length}: ${list.map((e) => e.name).join(", ")}`)}
      />
      <CreateExerciseSheet
        open={create}
        onClose={() => setCreate(false)}
        onCreated={(ex) => toast.info(`Ejercicio listo: ${ex.name} (${ex.measureType === "duration" ? "por tiempo" : "por repeticiones"})`)}
      />
    </section>
  );
}
