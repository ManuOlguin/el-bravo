import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { cellText, decodeText, extractTextFromFiles, sheetsToText } from "./file-text";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const zip = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
const rootRels = (target: string) =>
  `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="${target}"/></Relationships>`;

/** .docx mínimo: un párrafo por línea. */
function docx(paragraphs: string[]): Uint8Array {
  return zip({
    "[Content_Types].xml": `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    "_rels/.rels": rootRels("word/document.xml"),
    "word/document.xml": `${XML}<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs
      .map((p) => `<w:p><w:r><w:t xml:space="preserve">${esc(p)}</w:t></w:r></w:p>`)
      .join("")}</w:body></w:document>`,
  });
}

/** .xlsx mínimo con strings compartidos y números. */
function xlsx(sheets: { name: string; rows: (string | number)[][] }[]): Uint8Array {
  const strings: string[] = [];
  const si = (s: string) => (strings.includes(s) ? strings.indexOf(s) : strings.push(s) - 1);
  const col = (i: number) => String.fromCharCode(65 + i);
  const SS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const files: Record<string, string> = {};
  sheets.forEach((s, n) => {
    const rows = s.rows
      .map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => (typeof v === "number" ? `<c r="${col(ci)}${ri + 1}"><v>${v}</v></c>` : `<c r="${col(ci)}${ri + 1}" t="s"><v>${si(v)}</v></c>`)).join("")}</row>`)
      .join("");
    files[`xl/worksheets/sheet${n + 1}.xml`] = `${XML}<worksheet xmlns="${SS}"><sheetData>${rows}</sheetData></worksheet>`;
  });
  files["xl/sharedStrings.xml"] = `${XML}<sst xmlns="${SS}" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join("")}</sst>`;
  files["xl/styles.xml"] = `${XML}<styleSheet xmlns="${SS}"><fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>`;
  files["xl/workbook.xml"] = `${XML}<workbook xmlns="${SS}" xmlns:r="${REL}"><sheets>${sheets.map((s, n) => `<sheet name="${esc(s.name)}" sheetId="${n + 1}" r:id="rId${n + 1}"/>`).join("")}</sheets></workbook>`;
  files["xl/_rels/workbook.xml.rels"] = `${XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
    .map((_, n) => `<Relationship Id="rId${n + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${n + 1}.xml"/>`)
    .join("")}<Relationship Id="rIdS" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/><Relationship Id="rIdT" Type="${REL}/styles" Target="styles.xml"/></Relationships>`;
  files["_rels/.rels"] = rootRels("xl/workbook.xml");
  files["[Content_Types].xml"] = `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets
    .map((_, n) => `<Override PartName="/xl/worksheets/sheet${n + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join("")}<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
  return zip(files);
}

const file = (data: string | Uint8Array, name: string) => new File([typeof data === "string" ? data : new Uint8Array(data)], name);
/** "—" es 0x97 en Windows-1252; "ú" y "×" coinciden con Latin-1. */
const cp1252 = (s: string) => Uint8Array.from(s, (c) => (c === "—" ? 0x97 : c.charCodeAt(0)));

describe("sheetsToText / cellText", () => {
  it("una fila por línea, celdas con « — », sin vacías; con varias hojas, cada una con su nombre", () => {
    expect(sheetsToText([{ sheet: "Hoja1", data: [["Press de banca", "4×8 @ 60 kg"], [null, ""], ["Plancha", "3×45s"]] }])).toBe(
      "Press de banca — 4×8 @ 60 kg\nPlancha — 3×45s"
    );
    expect(sheetsToText([{ sheet: "Día 1", data: [["Banca", 4, 8, 62.5]] }, { sheet: "Vacía", data: [[]] }, { sheet: "Día 2", data: [["Sentadilla", 5, 5]] }])).toBe(
      "Día 1\nBanca — 4 — 8 — 62.5\n\nDía 2\nSentadilla — 5 — 5"
    );
  });

  it("fechas, booleanos y números raros", () => {
    expect(cellText(new Date("2026-11-09T00:00:00Z"))).toBe("2026-11-09");
    expect(cellText(true)).toBe("sí");
    expect(cellText(12.3456)).toBe("12.35");
    expect(cellText(Number.NaN)).toBe("");
    expect(cellText("  dos   espacios ")).toBe("dos espacios");
  });
});

describe("decodeText", () => {
  it("UTF-8 o, si no es válido, Windows-1252", () => {
    expect(decodeText(new TextEncoder().encode("Músculo — 3×10").buffer)).toBe("Músculo — 3×10");
    expect(decodeText(cp1252("Músculo — 3×10").buffer)).toBe("Músculo — 3×10");
  });
});

describe("extractTextFromFiles", () => {
  it(".txt y .csv tal cual (prolijos), varios archivos en un solo texto", async () => {
    const r = await extractTextFromFiles([
      { file: file("🏋️ Pecho\r\nPress de banca — 4×8 @ 60 kg   \r\n\r\n\r\n\r\nPlancha — 3×45s", "a.txt"), kind: "text" },
      { file: file("Remo;3;12", "b.csv"), kind: "text" },
    ]);
    expect(r).toEqual({ text: "🏋️ Pecho\nPress de banca — 4×8 @ 60 kg\n\nPlancha — 3×45s\n\nRemo;3;12", truncated: false });
  });

  it(".docx: un párrafo por línea", async () => {
    const r = await extractTextFromFiles([{ file: file(docx(["🏋️ Rutina de Juan", "Press de banca — 4×8 @ 60 kg", "Plancha — 3×45s"]), "r.docx"), kind: "docx" }]);
    expect(r.text).toBe("🏋️ Rutina de Juan\nPress de banca — 4×8 @ 60 kg\nPlancha — 3×45s");
  });

  it(".xlsx: todas las hojas", async () => {
    const r = await extractTextFromFiles([
      { file: file(xlsx([{ name: "Día 1", rows: [["Press de banca", "4×8 @ 60 kg"]] }, { name: "Día 2", rows: [["Sentadilla", 5, 62.5]] }]), "r.xlsx"), kind: "xlsx" },
    ]);
    expect(r.text).toBe("Día 1\nPress de banca — 4×8 @ 60 kg\n\nDía 2\nSentadilla — 5 — 62.5");
  });

  it("corta en 8.000 caracteres y avisa", async () => {
    const r = await extractTextFromFiles([{ file: file("x".repeat(9000), "largo.txt"), kind: "text" }]);
    expect(r.truncated).toBe(true);
    expect(r.text).toHaveLength(8000);
  });

  it("un archivo roto da un error que lo nombra", async () => {
    await expect(extractTextFromFiles([{ file: file("no soy un zip", "rutina.docx"), kind: "docx" }])).rejects.toThrow(
      "No pudimos leer «rutina.docx». ¿Es un Word (.docx) válido?"
    );
  });
});
