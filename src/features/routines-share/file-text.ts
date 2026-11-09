// src/features/routines-share/file-text.ts
/**
 * Texto de un Word (.docx), Excel (.xlsx) o .txt/.csv, leído EN EL NAVEGADOR (spec 2026-10-31, fase 3b): estos
 * archivos no se suben. El texto va al campo de "Importar rutina" y sigue el flujo de texto (El Bravo o IA).
 * `mammoth` y `read-excel-file` se cargan con import() solo cuando hace falta.
 */
import type { TextKind } from "./attachments";
import { MAX_IMPORT_TEXT_CHARS } from "./import-limits";

export type SheetData = { sheet: string; data: unknown[][] };

const LABEL: Record<TextKind, string> = { docx: "Word (.docx)", xlsx: "Excel (.xlsx)", text: "archivo de texto" };

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  if (typeof v === "number") return Number.isFinite(v) ? String(Math.round(v * 100) / 100) : "";
  if (typeof v === "boolean") return v ? "sí" : "no";
  return String(v).replace(/\s+/g, " ").trim();
}

/** Cada fila no vacía es una línea con sus celdas unidas por " — " (así "Press de banca │ 4×8 @ 60 kg" queda en formato El Bravo). */
export function sheetsToText(sheets: SheetData[]): string {
  const blocks = sheets
    .map((s) => ({ name: s.sheet.trim(), lines: s.data.map((row) => row.map(cellText).filter(Boolean).join(" — ")).filter(Boolean) }))
    .filter((b) => b.lines.length > 0);
  return blocks.map((b) => (blocks.length > 1 && b.name ? [b.name, ...b.lines] : b.lines).join("\n")).join("\n\n");
}

/** UTF-8; si no es válido, Windows-1252 (los CSV que exporta Excel en Windows). */
export function decodeText(buf: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

function tidy(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

async function docxToText(data: ArrayBuffer): Promise<string> {
  const { extractRawText } = await import("mammoth");
  // El build de navegador de mammoth lee `arrayBuffer`; el de Node (tests), `buffer`. JSZip acepta los dos.
  const input = { arrayBuffer: data, buffer: new Uint8Array(data) };
  const { value } = await extractRawText(input);
  return value.replace(/\n\n/g, "\n"); // mammoth separa párrafos con una línea en blanco
}

async function xlsxToText(data: ArrayBuffer): Promise<string> {
  const { default: readExcelFile } = await import("read-excel-file/universal");
  return sheetsToText(await readExcelFile(data));
}

async function fileToText(file: File, kind: TextKind): Promise<string> {
  const data = await file.arrayBuffer();
  if (kind === "docx") return docxToText(data);
  if (kind === "xlsx") return xlsxToText(data);
  return decodeText(data);
}

export async function extractTextFromFiles(files: { file: File; kind: TextKind }[]): Promise<{ text: string; truncated: boolean }> {
  const parts: string[] = [];
  for (const { file, kind } of files) {
    let raw: string;
    try {
      raw = await fileToText(file, kind);
    } catch {
      throw new Error(`No pudimos leer «${file.name}». ¿Es un ${LABEL[kind]} válido?`);
    }
    const t = tidy(raw);
    if (t) parts.push(t);
  }
  const text = parts.join("\n\n");
  return text.length > MAX_IMPORT_TEXT_CHARS ? { text: text.slice(0, MAX_IMPORT_TEXT_CHARS), truncated: true } : { text, truncated: false };
}
