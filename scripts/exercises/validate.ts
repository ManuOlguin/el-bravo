/**
 * Valida `prisma/seed/data/exercises.json` (schema Zod + reglas entre entradas) y lista los textos pendientes de revisión.
 * Uso: npx tsx scripts/exercises/validate.ts
 */
import { readFileSync } from "node:fs";
import { validateCatalog, type CatalogItem } from "../../src/features/exercises/catalog-schema";

const catalog = JSON.parse(readFileSync("prisma/seed/data/exercises.json", "utf8")) as CatalogItem[];
const muscleSlugs = new Set([...readFileSync("prisma/seed/muscles.ts", "utf8").matchAll(/slug: "([a-z0-9-]+)"/g)].map((m) => m[1]));

const errors = validateCatalog(catalog, muscleSlugs);
if (errors.length) {
  console.error(`✗ ${errors.length} error(es):\n` + errors.map((e) => `  - ${e}`).join("\n"));
  process.exit(1);
}
const pending = catalog.filter((e) => !e.reviewed);
const withImage = catalog.filter((e) => e.media.source === "free-exercise-db").length;
console.log(`✓ ${catalog.length} ejercicios válidos · ${withImage} con imagen · ${pending.length} con texto en revisión`);
if (pending.length && process.argv.includes("--pending")) {
  for (const e of pending) console.log(`  - ${e.slug} (${e.name})`);
}
