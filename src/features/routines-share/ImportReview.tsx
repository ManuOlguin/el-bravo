"use client";
import { useState } from "react";
import { Button, Card, Input, PageHeader, Pill, Select } from "@/src/components/ui";
import { ExercisePicker } from "@/src/features/exercises/ExercisePicker";
import { MuscleShareEditor, type MuscleShare } from "@/src/features/exercises/MuscleShareEditor";
import { isValidShare } from "@/src/features/exercises/muscle-share";
import { normalize } from "@/src/features/exercises/search";
import { EQUIPMENT, EQUIPMENT_LABEL, type CatalogEntry, type Equipment } from "@/src/features/exercises/types";
import { useExerciseCatalog } from "@/src/features/exercises/useExerciseCatalog";
import type { ImportDraft, ImportItem, NewExerciseDraft } from "./types";
import { newExerciseFromName } from "./match";

/** Ejercicio del catálogo que ya se llama así (nombre, inglés o alias): crear otro igual no tiene sentido. */
function existingWithName(name: string, catalog: CatalogEntry[]): CatalogEntry | null {
  const q = normalize(name);
  if (!q) return null;
  return catalog.find((e) => normalize(e.name) === q || (e.nameEn && normalize(e.nameEn) === q) || e.aliases.some((a) => normalize(a) === q)) ?? null;
}

/** Revisión previa al editor: ✓ encontrado / ✨ nuevo; cambiar el ejercicio asociado o renombrar el nuevo. */
export function ImportReview({
  draft,
  onChange,
  onBack,
  onContinue,
  continueLabel = "Continuar",
  continuePending = false,
  usedIn,
}: {
  draft: ImportDraft;
  onChange(d: ImportDraft): void;
  onBack(): void;
  onContinue(): void;
  continueLabel?: string;
  continuePending?: boolean;
  usedIn?: Record<string, string[]>;
}) {
  const { catalog, muscles } = useExerciseCatalog();
  const [picking, setPicking] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(draft.items.flatMap((i) => (i.match.kind === "new" && i.match.draft.source === "ai" ? [i.key] : [])))
  );
  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const setItem = (key: string, patch: (i: ImportItem) => ImportItem) =>
    onChange({ ...draft, items: draft.items.map((i) => (i.key === key ? patch(i) : i)) });
  // El mismo ejercicio nuevo puede aparecer en varios ítems (mismo tempId): renombrarlo los cambia a todos.
  const updateNew = (tempId: string, patch: Partial<NewExerciseDraft>) =>
    onChange({
      ...draft,
      items: draft.items.map((i) =>
        i.match.kind === "new" && i.match.draft.tempId === tempId ? { ...i, match: { kind: "new", draft: { ...i.match.draft, ...patch } } } : i
      ),
    });
  const invalidName = (i: ImportItem) => i.match.kind === "new" && i.match.draft.name.trim().length < 2;
  const duplicateOf = (i: ImportItem) => (i.match.kind === "new" && !invalidName(i) ? existingWithName(i.match.draft.name, catalog) : null);
  const bySlug = new Map(muscles.map((m) => [m.slug, m]));
  const byId = new Map(muscles.map((m) => [m.id, m]));
  const toShares = (d: NewExerciseDraft): MuscleShare[] =>
    d.muscles.flatMap((m) => {
      const found = bySlug.get(m.muscleSlug);
      return found ? [{ muscleId: found.id, percentage: m.percentage }] : [];
    });
  const fromShares = (shares: MuscleShare[]): NewExerciseDraft["muscles"] =>
    shares.flatMap((s) => {
      const found = byId.get(s.muscleId);
      return found ? [{ muscleSlug: found.slug, percentage: s.percentage }] : [];
    });
  // Sin músculos es válido (se puede completar después); con músculos, tienen que sumar 100. Solo cuentan los que
  // existen en el catálogo (un slug desconocido de la IA no se ve en el editor ni se guarda): no pueden trabar el "Continuar".
  const invalidMuscles = (i: ImportItem) => {
    if (i.match.kind !== "new") return false;
    const shares = toShares(i.match.draft);
    return shares.length > 0 && !isValidShare(shares.map((m) => m.percentage));
  };
  const hasInvalid = draft.items.some((i) => invalidName(i) || duplicateOf(i) !== null || invalidMuscles(i));
  const news = new Set(draft.items.flatMap((i) => (i.match.kind === "new" ? [i.match.draft.tempId] : []))).size;

  return (
    <div className="mx-auto max-w-screen-sm space-y-4 pb-24">
      <PageHeader
        title="Revisá los ejercicios"
        subtitle={
          news
            ? `${news} ${news === 1 ? "ejercicio nuevo se va a crear" : "ejercicios nuevos se van a crear"} al guardar.`
            : draft.unparsedLines.length
              ? "Revisá que cada ejercicio esté bien asociado."
              : "Encontramos todos los ejercicios."
        }
      />
      {draft.unparsedLines.length > 0 && (
        <Card className="space-y-1 border-gold/40 p-3">
          <p className="text-sm font-semibold">No pudimos leer estas líneas — agregalas en el editor si hacen falta:</p>
          <ul className="space-y-0.5 text-sm text-fg-muted">
            {draft.unparsedLines.map((line, n) => (
              <li key={n} className="break-words">
                «{line}»
              </li>
            ))}
          </ul>
        </Card>
      )}
      <ul className="space-y-2" aria-label="Ejercicios importados">
        {draft.items.map((i) => {
          const match = i.match;
          return (
            <li key={i.key}>
              <Card className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 break-words text-xs text-fg-subtle">
                    Decía: «{i.sourceName}» · {i.sets.length} {i.sets.length === 1 ? "serie" : "series"}
                    {usedIn?.[i.key]?.length ? ` · En: ${usedIn[i.key].join(", ")}` : ""}
                  </span>
                  {match.kind === "found" ? <Pill tone="primary">✓ Encontrado</Pill> : <Pill tone="gold">✨ Nuevo</Pill>}
                </div>
                {match.kind === "found" ? (
                  <p className="font-bold">{match.exercise.name}</p>
                ) : (
                  <div className="space-y-1">
                    <Input
                      aria-label={`Nombre del ejercicio nuevo «${i.sourceName}»`}
                      invalid={invalidName(i) || duplicateOf(i) !== null}
                      aria-describedby={invalidName(i) || duplicateOf(i) ? `${i.key}-name-hint` : undefined}
                      value={match.draft.name}
                      maxLength={100}
                      onChange={(e) => updateNew(match.draft.tempId, { name: e.target.value })}
                    />
                    {match.draft.source === "ai" && (
                      <div>
                        <Pill>Creado con IA</Pill>
                      </div>
                    )}
                    {invalidName(i) && (
                      <p id={`${i.key}-name-hint`} className="text-xs text-danger">
                        Poné un nombre de al menos 2 letras
                      </p>
                    )}
                    {duplicateOf(i) && (
                      <p id={`${i.key}-name-hint`} className="text-xs text-danger">
                        Ya existe «{duplicateOf(i)?.name}»: cambiale el nombre o elegilo con «Cambiar ejercicio»
                      </p>
                    )}
                  </div>
                )}
                {match.kind === "new" && (
                  <div className="space-y-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-expanded={expanded.has(i.key)}
                      aria-controls={`${i.key}-details`}
                      onClick={() => toggleExpanded(i.key)}
                    >
                      Músculos y equipo {expanded.has(i.key) ? "▴" : "▾"}
                    </Button>
                    {expanded.has(i.key) && (
                      <div id={`${i.key}-details`} className="space-y-2">
                        {match.draft.source === "ai" && <p className="text-xs text-fg-muted">Equipo y músculos que propone la IA (podés cambiarlos)</p>}
                        <Select
                          aria-label={`Equipo de «${match.draft.name}»`}
                          value={match.draft.equipment}
                          onChange={(e) => updateNew(match.draft.tempId, { equipment: e.target.value as Equipment })}
                        >
                          {EQUIPMENT.map((eq) => (
                            <option key={eq} value={eq}>
                              {EQUIPMENT_LABEL[eq]}
                            </option>
                          ))}
                        </Select>
                        <MuscleShareEditor
                          id={`${i.key}-muscles`}
                          value={toShares(match.draft)}
                          onChange={(next) => updateNew(match.draft.tempId, { muscles: fromShares(next) })}
                          muscles={muscles}
                          error={invalidMuscles(i) ? "La suma tiene que dar 100 %" : null}
                        />
                        {invalidMuscles(i) && <p className="text-xs text-danger">Los porcentajes de los músculos tienen que sumar 100 %</p>}
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
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
                      Es otro ejercicio
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
        <Button fullWidth size="lg" disabled={hasInvalid} pending={continuePending} onClick={onContinue}>
          {continueLabel}
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
