"use client";
import { Button, Card, PageHeader } from "@/src/components/ui";
import type { AiImportResult } from "./ai-draft";
import { omittedText } from "./multi";

/** Varias rutinas en una importación (3b): elegir cuáles importar. Todas arrancan marcadas. */
export function RoutinesFound({
  result,
  selected,
  onChange,
  onBack,
  onContinue,
}: {
  result: AiImportResult;
  selected: boolean[];
  onChange(selected: boolean[]): void;
  onBack(): void;
  onContinue(): void;
}) {
  const count = selected.filter(Boolean).length;
  return (
    <div className="mx-auto max-w-screen-sm space-y-4 pb-24">
      <PageHeader
        title={`Encontramos ${result.routines.length} rutinas`}
        subtitle="Elegí cuáles importar. Los ejercicios los revisás una sola vez para todas."
      />
      {result.omittedCount > 0 && <Card className="border-gold/40 p-3 text-sm">{omittedText(result.omittedCount)}</Card>}
      <ul className="space-y-2" aria-label="Rutinas encontradas">
        {result.routines.map((r, i) => {
          const n = r.parsed.exercises.length;
          return (
            <li key={i}>
              <Card className="p-0">
                <label className="flex cursor-pointer items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-primary"
                    checked={selected[i] ?? false}
                    onChange={(e) => onChange(selected.map((v, j) => (j === i ? e.target.checked : v)))}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-bold">{r.parsed.name}</span>
                    <span className="block text-xs text-fg-subtle">
                      {n} {n === 1 ? "ejercicio" : "ejercicios"}
                    </span>
                  </span>
                </label>
              </Card>
            </li>
          );
        })}
      </ul>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onBack}>
          Volver
        </Button>
        <Button fullWidth size="lg" disabled={count === 0} onClick={onContinue}>
          {count === 1 ? "Revisar 1 rutina" : `Revisar ${count} rutinas`}
        </Button>
      </div>
    </div>
  );
}
