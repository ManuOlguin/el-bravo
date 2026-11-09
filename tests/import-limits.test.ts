import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import config from "@/next.config";
import { AI_IMPORT_TIMEOUT_MS, MAX_TOTAL_BYTES } from "@/src/features/routines-share/import-limits";

const ROOT = path.resolve(__dirname, "..");

describe("límites de importar rutinas", () => {
  it("la IA tiene tiempo de responder antes de que Vercel corte la función de /routines/import", () => {
    const page = readFileSync(path.join(ROOT, "app/routines/import/page.tsx"), "utf8");
    const maxDuration = Number(page.match(/export const maxDuration = (\d+);/)?.[1]);
    expect(maxDuration).toBeGreaterThan(0);
    // 10 s de margen: sesión, consultas a la base y la respuesta de la acción.
    expect(AI_IMPORT_TIMEOUT_MS + 10_000).toBeLessThanOrEqual(maxDuration * 1000);
  });

  it("las Server Actions aceptan los 4 MB de adjuntos y no pasan el tope de Vercel (4,5 MB)", () => {
    expect(config.experimental?.serverActions?.bodySizeLimit).toBe("4.5mb");
    expect(MAX_TOTAL_BYTES + 64_000).toBeLessThanOrEqual(4_500_000); // + encabezados del multipart
  });
});
