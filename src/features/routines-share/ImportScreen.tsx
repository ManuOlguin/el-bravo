"use client";
import { useState, useTransition } from "react";
import { Button, Card, PageHeader, Textarea, toast } from "@/src/components/ui";
import { useExerciseCatalog } from "@/src/features/exercises/useExerciseCatalog";
import { RoutineEditorScreen } from "@/src/features/workout/RoutineEditorScreen";
import { importRoutineWithAiAction } from "@/src/server/actions/routine-import";
import { aiImportToDraft } from "./ai-draft";
import { looksLikeBravoFormat, parseRoutineText } from "./format";
import { importDraftToRoutine, matchImport, pendingExercises } from "./match";
import { ImportReview } from "./ImportReview";
import type { ImportDraft } from "./types";

const MAX_CHARS = 8000;

/**
 * Importar: pegar texto → revisar ejercicios (encontrados / nuevos) → editor.
 * Primero se intenta el formato El Bravo (sin IA); si no alcanza y hay IA (`aiEnabled`), se ofrece "Leer con IA".
 */
export function ImportScreen({ aiEnabled = false }: { aiEnabled?: boolean }) {
  const { catalog, muscles, loading, error } = useExerciseCatalog();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [offerAi, setOfferAi] = useState(false);
  const [aiPending, startAi] = useTransition();

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
      if (aiEnabled) return void setOfferAi(true);
      return void toast.error("No pudimos leer la rutina. Pegala en el formato de El Bravo (ej.: «Press de banca — 4×8 @ 60 kg»).");
    }
    setDraft(matchImport(parsed, catalog));
  };

  const readWithAi = () =>
    startAi(async () => {
      if (error) return void toast.error(error);
      const r = await importRoutineWithAiAction(text);
      if (!r.ok) return void toast.error(r.error); // el texto queda en el campo para reintentar
      setOfferAi(false);
      setDraft(aiImportToDraft(r.data, catalog));
    });

  return (
    <div className="mx-auto max-w-screen-sm space-y-4 pb-24">
      <PageHeader
        title="Importar rutina"
        subtitle={aiEnabled ? "Pegá una rutina: la que te pasaron por WhatsApp o escrita como quieras." : "Pegá una rutina que te pasaron por WhatsApp."}
        back="/routines"
      />
      <Card className="space-y-3">
        <Textarea
          rows={12}
          value={text}
          disabled={aiPending}
          onChange={(e) => {
            setText(e.target.value.slice(0, MAX_CHARS));
            setOfferAi(false);
          }}
          placeholder={"🏋️ Pecho y espalda\nPress de banca — 4×8 @ 60 kg\nRemo con barra — 3×10 @ 50 kg"}
          aria-label="Rutina en texto"
        />
        <p className="text-right text-xs text-fg-subtle">
          {text.length}/{MAX_CHARS}
        </p>
        <Button fullWidth size="lg" disabled={!text.trim() || loading || aiPending} onClick={read}>
          Leer rutina
        </Button>
      </Card>
      {offerAi && (
        <Card as="section" className="space-y-3">
          <h2 className="font-bold">No está en el formato de El Bravo</h2>
          <p className="text-sm text-fg-muted">
            Podemos leerla con IA: entiende rutinas escritas de cualquier forma y propone los ejercicios que falten. Vas a poder revisar todo antes de guardar.
          </p>
          <p className="text-xs text-fg-subtle">🔒 Para leerla, enviamos el texto y los nombres de tus ejercicios a OpenAI. En El Bravo no guardamos el texto.</p>
          <Button fullWidth size="lg" pending={aiPending} disabled={loading} onClick={readWithAi}>
            Leer con IA
          </Button>
          {aiPending && (
            <p className="text-center text-xs text-fg-subtle" aria-live="polite">
              Leyendo la rutina… puede tardar hasta 30 segundos.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
