"use client";
import { useState, useTransition } from "react";
import { Button, Field, Input, Select, Sheet, Switch, Tabs, toast } from "@/src/components/ui";
import { createExerciseAction } from "@/src/server/actions/exercises";
import { MuscleShareEditor, type MuscleShare } from "./MuscleShareEditor";
import { isValidShare } from "./muscle-share";
import { upsertCatalogEntry, useExerciseCatalog } from "./useExerciseCatalog";
import { EQUIPMENT, EQUIPMENT_LABEL, type CatalogEntry, type Equipment, type MeasureType } from "./types";

type Props = {
  open: boolean;
  onClose(): void;
  initialName?: string;
  /** Se llama con el ejercicio creado, o con el existente si el usuario elige "Usar «…»" ante un duplicado. */
  onCreated(ex: CatalogEntry): void;
};

/** Crear un ejercicio propio: nombre, "Se mide por" (repeticiones / tiempo), equipamiento, ¿usa peso? y músculos. */
export function CreateExerciseSheet({ open, onClose, initialName, onCreated }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Nuevo ejercicio">
      {open && <CreateExerciseForm initialName={initialName} onClose={onClose} onCreated={onCreated} />}
    </Sheet>
  );
}

function CreateExerciseForm({ initialName, onClose, onCreated }: Omit<Props, "open">) {
  const { catalog, muscles, loading, refresh } = useExerciseCatalog();
  const [name, setName] = useState(initialName ?? "");
  const [measureType, setMeasureType] = useState<MeasureType>("reps");
  const [equipment, setEquipment] = useState<Equipment>("other");
  const [tracksWeight, setTracksWeight] = useState(true);
  const [share, setShare] = useState<MuscleShare[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [existing, setExisting] = useState<{ id: string; name: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setExisting(null);
    if (!isValidShare(share.map((s) => s.percentage))) {
      setErrors({ muscles: [share.length ? "Los porcentajes tienen que sumar 100 %" : "Elegí al menos un músculo"] });
      return;
    }
    startTransition(async () => {
      let r: Awaited<ReturnType<typeof createExerciseAction>>;
      try {
        r = await createExerciseAction({ name, measureType, equipment, tracksWeight, muscles: share });
      } catch {
        // Sin conexión, sesión vencida (redirect) o respuesta inesperada: no tirar la pantalla abajo.
        toast.error("No pudimos guardar el ejercicio. Revisá tu conexión o volvé a iniciar sesión.");
        return;
      }
      if (r.ok) {
        toast.success(r.message ?? "Ejercicio creado");
        upsertCatalogEntry(r.data.exercise);
        refresh();
        onCreated(r.data.exercise);
        onClose();
        return;
      }
      setErrors(r.fieldErrors ?? {});
      if ("existing" in r) setExisting(r.existing);
      toast.error(r.error);
    });
  };

  const useExisting = () => {
    const ex = existing && catalog.find((e) => e.id === existing.id);
    if (!ex) return;
    onCreated(ex);
    onClose();
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label="Nombre" htmlFor="new-exercise-name" error={errors.name?.[0]}>
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setExisting(null);
          }}
          placeholder="Ej.: Plancha con toque de hombro"
          maxLength={100}
          autoComplete="off"
        />
      </Field>
      {existing && (
        <Button variant="secondary" size="sm" onClick={useExisting}>
          Usar «{existing.name}»
        </Button>
      )}

      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Se mide por</p>
        <Tabs<MeasureType>
          aria-label="Se mide por"
          value={measureType}
          onChange={(m) => {
            setMeasureType(m);
            setTracksWeight(m === "reps");
          }}
          tabs={[
            { id: "reps", label: "Repeticiones" },
            { id: "duration", label: "Tiempo" },
          ]}
        />
      </div>

      <Field label="Equipamiento" htmlFor="new-exercise-equipment" error={errors.equipment?.[0]}>
        <Select value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
          {EQUIPMENT.map((eq) => (
            <option key={eq} value={eq}>
              {EQUIPMENT_LABEL[eq]}
            </option>
          ))}
        </Select>
      </Field>

      <Switch
        checked={tracksWeight}
        onChange={setTracksWeight}
        label="¿Usa peso?"
        description={tracksWeight ? "Vas a poder anotar los kilos de cada serie" : "Sin kilos (peso corporal, cardio, estiramientos)"}
      />

      <div className="space-y-1.5">
        <p className="text-sm font-semibold" id="new-exercise-muscles-label">
          Músculos
        </p>
        {loading ? (
          <p className="text-sm text-fg-muted">Cargando músculos…</p>
        ) : (
          <MuscleShareEditor
            id="new-exercise-muscles"
            value={share}
            onChange={(v) => {
              setShare(v);
              if (errors.muscles) setErrors((e) => ({ ...e, muscles: [] }));
            }}
            muscles={muscles}
            error={errors.muscles?.[0]}
          />
        )}
        {errors.muscles?.[0] && (
          <p role="alert" className="text-xs text-danger">
            {errors.muscles[0]}
          </p>
        )}
      </div>

      <Button type="submit" fullWidth size="lg" pending={pending}>
        Crear ejercicio
      </Button>
    </form>
  );
}
