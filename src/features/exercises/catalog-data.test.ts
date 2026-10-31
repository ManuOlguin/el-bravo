import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { catalogItemSchema, validateCatalog, mediaUrlFor, type CatalogItem } from "./catalog-schema";
import { normalize } from "./search";

const catalog = JSON.parse(readFileSync("prisma/seed/data/exercises.json", "utf8")) as CatalogItem[];
// prisma/seed/muscles.ts importa el cliente de Prisma: se leen los slugs del código fuente.
const muscleSlugs = new Set([...readFileSync("prisma/seed/muscles.ts", "utf8").matchAll(/slug: "([a-z0-9-]+)"/g)].map((m) => m[1]));

describe("prisma/seed/data/exercises.json", () => {
  it("tiene los 78 ejercicios oficiales", () => expect(catalog.length).toBeGreaterThanOrEqual(78));

  it("pasa la validación completa (schema, únicos, músculos, alias, pasos)", () => {
    expect(muscleSlugs.size).toBeGreaterThan(10);
    expect(validateCatalog(catalog, muscleSlugs)).toEqual([]);
  });

  it("todas las entradas tienen alias en español y en inglés", () => {
    for (const e of catalog) {
      expect(e.aliases.length, e.slug).toBeGreaterThanOrEqual(2);
      expect(e.aliases.some((a) => a.locale === "en") || e.nameEn !== null, e.slug).toBe(true);
    }
  });

  it("textos: descripción y 3–6 pasos con 'Evitá:' al final", () => {
    for (const e of catalog) {
      expect(e.description.trim().length, e.slug).toBeGreaterThan(10);
      expect(e.instructions.length, e.slug).toBeGreaterThanOrEqual(3);
      expect(e.instructions.length, e.slug).toBeLessThanOrEqual(6);
      expect(e.instructions.at(-1)!.startsWith("Evitá:"), e.slug).toBe(true);
    }
  });

  it("los alias normalizados no se repiten dentro de un ejercicio", () => {
    for (const e of catalog) {
      const n = e.aliases.map((a) => normalize(a.alias));
      expect(new Set(n).size, e.slug).toBe(n.length);
    }
  });

  it("media: free-exercise-db con path y licencia, o svg", () => {
    for (const e of catalog) {
      expect(["free-exercise-db", "svg"], e.slug).toContain(e.media.source);
      if (e.media.source === "free-exercise-db") expect(mediaUrlFor(e.media)).toMatch(/^https:\/\/raw\.githubusercontent\.com\/.+\.(jpg|png|gif)$/);
      else expect(mediaUrlFor(e.media)).toBeNull();
    }
  });
});

describe("validateCatalog", () => {
  const base: CatalogItem = {
    slug: "x", name: "Ejercicio X", nameEn: null, equipment: "other", measureType: "reps", tracksWeight: true,
    aliases: [{ alias: "equis", locale: "es" }, { alias: "ex", locale: "en" }], muscles: [{ slug: "pecho", percentage: 100 }],
    description: "", instructions: [], media: { source: "svg", path: null, license: null }, reviewed: false,
  };
  const slugs = new Set(["pecho", "triceps"]);

  it("acepta una entrada mínima válida", () => expect(validateCatalog([base], slugs)).toEqual([]));
  it("detecta porcentajes que no suman 100", () =>
    expect(validateCatalog([{ ...base, muscles: [{ slug: "pecho", percentage: 90 }] }], slugs).join()).toMatch(/suman 90/));
  it("detecta músculos inexistentes y slugs duplicados", () => {
    const errs = validateCatalog([{ ...base, muscles: [{ slug: "nope", percentage: 100 }] }, { ...base, name: "Otro" }], slugs);
    expect(errs.join()).toMatch(/inexistente/);
    expect(errs.join()).toMatch(/slug duplicado/);
  });
  it("reviewed exige descripción y ≥ 3 pasos", () => {
    expect(catalogItemSchema.safeParse({ ...base, reviewed: true }).success).toBe(false);
    expect(validateCatalog([{ ...base, description: "d", instructions: ["a", "b", "Evitá: c"], reviewed: true }], slugs)).toEqual([]);
  });
  it("menos de 2 alias es error", () => expect(validateCatalog([{ ...base, aliases: [] }], slugs).join()).toMatch(/2 alias/));
});
