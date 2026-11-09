// src/features/routines-share/AttachFiles.tsx
"use client";
import { useRef, useState } from "react";
import { Button, IconButton, toast } from "@/src/components/ui";
import { compressImageForAi } from "@/src/features/media/compress";
import { CloseIcon } from "@/src/features/media/icons";
import { acceptFor, checkSelection, checkTotalSize, formatBytes, isHeicName, type MediaKind } from "./attachments";
import { extractTextFromFiles } from "./file-text";
import { MAX_IMAGE_BYTES, MAX_TOTAL_BYTES } from "./import-limits";

export type PreparedFile = { id: number; name: string; kind: MediaKind; blob: Blob; uploadName: string };

async function prepareImage(file: File): Promise<Blob> {
  try {
    return await compressImageForAi(file, MAX_IMAGE_BYTES);
  } catch {
    throw new Error(
      isHeicName(file.name)
        ? `No pudimos leer «${file.name}»: este navegador no abre fotos HEIC. Adjuntala desde el celular o mandala como JPG.`
        : `No pudimos leer «${file.name}». Probá con una foto JPG o PNG.`
    );
  }
}

/**
 * Adjuntar archivos al importar (fase 3b). Word/Excel/texto: se leen acá y el texto va al campo (`onText`).
 * Fotos (achicadas acá) o un PDF: quedan en la lista (`files`) para "Leer con IA". Nada se sube hasta tocar ese botón.
 */
export function AttachFiles({
  aiEnabled,
  files,
  onFilesChange,
  onText,
  disabled = false,
  onPreparingChange,
}: {
  aiEnabled: boolean;
  files: PreparedFile[];
  onFilesChange(files: PreparedFile[]): void;
  onText(text: string, truncated: boolean): void;
  disabled?: boolean;
  /** Avisa cuando empieza/termina de achicar fotos o leer archivos (para frenar "Leer rutina" y "Leer con IA"). */
  onPreparingChange?: (preparing: boolean) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const [preparing, setPreparingState] = useState(false);
  const setPreparing = (value: boolean) => {
    setPreparingState(value);
    onPreparingChange?.(value);
  };
  const total = files.reduce((n, f) => n + f.blob.size, 0);

  const add = async (picked: File[]) => {
    if (picked.length === 0) return;
    const sel = checkSelection(files.map((f) => f.kind), picked, aiEnabled);
    if (!sel.ok) return void toast.error(sel.error);
    setPreparing(true);
    try {
      if (sel.kind === "text") {
        const r = await extractTextFromFiles(sel.files);
        if (!r.text) return void toast.error("No encontramos texto en el archivo.");
        return void onText(r.text, r.truncated);
      }
      const added: PreparedFile[] = [];
      for (const { file, kind } of sel.files) {
        const blob = kind === "image" ? await prepareImage(file) : file;
        const id = nextId.current++;
        // Nombres neutros: el nombre real del archivo no viaja (puede tener datos personales).
        added.push({ id, name: file.name, kind, blob, uploadName: kind === "pdf" ? "rutina.pdf" : `foto-${id}.jpg` });
      }
      const all = [...files, ...added];
      const tooBig = checkTotalSize(all.map((f) => f.blob.size));
      if (tooBig) return void toast.error(tooBig);
      onFilesChange(all);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos leer el archivo.");
    } finally {
      setPreparing(false);
    }
  };

  const hint = aiEnabled
    ? "Fotos o capturas (hasta 4), un PDF (hasta 10 páginas), Word, Excel o texto."
    : "Word (.docx), Excel (.xlsx) o texto (.txt, .csv) con la rutina en formato El Bravo.";

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <>
          <ul className="space-y-2" aria-label="Archivos adjuntos">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2">
                <span aria-hidden>{f.kind === "pdf" ? "📄" : "🖼️"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{f.name}</span>
                  <span className="block text-xs text-fg-subtle">{formatBytes(f.blob.size)}</span>
                </span>
                <IconButton label={`Quitar ${f.name}`} disabled={disabled || preparing} onClick={() => onFilesChange(files.filter((x) => x.id !== f.id))}>
                  <CloseIcon />
                </IconButton>
              </li>
            ))}
          </ul>
          <p className="text-right text-xs text-fg-subtle">
            {formatBytes(total)} de {formatBytes(MAX_TOTAL_BYTES)}
          </p>
        </>
      )}
      <Button variant="secondary" fullWidth pending={preparing} disabled={disabled} onClick={() => input.current?.click()}>
        <span aria-hidden>📎</span> Adjuntar archivos
      </Button>
      <p className="text-xs text-fg-subtle">{hint} Word, Excel y texto se leen en tu dispositivo: no se suben.</p>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={acceptFor(aiEnabled)}
        aria-label="Archivos de la rutina"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          e.target.value = ""; // poder elegir el mismo archivo otra vez
          void add(list);
        }}
      />
    </div>
  );
}
