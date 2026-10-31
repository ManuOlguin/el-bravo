"use client";
import { useState } from "react";
import { Button, Card, Input, PageHeader, Pill } from "@/src/components/ui";
import { ExercisePicker } from "@/src/features/exercises/ExercisePicker";
import type { ImportDraft, ImportItem } from "./types";
import { newExerciseFromName } from "./match";

/** Revisión previa al editor: ✓ encontrado / ✨ nuevo; cambiar el ejercicio asociado o renombrar el nuevo. */
export function ImportReview({
  draft,
  onChange,
  onBack,
  onContinue,
}: {
  draft: ImportDraft;
  onChange(d: ImportDraft): void;
  onBack(): void;
  onContinue(): void;
}) {
  const [picking, setPicking] = useState<string | null>(null);
  const setItem = (key: string, patch: (i: ImportItem) => ImportItem) =>
    onChange({ ...draft, items: draft.items.map((i) => (i.key === key ? patch(i) : i)) });
  // El mismo ejercicio nuevo puede aparecer en varios ítems (mismo tempId): renombrarlo los cambia a todos.
  const renameNew = (tempId: string, name: string) =>
    onChange({
      ...draft,
      items: draft.items.map((i) =>
        i.match.kind === "new" && i.match.draft.tempId === tempId ? { ...i, match: { kind: "new", draft: { ...i.match.draft, name } } } : i
      ),
    });
  const invalidName = (i: ImportItem) => i.match.kind === "new" && i.match.draft.name.trim().length < 2;
  const hasInvalid = draft.items.some(invalidName);
  const news = new Set(draft.items.flatMap((i) => (i.match.kind === "new" ? [i.match.draft.tempId] : []))).size;

  return (
    <div className="mx-auto max-w-screen-sm space-y-4 pb-24">
      <PageHeader
        title="Revisá los ejercicios"
        subtitle={
          news
            ? `${news} ${news === 1 ? "ejercicio nuevo se va a crear" : "ejercicios nuevos se van a crear"} al guardar.`
            : "Encontramos todos los ejercicios."
        }
      />
      <ul className="space-y-2" aria-label="Ejercicios importados">
        {draft.items.map((i) => {
          const match = i.match;
          return (
            <li key={i.key}>
              <Card className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-fg-subtle">
                    Decía: «{i.sourceName}» · {i.sets.length} {i.sets.length === 1 ? "serie" : "series"}
                  </span>
                  {match.kind === "found" ? <Pill tone="primary">✓ Encontrado</Pill> : <Pill tone="gold">✨ Nuevo</Pill>}
                </div>
                {match.kind === "found" ? (
                  <p className="font-bold">{match.exercise.name}</p>
                ) : (
                  <div className="space-y-1">
                    <Input
                      aria-label={`Nombre del ejercicio nuevo «${i.sourceName}»`}
                      invalid={invalidName(i)}
                      aria-describedby={invalidName(i) ? `${i.key}-name-hint` : undefined}
                      value={match.draft.name}
                      maxLength={100}
                      onChange={(e) => renameNew(match.draft.tempId, e.target.value)}
                    />
                    {invalidName(i) && (
                      <p id={`${i.key}-name-hint`} className="text-xs text-danger">
                        Poné un nombre de al menos 2 letras
                      </p>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setPicking(i.key)}>
                    Cambiar ejercicio
                  </Button>
                  {match.kind === "found" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setItem(i.key, (it) => ({ ...it, match: { kind: "new", draft: newExerciseFromName(it.sourceName, `u${it.key}`, it.sets) } }))
                      }
                    >
                      Es otro (crear nuevo)
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack}>
          Volver
        </Button>
        <Button fullWidth size="lg" disabled={hasInvalid} onClick={onContinue}>
          Continuar
        </Button>
      </div>
      <ExercisePicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        title="Elegí el ejercicio"
        onConfirm={(ex) => {
          const chosen = ex[0];
          if (picking && chosen) setItem(picking, (it) => ({ ...it, match: { kind: "found", exercise: chosen } }));
          setPicking(null);
        }}
      />
    </div>
  );
}
