"use client";
import { useState } from "react";
import { Button, Card, PageHeader, Textarea, toast } from "@/src/components/ui";
import { useExerciseCatalog } from "@/src/features/exercises/useExerciseCatalog";
import { RoutineEditorScreen } from "@/src/features/workout/RoutineEditorScreen";
import { looksLikeBravoFormat, parseRoutineText } from "./format";
import { importDraftToRoutine, matchImport, pendingExercises } from "./match";
import { ImportReview } from "./ImportReview";
import type { ImportDraft } from "./types";

const MAX_CHARS = 8000;

/** Importar: pegar texto → revisar ejercicios (encontrados / nuevos) → editor. La IA se suma en la fase 3. */
export function ImportScreen() {
  const { catalog, muscles, loading, error } = useExerciseCatalog();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [editing, setEditing] = useState(false);

  if (draft && editing) {
    return <RoutineEditorScreen initial={importDraftToRoutine(draft, muscles)} pendingExercises={pendingExercises(draft)} onBack={() => setEditing(false)} />;
  }
  if (draft) {
    return <ImportReview draft={draft} onChange={setDraft} onBack={() => setDraft(null)} onContinue={() => setEditing(true)} />;
  }

  const read = () => {
    if (error) return void toast.error(error);
    const parsed = parseRoutineText(text);
    if (!looksLikeBravoFormat(parsed)) {
      return void toast.error("No pudimos leer la rutina. Pegala en el formato de El Bravo (ej.: «Press de banca — 4×8 @ 60 kg»).");
    }
    setDraft(matchImport(parsed, catalog));
  };

  return (
    <div className="mx-auto max-w-screen-sm space-y-4 pb-24">
      <PageHeader title="Importar rutina" subtitle="Pegá una rutina que te pasaron por WhatsApp." back="/routines" />
      <Card className="space-y-3">
        <Textarea
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
          placeholder={"🏋️ Pecho y espalda\nPress de banca — 4×8 @ 60 kg\nRemo con barra — 3×10 @ 50 kg"}
          aria-label="Rutina en texto"
        />
        <p className="text-right text-xs text-fg-subtle">
          {text.length}/{MAX_CHARS}
        </p>
        <Button fullWidth size="lg" disabled={!text.trim() || loading} onClick={read}>
          Leer rutina
        </Button>
      </Card>
    </div>
  );
}
