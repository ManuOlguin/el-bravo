"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, PageHeader, Textarea, toast } from "@/src/components/ui";
import { refreshCatalogIfLoaded, useExerciseCatalog } from "@/src/features/exercises/useExerciseCatalog";
import { RoutineEditorScreen } from "@/src/features/workout/RoutineEditorScreen";
import { importRoutineWithAiAction } from "@/src/server/actions/routine-import";
import { createRoutinesAction } from "@/src/server/actions/routines";
import { aiImportToDraft, type AiImportResult } from "./ai-draft";
import { looksLikeBravoFormat, parseRoutineText } from "./format";
import { importDraftToRoutine, matchImport, pendingExercises } from "./match";
import { buildMultiDraft, multiDraftToInputs, routinesUsing, type MultiImportDraft } from "./multi";
import { ImportReview } from "./ImportReview";
import { RoutinesFound } from "./RoutinesFound";
import { AI_IMPORT_TIMEOUT_MS, MAX_IMPORT_TEXT_CHARS } from "./import-limits";
import type { ImportDraft } from "./types";

const MAX_CHARS = MAX_IMPORT_TEXT_CHARS;

/**
 * Importar: pegar texto → revisar ejercicios (encontrados / nuevos) → editor.
 * Primero se intenta el formato El Bravo (sin IA); si no alcanza y hay IA (`aiEnabled`), se ofrece "Leer con IA".
 */
export function ImportScreen({ aiEnabled = false }: { aiEnabled?: boolean }) {
  const router = useRouter();
  const { catalog, muscles, loading, error } = useExerciseCatalog();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [offerAi, setOfferAi] = useState(false);
  const [found, setFound] = useState<{ result: AiImportResult; selected: boolean[] } | null>(null);
  const [multi, setMulti] = useState<MultiImportDraft | null>(null);
  const [created, setCreated] = useState(false);
  const [aiPending, startAi] = useTransition();
  const [creating, startCreate] = useTransition();

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
      const data = r.data;
      if (data.routines.length > 1) return void setFound({ result: data, selected: data.routines.map(() => true) });
      setDraft(aiImportToDraft(data.routines[0], catalog));
    });

  const reviewSelected = () => {
    if (!found) return;
    const chosen = found.result.routines.filter((_, i) => found.selected[i]);
    if (chosen.length === 1) return void setDraft(aiImportToDraft(chosen[0], catalog)); // una sola: flujo de siempre
    if (chosen.length > 1) setMulti(buildMultiDraft(chosen, catalog));
  };

  const createAll = () =>
    startCreate(async () => {
      if (!multi || created) return;
      try {
        const r = await createRoutinesAction(multiDraftToInputs(multi));
        if (!r.ok) return void toast.error(r.error);
        setCreated(true);
        toast.success(r.message ?? "Rutinas creadas");
        router.push("/routines");
        refreshCatalogIfLoaded(); // después del push: una server action antes cuelga la cola del router
      } catch {
        toast.error("No pudimos crear las rutinas. Revisá la conexión y probá de nuevo.");
      }
    });

  if (draft && editing) {
    return <RoutineEditorScreen initial={importDraftToRoutine(draft, muscles)} pendingExercises={pendingExercises(draft)} onBack={() => setEditing(false)} />;
  }
  if (draft) {
    // Volver: a "Encontramos N rutinas" si vino de ahí; si no, al texto.
    return <ImportReview draft={draft} onChange={setDraft} onBack={() => setDraft(null)} onContinue={() => setEditing(true)} />;
  }
  if (multi) {
    return (
      <ImportReview
        draft={multi.review}
        onChange={(review) => setMulti({ ...multi, review })}
        onBack={() => setMulti(null)}
        onContinue={createAll}
        continueLabel={`Crear ${multi.routines.length} rutinas`}
        continuePending={creating || created}
        usedIn={routinesUsing(multi)}
      />
    );
  }
  if (found) {
    return (
      <RoutinesFound
        result={found.result}
        selected={found.selected}
        onChange={(selected) => setFound({ ...found, selected })}
        onBack={() => setFound(null)}
        onContinue={reviewSelected}
      />
    );
  }

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
              {`Leyendo la rutina… puede tardar hasta ${Math.round(AI_IMPORT_TIMEOUT_MS / 1000)} segundos.`}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
