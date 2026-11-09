import "server-only";
/**
 * Valida en el servidor los archivos de una importación con IA (spec 2026-10-31, fase 3b). No confía en el navegador:
 * el tipo sale de los primeros bytes (no del nombre ni del MIME declarado) y se vuelven a chequear cantidades, tamaños
 * y páginas. Los archivos se leen en memoria, van a OpenAI y no se guardan ni se loguean.
 */
import { MAX_IMAGE_BYTES, MAX_IMAGES, MAX_PDF_PAGES, MAX_TOTAL_BYTES } from "@/src/features/routines-share/import-limits";
import { formatBytes } from "@/src/features/routines-share/attachments";
import type { AiUserPart } from "./openai";

export type AiAttachment = Exclude<AiUserPart, { type: "text" }>;
type ImageType = Extract<AiUserPart, { type: "image" }>["mediaType"];

export function sniffType(b: Uint8Array): ImageType | "application/pdf" | null {
  const at = (sig: number[], offset = 0) => b.length >= offset + sig.length && sig.every((x, i) => b[offset + i] === x);
  if (at([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (at([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (at([0x52, 0x49, 0x46, 0x46]) && at([0x57, 0x45, 0x42, 0x50], 8)) return "image/webp"; // RIFF....WEBP
  if (at([0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  return null;
}

/**
 * Páginas contables sin parsear el PDF: objetos `/Type /Page` (no `/Pages`), contando cada número de objeto una sola vez
 * (un PDF actualizado de forma incremental repite el objeto). Si las páginas están dentro de objetos comprimidos
 * (PDF 1.5+) no se ven y devuelve null: ahí manda el límite de tamaño.
 */
export function pdfPageCountHint(b: Uint8Array): number | null {
  const text = new TextDecoder("latin1").decode(b);
  const pages = new Set<string>();
  for (const chunk of text.split("endobj")) {
    if (!/\/Type\s*\/Page(?![A-Za-z])/.test(chunk)) continue;
    const num = chunk.match(/(\d+)\s+\d+\s+obj(?![A-Za-z])/);
    if (num) pages.add(num[1]);
  }
  return pages.size > 0 ? pages.size : null;
}

const bad = (error: string) => ({ ok: false as const, error });

export async function readImportAttachments(form: FormData): Promise<{ ok: true; files: AiAttachment[] } | { ok: false; error: string }> {
  const entries = form.getAll("files");
  if (entries.length === 0) return bad("Adjuntá al menos una foto o un PDF.");
  if (entries.length > MAX_IMAGES) return bad(`Podés adjuntar hasta ${MAX_IMAGES} fotos o un PDF.`);
  const blobs: File[] = [];
  for (const e of entries) {
    if (typeof e === "string") return bad("Archivo inválido.");
    if (e.size === 0) return bad("Uno de los archivos está vacío.");
    blobs.push(e);
  }
  const total = blobs.reduce((n, b) => n + b.size, 0);
  if (total > MAX_TOTAL_BYTES) return bad(`Los archivos pesan ${formatBytes(total)}: el máximo es ${formatBytes(MAX_TOTAL_BYTES)}.`);

  const files: AiAttachment[] = [];
  for (const blob of blobs) {
    const data = new Uint8Array(await blob.arrayBuffer());
    const type = sniffType(data);
    if (!type) return bad("Solo podemos leer fotos (JPG, PNG o WebP) o un PDF.");
    if (type === "application/pdf") {
      const pages = pdfPageCountHint(data);
      if (pages !== null && pages > MAX_PDF_PAGES) return bad(`El PDF tiene ${pages} páginas: el máximo es ${MAX_PDF_PAGES}. Mandá solo las de la rutina.`);
      files.push({ type: "pdf", filename: "rutina.pdf", data });
    } else {
      if (data.byteLength > MAX_IMAGE_BYTES) return bad("Una de las fotos es demasiado pesada. Quitala y adjuntala de nuevo.");
      files.push({ type: "image", mediaType: type, data });
    }
  }
  const pdfs = files.filter((f) => f.type === "pdf").length;
  if (pdfs > 1) return bad("Podés adjuntar un solo PDF.");
  if (pdfs === 1 && files.length > 1) return bad("Adjuntá fotos o un PDF, no los dos juntos.");
  return { ok: true, files };
}
