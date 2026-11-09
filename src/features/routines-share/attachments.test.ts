import { describe, expect, it } from "vitest";
import { acceptFor, checkSelection, classifyFile, formatBytes, isHeicName } from "./attachments";

const f = (name: string, type = "", size = 1000) => ({ name, type, size });

describe("classifyFile", () => {
  it("por extensión o por MIME", () => {
    expect(classifyFile(f("IMG_1234.HEIC"))).toBe("image");
    expect(classifyFile(f("captura.png", "image/png"))).toBe("image");
    expect(classifyFile(f("foto", "image/jpeg"))).toBe("image");
    expect(classifyFile(f("rutina.pdf"))).toBe("pdf");
    expect(classifyFile(f("x", "application/pdf"))).toBe("pdf");
    expect(classifyFile(f("Rutina.DOCX"))).toBe("docx");
    expect(classifyFile(f("plan.xlsx"))).toBe("xlsx");
    expect(classifyFile(f("notas.txt"))).toBe("text");
    expect(classifyFile(f("export.csv"))).toBe("text");
    expect(classifyFile(f("x", "text/plain"))).toBe("text");
  });

  it("lo demás no (Word y Excel viejos, SVG, Pages)", () => {
    expect(classifyFile(f("viejo.doc"))).toBeNull();
    expect(classifyFile(f("viejo.xls"))).toBeNull();
    expect(classifyFile(f("logo.svg", "image/svg+xml"))).toBeNull();
    expect(classifyFile(f("rutina.pages"))).toBeNull();
  });

  it("reconoce HEIC por nombre", () => {
    expect(isHeicName("IMG_1.heic")).toBe(true);
    expect(isHeicName("IMG_1.HEIF")).toBe(true);
    expect(isHeicName("IMG_1.jpg")).toBe(false);
  });
});

describe("acceptFor", () => {
  it("sin IA solo archivos de texto; con IA también fotos y PDF", () => {
    expect(acceptFor(false)).not.toMatch(/image|pdf/);
    expect(acceptFor(false)).toContain(".docx");
    expect(acceptFor(true)).toMatch(/^image\/\*,application\/pdf,\.pdf,/);
    expect(acceptFor(true)).toContain(".xlsx");
  });
});

describe("formatBytes", () => {
  it("KB o MB con coma decimal", () => {
    expect(formatBytes(4_000_000)).toBe("4 MB");
    expect(formatBytes(1_234_567)).toBe("1,2 MB");
    expect(formatBytes(350_000)).toBe("350 KB");
    expect(formatBytes(10)).toBe("1 KB");
  });
});

describe("checkSelection", () => {
  it("archivos de texto: van juntos al flujo de texto (con o sin IA)", () => {
    expect(checkSelection([], [f("a.docx"), f("b.txt")], false)).toMatchObject({ ok: true, kind: "text", files: [{ kind: "docx" }, { kind: "text" }] });
  });

  it("sin IA rechaza fotos y PDF", () => {
    expect(checkSelection([], [f("a.jpg")], false)).toEqual({
      ok: false,
      error: "Sin IA solo podemos leer archivos de texto (Word, Excel, .txt o .csv) con la rutina en formato El Bravo.",
    });
  });

  it("un tipo que no leemos nombra el archivo y dice qué sí", () => {
    expect(checkSelection([], [f("a.jpg"), f("rutina.pages")], true)).toEqual({
      ok: false,
      error: "No podemos leer «rutina.pages». Probá con fotos, un PDF, Word (.docx), Excel (.xlsx) o texto (.txt, .csv).",
    });
  });

  it("hasta 4 fotos, contando las que ya están adjuntas", () => {
    expect(checkSelection(["image", "image", "image"], [f("4.jpg")], true)).toMatchObject({ ok: true, kind: "media" });
    expect(checkSelection(["image", "image", "image"], [f("4.jpg"), f("5.jpg")], true)).toEqual({ ok: false, error: "Podés adjuntar hasta 4 fotos." });
  });

  it("fotos y PDF no se mezclan, y un solo PDF", () => {
    expect(checkSelection(["image"], [f("r.pdf")], true)).toEqual({ ok: false, error: "Adjuntá fotos o un PDF, no los dos juntos." });
    expect(checkSelection([], [f("a.pdf"), f("b.pdf")], true)).toEqual({ ok: false, error: "Podés adjuntar un solo PDF." });
  });

  it("archivos de texto no se mezclan con fotos o PDF", () => {
    const error = "Adjuntá fotos o un PDF, o archivos de texto: no los dos juntos.";
    expect(checkSelection(["image"], [f("a.txt")], true)).toEqual({ ok: false, error });
    expect(checkSelection([], [f("a.txt"), f("b.jpg")], true)).toEqual({ ok: false, error });
  });

  it("tamaños: PDF ≤ 4 MB, Word/Excel/texto ≤ 5 MB, foto original ≤ 30 MB", () => {
    expect(checkSelection([], [f("r.pdf", "", 5_200_000)], true)).toEqual({ ok: false, error: "El PDF pesa 5,2 MB: el máximo es 4 MB." });
    expect(checkSelection([], [f("a.docx", "", 6_000_000)], true)).toEqual({ ok: false, error: "«a.docx» es muy pesado (máximo 5 MB)." });
    expect(checkSelection([], [f("a.jpg", "", 31_000_000)], true)).toEqual({ ok: false, error: "«a.jpg» es demasiado pesada." });
  });
});

describe("checkTotalSize", () => {
  it("acepta hasta el límite y avisa si se pasa", async () => {
    const { checkTotalSize } = await import("./attachments");
    expect(checkTotalSize([2_000_000, 2_000_000])).toBeNull();
    expect(checkTotalSize([2_000_000, 2_000_001])).toMatch(/pesan demasiado/);
  });
});
