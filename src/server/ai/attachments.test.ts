import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { pdfPageCountHint, readImportAttachments, sniffType } from "./attachments";

const bytes = (...xs: number[]) => new Uint8Array(xs);
const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const jpeg = (content = "foto", padTo = 0) => {
  const head = bytes(...JPEG);
  const body = new TextEncoder().encode(content);
  return new File([head, body, new Uint8Array(Math.max(0, padTo - head.length - body.length))], "foto.jpg", { type: "image/jpeg" });
};
const pdfText = (pages: number) =>
  `%PDF-1.4\n2 0 obj\n<< /Type /Pages /Count ${pages} >>\nendobj\n${Array.from({ length: pages }, (_, i) => `${i + 3} 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj`).join("\n")}\n%%EOF`;
const pdf = (pages: number) => new File([pdfText(pages)], "Mi rutina de Juan Pérez.pdf", { type: "application/pdf" });
const form = (...files: (File | string)[]) => {
  const f = new FormData();
  for (const x of files) f.append("files", x);
  return f;
};

describe("sniffType", () => {
  it("por los primeros bytes, no por el nombre", () => {
    expect(sniffType(bytes(...JPEG, 1, 2))).toBe("image/jpeg");
    expect(sniffType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(sniffType(new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("image/webp");
    expect(sniffType(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffType(new TextEncoder().encode("<html>"))).toBeNull();
    expect(sniffType(bytes())).toBeNull();
  });
});

describe("pdfPageCountHint", () => {
  it("cuenta los objetos /Type /Page (no /Pages); null si no se pueden contar", () => {
    expect(pdfPageCountHint(new TextEncoder().encode(pdfText(3)))).toBe(3);
    expect(pdfPageCountHint(new TextEncoder().encode("%PDF-1.5\n<< /Type /ObjStm /Length 900 >>stream\nx\u0001\u0002endstream"))).toBeNull();
  });
});

describe("readImportAttachments", () => {
  it("fotos: tipo por bytes; un PDF va siempre como rutina.pdf (no se manda el nombre del usuario)", async () => {
    const asPdfButJpeg = new File([bytes(...JPEG, 9)], "x.pdf", { type: "application/pdf" });
    const r = await readImportAttachments(form(jpeg(), asPdfButJpeg));
    expect(r.ok && r.files.map((f) => (f.type === "image" ? f.mediaType : f.type))).toEqual(["image/jpeg", "image/jpeg"]);
    const p = await readImportAttachments(form(pdf(2)));
    expect(p.ok && p.files).toEqual([{ type: "pdf", filename: "rutina.pdf", data: expect.any(Uint8Array) }]);
  });

  it("rechaza con mensajes claros", async () => {
    const html = new File(["<html>hola</html>"], "foto.jpg", { type: "image/jpeg" });
    const cases: [FormData, string][] = [
      [form(), "Adjuntá al menos una foto o un PDF."],
      [form("texto suelto"), "Archivo inválido."],
      [form(new File([], "vacia.jpg")), "Uno de los archivos está vacío."],
      [form(html), "Solo podemos leer fotos (JPG, PNG o WebP) o un PDF."],
      [form(jpeg(), jpeg(), jpeg(), jpeg(), jpeg()), "Podés adjuntar hasta 4 fotos o un PDF."],
      [form(jpeg("a", 2_100_000), jpeg("b", 2_100_000)), "Los archivos pesan 4,2 MB: el máximo es 4 MB."],
      [form(jpeg("a", 1_600_000)), "Una de las fotos es demasiado pesada. Quitala y adjuntala de nuevo."],
      [form(jpeg(), pdf(1)), "Adjuntá fotos o un PDF, no los dos juntos."],
      [form(pdf(1), pdf(1)), "Podés adjuntar un solo PDF."],
      [form(pdf(11)), "El PDF tiene 11 páginas: el máximo es 10. Mandá solo las de la rutina."],
    ];
    for (const [f, error] of cases) expect(await readImportAttachments(f)).toEqual({ ok: false, error });
  });
});
