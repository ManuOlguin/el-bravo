/**
 * Adjuntar archivos al importar una rutina (spec 2026-10-31, fase 3b): qué es cada archivo y qué combinaciones valen.
 * Puro: el navegador lo usa para avisar antes de mandar; el servidor vuelve a validar con los bytes (no confía en esto).
 * Fotos (hasta 4) o un PDF van a la IA; Word/Excel/texto se leen en el navegador y siguen el flujo de texto.
 */
import { MAX_IMAGES, MAX_RAW_IMAGE_BYTES, MAX_TEXT_FILE_BYTES, MAX_TOTAL_BYTES } from "./import-limits";

export type MediaKind = "image" | "pdf";
export type TextKind = "docx" | "xlsx" | "text";
export type AttachmentKind = MediaKind | TextKind;

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif", "gif"]);
const TEXT_ACCEPT = [".docx", ".xlsx", ".txt", ".csv", "text/plain", "text/csv", DOCX_MIME, XLSX_MIME].join(",");
/** Sin `.heic` explícito: así iOS Safari convierte las fotos HEIC a JPEG al elegirlas. */
const MEDIA_ACCEPT = "image/*,application/pdf,.pdf";

const ext = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

export function classifyFile(f: { name: string; type: string }): AttachmentKind | null {
  const e = ext(f.name);
  const type = f.type.toLowerCase();
  if (type === "application/pdf" || e === "pdf") return "pdf";
  if (e === "docx" || type === DOCX_MIME) return "docx";
  if (e === "xlsx" || type === XLSX_MIME) return "xlsx";
  if (e === "txt" || e === "csv" || type === "text/plain" || type === "text/csv") return "text";
  if (e === "svg" || type === "image/svg+xml") return null;
  if (type.startsWith("image/") || IMAGE_EXT.has(e)) return "image";
  return null;
}

export const isMedia = (k: AttachmentKind): k is MediaKind => k === "image" || k === "pdf";
export const isHeicName = (name: string) => ["heic", "heif"].includes(ext(name));

export function acceptFor(aiEnabled: boolean): string {
  return aiEnabled ? `${MEDIA_ACCEPT},${TEXT_ACCEPT}` : TEXT_ACCEPT;
}

/** Megas decimales, como Vercel: 4.000.000 bytes = "4 MB". */
export function formatBytes(n: number): string {
  if (n < 1_000_000) return `${Math.max(1, Math.round(n / 1000))} KB`;
  return `${(n / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB`;
}

const supported = (aiEnabled: boolean) =>
  aiEnabled ? "Probá con fotos, un PDF, Word (.docx), Excel (.xlsx) o texto (.txt, .csv)." : "Probá con Word (.docx), Excel (.xlsx) o texto (.txt, .csv).";

type Picked = { name: string; type: string; size: number };
export type Selection<T extends Picked> =
  | { ok: true; kind: "text"; files: { file: T; kind: TextKind }[] }
  | { ok: true; kind: "media"; files: { file: T; kind: MediaKind }[] }
  | { ok: false; error: string };

/** ¿Se pueden agregar estos archivos a los ya adjuntos (`current`)? Reglas del spec 3b, con mensajes para el usuario. */
export function checkSelection<T extends Picked>(current: MediaKind[], picked: T[], aiEnabled: boolean): Selection<T> {
  const items: { file: T; kind: AttachmentKind }[] = [];
  for (const file of picked) {
    const kind = classifyFile(file);
    if (!kind) return { ok: false, error: `No podemos leer «${file.name}». ${supported(aiEnabled)}` };
    items.push({ file, kind });
  }
  const media: { file: T; kind: MediaKind }[] = [];
  const text: { file: T; kind: TextKind }[] = [];
  for (const i of items) {
    if (i.kind === "image" || i.kind === "pdf") media.push({ file: i.file, kind: i.kind });
    else text.push({ file: i.file, kind: i.kind });
  }
  if (media.length > 0 && !aiEnabled) {
    return { ok: false, error: "Sin IA solo podemos leer archivos de texto (Word, Excel, .txt o .csv) con la rutina en formato El Bravo." };
  }
  if (text.length > 0 && (media.length > 0 || current.length > 0)) {
    return { ok: false, error: "Adjuntá fotos o un PDF, o archivos de texto: no los dos juntos." };
  }
  if (text.length > 0) {
    const big = text.find((i) => i.file.size > MAX_TEXT_FILE_BYTES);
    if (big) return { ok: false, error: `«${big.file.name}» es muy pesado (máximo ${formatBytes(MAX_TEXT_FILE_BYTES)}).` };
    return { ok: true, kind: "text", files: text };
  }
  const kinds = [...current, ...media.map((m) => m.kind)];
  const images = kinds.filter((k) => k === "image").length;
  const pdfs = kinds.length - images;
  if (images > 0 && pdfs > 0) return { ok: false, error: "Adjuntá fotos o un PDF, no los dos juntos." };
  if (pdfs > 1) return { ok: false, error: "Podés adjuntar un solo PDF." };
  if (images > MAX_IMAGES) return { ok: false, error: `Podés adjuntar hasta ${MAX_IMAGES} fotos.` };
  const pdf = media.find((m) => m.kind === "pdf");
  if (pdf && pdf.file.size > MAX_TOTAL_BYTES) {
    return { ok: false, error: `El PDF pesa ${formatBytes(pdf.file.size)}: el máximo es ${formatBytes(MAX_TOTAL_BYTES)}.` };
  }
  const huge = media.find((m) => m.kind === "image" && m.file.size > MAX_RAW_IMAGE_BYTES);
  if (huge) return { ok: false, error: `«${huge.file.name}» es demasiado pesada.` };
  return { ok: true, kind: "media", files: media };
}
