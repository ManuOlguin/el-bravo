/**
 * Formato de `prisma/seed/data/exercises.json` (fuente de verdad del catálogo oficial).
 * Lo usan el seed, `scripts/exercises/*` y los tests. Sin dependencias de servidor.
 */
import { z } from "zod";
import { EQUIPMENT } from "./types";

/** Imágenes de yuhonas/free-exercise-db (Unlicense). Mientras no estén en R2 (W1-5) se sirven desde GitHub raw. */
export const FREE_EXERCISE_DB_IMAGE_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

export const catalogMediaSchema = z.object({
  source: z.enum(["free-exercise-db", "svg", "none"]),
  path: z.string().min(1).nullable(),
  license: z.string().min(1).nullable(),
});

export const catalogItemSchema = z
  .object({
    slug: z.string().max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug inválido"),
    name: z.string().trim().min(2).max(100),
    nameEn: z.string().trim().min(2).max(100).nullable(),
    equipment: z.enum(EQUIPMENT),
    measureType: z.enum(["reps", "duration"]),
    tracksWeight: z.boolean(),
    aliases: z.array(z.object({ alias: z.string().trim().min(2).max(100), locale: z.enum(["es", "en"]) })),
    muscles: z.array(z.object({ slug: z.string().min(1), percentage: z.number().int().min(1).max(100) })).min(1),
    description: z.string(),
    instructions: z.array(z.string().trim().min(1)).max(6),
    media: catalogMediaSchema,
    /** true solo cuando un humano revisó textos e imagen. */
    reviewed: z.boolean(),
  })
  .superRefine((e, ctx) => {
    const sum = e.muscles.reduce((s, m) => s + m.percentage, 0);
    if (sum !== 100) ctx.addIssue({ code: "custom", path: ["muscles"], message: `los porcentajes suman ${sum}, no 100` });
    if (e.media.source === "free-exercise-db" && (!e.media.path || !e.media.license)) {
      ctx.addIssue({ code: "custom", path: ["media"], message: "free-exercise-db requiere path y license" });
    }
    if (e.reviewed && (e.description.trim() === "" || e.instructions.length < 3)) {
      ctx.addIssue({ code: "custom", path: ["reviewed"], message: "revisado sin descripción o con menos de 3 pasos" });
    }
  });

export type CatalogItem = z.infer<typeof catalogItemSchema>;

/** URL pública de la imagen del ejercicio (o null → ícono SVG por grupo muscular). */
export function mediaUrlFor(media: CatalogItem["media"]): string | null {
  if (media.source === "free-exercise-db" && media.path) return FREE_EXERCISE_DB_IMAGE_BASE + media.path;
  return null;
}

/**
 * Validación completa del JSON: schema + reglas entre entradas. Devuelve la lista de errores (vacía = OK).
 * `muscleSlugs`: los slugs de `prisma/seed/muscles.ts`.
 */
export function validateCatalog(raw: unknown, muscleSlugs: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  const parsed = z.array(z.unknown()).safeParse(raw);
  if (!parsed.success) return ["el catálogo tiene que ser un array"];
  const slugs = new Set<string>();
  const names = new Set<string>();
  parsed.data.forEach((item, i) => {
    const r = catalogItemSchema.safeParse(item);
    const label = (item as { slug?: string })?.slug ?? `#${i}`;
    if (!r.success) {
      for (const issue of r.error.issues) errors.push(`${label}: ${issue.path.join(".")} ${issue.message}`);
      return;
    }
    const e = r.data;
    if (slugs.has(e.slug)) errors.push(`${label}: slug duplicado`);
    slugs.add(e.slug);
    const n = e.name.toLowerCase();
    if (names.has(n)) errors.push(`${label}: nombre duplicado`);
    names.add(n);
    for (const m of e.muscles) if (!muscleSlugs.has(m.slug)) errors.push(`${label}: músculo inexistente "${m.slug}"`);
    if (new Set(e.muscles.map((m) => m.slug)).size !== e.muscles.length) errors.push(`${label}: músculo repetido`);
    if (e.aliases.length < 2) errors.push(`${label}: tiene menos de 2 alias`);
    if (e.instructions.length > 0) {
      if (e.instructions.length < 3) errors.push(`${label}: tiene menos de 3 pasos`);
      if (!e.instructions[e.instructions.length - 1].startsWith("Evitá:")) errors.push(`${label}: el último paso no empieza con "Evitá:"`);
    }
  });
  return errors;
}
