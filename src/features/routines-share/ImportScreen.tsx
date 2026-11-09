"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Card, PageHeader, Textarea, toast } from "@/src/components/ui";
import { refreshCatalogIfLoaded, useExerciseCatalog } from "@/src/features/exercises/useExerciseCatalog";
import { RoutineEditorScreen } from "@/src/features/workout/RoutineEditorScreen";
import { importRoutineFromFilesWithAiAction, importRoutineWithAiAction } from "@/src/server/actions/routine-import";
import { createRoutinesAction } from "@/src/server/actions/routines";
import { checkTotalSize } from "./attachments";
import { AttachFiles, type PreparedFile } from "./AttachFiles";
import { aiImportToDraft, type AiImportResult } from "./ai-draft";
import { looksLikeBravoFormat, parseRoutineText } from "./format";
import { importDraftToRoutine, matchImport, pendingExercises } from "./match";
import { buildMultiDraft, multiDraftToInputs, routinesUsing, type MultiImportDraft } from "./multi";
import { ImportReview } from "./ImportReview";
import { RoutinesFound } from "./RoutinesFound";
import { AI_IMPORT_TIMEOUT_MS, MAX_IMPORT_TEXT_CHARS } from "./import-limits";
import type { ImportDraft } from "./types";

const MAX_CHARS = MAX_IMPORT_TEXT_CHARS;
const AI_WAIT_S = Math.round(AI_IMPORT_TIMEOUT_MS / 1000);

/**
 * Importar: pegar texto o adjuntar archivos (3b) → revisar ejercicios (encontrados / nuevos) → editor.
 * Primero se intenta el formato El Bravo (sin IA); si no alcanza y hay IA (`aiEnabled`), se ofrece "Leer con IA".
 */
export function ImportScreen({ aiEnabled = false }: { aiEnabled?: boolean }) {
  const router = useRouter();
  const { catalog, muscles, loading, error } = useExerciseCatalog();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PreparedFile[]>([]);
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

  const showAiResult = (data: AiImportResult) => {
    setOfferAi(false);
    if (data.routines.length > 1) return void setFound({ result: data, selected: data.routines.map(() => true) });
    setDraft(aiImportToDraft(data.routines[0], catalog));
  };

  const readWithAi = () =>
    startAi(async () => {
      if (error) return void toast.error(error);
      const r = await importRoutineWithAiAction(text);
      if (!r.ok) return void toast.error(r.error); // el texto queda en el campo para reintentar
      showAiResult(r.data);
    });

  const readFilesWithAi = () =>
    startAi(async () => {
      if (error) return void toast.error(error);
      const tooBig = checkTotalSize(files.map((f) => f.blob.size));
      if (tooBig) return void toast.error(tooBig); // sin llamar a la acción: no gasta cuota
      const form = new FormData();
      for (const f of files) form.append("files", f.blob, f.uploadName);
      try {
        const r = await importRoutineFromFilesWithAiAction(form);
        if (!r.ok) return void toast.error(r.error); // los archivos quedan adjuntos para reintentar
        showAiResult(r.data);
      } catch {
        // Body rechazado antes de llegar a la acción (413 de Vercel) o red caída.
        toast.error("Los archivos son demasiado pesados o se cortó la conexión. Probá con menos fotos o un PDF más liviano.");
      }
    });

  /** Texto de un Word/Excel/.txt: reemplaza lo pegado y sigue el flujo de texto. */
  const onText = (extracted: string, truncated: boolean) => {
    setText(extracted);
    setOfferAi(false);
    if (truncated) toast.info(`El archivo tiene mucho texto: usamos los primeros ${MAX_CHARS} caracteres.`);
    else toast.success("Listo: copiamos el texto del archivo. Revisalo y tocá «Leer rutina».");
  };

  const hasFiles = files.length > 0;
  const fromWhat = files[0]?.kind === "pdf" ? "el PDF" : files.length === 1 ? "la foto" : `las ${files.length} fotos`;

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
        subtitle={
          aiEnabled
            ? "Pegá una rutina escrita como quieras, o adjuntá fotos, un PDF, Word o Excel."
            : "Pegá una rutina que te pasaron por WhatsApp, o adjuntá un archivo de texto."
        }
        back="/routines"
      />
      <Card className="space-y-3">
        {hasFiles ? (
          <p className="text-sm text-fg-muted">Vamos a leer la rutina de {fromWhat}. Para pegar texto, quitá los archivos.</p>
        ) : (
          <>
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
          </>
        )}
        <AttachFiles
          aiEnabled={aiEnabled}
          files={files}
          onFilesChange={(next) => {
            setFiles(next);
            setOfferAi(false);
          }}
          onText={onText}
          disabled={aiPending}
        />
        {hasFiles ? (
          <>
            <p className="text-xs text-fg-subtle">
              🔒 Para leerla, enviamos los archivos y los nombres de tus ejercicios a OpenAI. Los archivos no se guardan: ni en El Bravo ni en tu perfil.
            </p>
            <Button fullWidth size="lg" pending={aiPending} disabled={loading} onClick={readFilesWithAi}>
              Leer con IA
            </Button>
            {aiPending && (
              <p className="text-center text-xs text-fg-subtle" aria-live="polite">
                Leyendo los archivos… puede tardar hasta {AI_WAIT_S} segundos.
              </p>
            )}
          </>
        ) : (
          <Button fullWidth size="lg" disabled={!text.trim() || loading || aiPending} onClick={read}>
            Leer rutina
          </Button>
        )}
      </Card>
      {offerAi && !hasFiles && (
        <Card as="section" className="space-y-3">
          <h2 className="font-bold">No está en el formato de El Bravo</h2>
          <p className="text-sm text-fg-muted">
            Podemos leerla con IA: entiende rutinas escritas de cualquier forma (también varios días) y propone los ejercicios que falten. Vas a poder revisar todo antes de guardar.
          </p>
          <p className="text-xs text-fg-subtle">🔒 Para leerla, enviamos el texto y los nombres de tus ejercicios a OpenAI. En El Bravo no guardamos el texto.</p>
          <Button fullWidth size="lg" pending={aiPending} disabled={loading} onClick={readWithAi}>
            Leer con IA
          </Button>
          {aiPending && (
            <p className="text-center text-xs text-fg-subtle" aria-live="polite">
              Leyendo la rutina… puede tardar hasta {AI_WAIT_S} segundos.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
