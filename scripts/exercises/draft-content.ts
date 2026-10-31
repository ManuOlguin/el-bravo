/**
 * Genera BORRADORES de descripción y pasos (es-AR) para las entradas de `prisma/seed/data/exercises.json`
 * que tienen la descripción vacía. Siempre deja `reviewed: false`: un humano tiene que revisarlos (roadmap D6).
 *
 * Uso: ANTHROPIC_API_KEY=... npx tsx scripts/exercises/draft-content.ts [--limit 10] [--dry-run]
 *
 * Nota (31-oct-2026): los 78 ejercicios iniciales se redactaron a mano porque no había API key; este script
 * queda para ejercicios nuevos del catálogo oficial.
 */
import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { catalogItemSchema, type CatalogItem } from "../../src/features/exercises/catalog-schema";

const CATALOG_PATH = "prisma/seed/data/exercises.json";
const MODEL = "claude-sonnet-5-5";

const SYSTEM = `Escribís textos para el catálogo de ejercicios de una app de entrenamiento argentina.
Reglas:
- Español rioplatense con "vos" e imperativo ("Apoyá", "Bajá", "Mantené").
- "description": 1 o 2 oraciones: qué es el ejercicio y qué trabaja.
- "instructions": entre 3 y 6 pasos cortos. El ÚLTIMO paso es el error más común y empieza exactamente con "Evitá: ".
- No inventes datos médicos, cifras de lesiones ni beneficios de salud. Si dudás, sé genérico.
- Si el ejercicio se mide por tiempo, describí cómo sostenerlo o hacerlo durante el tiempo elegido.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    description: { type: "string" },
    instructions: { type: "array", items: { type: "string" } },
  },
  required: ["description", "instructions"],
  additionalProperties: false,
};

function isValidDraft(d: { description: string; instructions: string[] }) {
  return (
    d.description.trim().length > 10 &&
    d.instructions.length >= 3 &&
    d.instructions.length <= 6 &&
    d.instructions[d.instructions.length - 1].startsWith("Evitá:")
  );
}

async function draft(client: Anthropic, e: CatalogItem) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [
      {
        role: "user",
        content:
          `Ejercicio: ${e.name}${e.nameEn ? ` (en inglés: ${e.nameEn})` : ""}\n` +
          `Equipamiento: ${e.equipment}\nSe mide por: ${e.measureType === "duration" ? "tiempo" : "repeticiones"}\n` +
          `Músculos: ${e.muscles.map((m) => `${m.slug} ${m.percentage}%`).join(", ")}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error(`El modelo rechazó el pedido (${response.stop_details?.category ?? "sin categoría"})`);
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Respuesta sin texto");
  const parsed = JSON.parse(text.text) as { description: string; instructions: string[] };
  if (!isValidDraft(parsed)) throw new Error(`Borrador inválido: ${text.text}`);
  return parsed;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error(
      "Falta ANTHROPIC_API_KEY. Corré: ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/exercises/draft-content.ts\n" +
        "Los textos también se pueden completar a mano en prisma/seed/data/exercises.json (con reviewed: false)."
    );
    process.exit(1);
  }
  const limitIdx = process.argv.indexOf("--limit");
  const limit = limitIdx > 0 ? Number(process.argv[limitIdx + 1]) : Infinity;
  const dryRun = process.argv.includes("--dry-run");

  const catalog = (JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as unknown[]).map((x) => catalogItemSchema.parse(x));
  const client = new Anthropic();
  let done = 0;
  for (const e of catalog) {
    if (done >= limit) break;
    if (e.reviewed || e.description.trim() !== "") continue;
    try {
      const d = await draft(client, e);
      e.description = d.description;
      e.instructions = d.instructions;
      e.reviewed = false;
      done++;
      console.log(`✓ ${e.slug}`);
    } catch (err) {
      console.error(`✗ ${e.slug}: ${(err as Error).message}`);
    }
  }
  if (!dryRun) writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`${done} borrador(es) generados${dryRun ? " (dry-run, sin escribir)" : ""}. Quedan con reviewed: false.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
