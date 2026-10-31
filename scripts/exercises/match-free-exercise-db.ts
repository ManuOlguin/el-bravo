/**
 * Asocia imágenes del dataset abierto yuhonas/free-exercise-db (licencia Unlicense, verificada el 31-oct-2026:
 * https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE.md) a `prisma/seed/data/exercises.json`.
 *
 * Uso:
 *   npx tsx scripts/exercises/match-free-exercise-db.ts https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json
 *   npx tsx scripts/exercises/match-free-exercise-db.ts ./ruta/local/exercises.json --dry-run
 *
 * Reglas:
 *  1. `MANUAL` (slug → nombre exacto en el dataset, o null para bloquear) tiene prioridad.
 *  2. Si no, match exacto de `nameEn` o de un alias en inglés (normalizados) contra el nombre del dataset.
 *  3. Sin match → `media.source: "svg"` (la UI muestra un ícono por grupo muscular).
 * No descarga imágenes: `media.path` es la ruta relativa de la imagen 0 y el seed arma la URL raw pública
 * (`FREE_EXERCISE_DB_IMAGE_BASE`). W1-5 las sube a R2 cuando esté disponible.
 * No toca entradas con `reviewed: true` (las revisó un humano).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { normalize } from "../../src/features/exercises/search";
import { catalogItemSchema, type CatalogItem } from "../../src/features/exercises/catalog-schema";

const CATALOG_PATH = "prisma/seed/data/exercises.json";
const LICENSE = "Unlicense";

type DatasetExercise = { id: string; name: string; images: string[] };

/**
 * Elegidos a mano mirando el dataset: nombres distintos a los nuestros o variantes más fieles.
 * `null` = no usar imagen aunque el nombre coincida (p. ej. "Air Bike" en el dataset es un abdominal, no la bici).
 */
const MANUAL: Record<string, string | null> = {
  "press-de-banca": "Barbell Bench Press - Medium Grip",
  "press-inclinado": "Barbell Incline Bench Press - Medium Grip",
  "press-declinado": "Decline Barbell Bench Press",
  "aperturas-con-mancuernas": "Dumbbell Flyes",
  "fondos-pecho": "Dips - Chest Version",
  lagartijas: "Pushups",
  "lagartijas-inclinadas": "Incline Push-Up",
  dominadas: "Pullups",
  "jalon-al-pecho": "Wide-Grip Lat Pulldown",
  "remo-con-barra": "Bent Over Barbell Row",
  "remo-con-mancuerna": "One-Arm Dumbbell Row",
  "remo-sentado": "Seated Cable Rows",
  "pull-over": "Straight-Arm Dumbbell Pullover",
  "peso-muerto": "Barbell Deadlift",
  "press-militar": "Standing Military Press",
  "elevaciones-laterales": "Side Lateral Raise",
  "elevaciones-frontales": "Front Dumbbell Raise",
  pajaros: "Seated Bent-Over Rear Delt Raise",
  "arnold-press": "Arnold Dumbbell Press",
  "curl-de-biceps": "Dumbbell Bicep Curl",
  "curl-martillo": "Hammer Curls",
  "curl-inverso": "Reverse Barbell Curl",
  "curl-concentrado": "Concentration Curls",
  "curl-predicador": "Preacher Curl",
  "farmer-carry": "Farmer's Walk",
  "press-frances": "Lying Triceps Press",
  rompecraneos: "EZ-Bar Skullcrusher",
  "fondos-triceps": "Bench Dips",
  "extension-por-encima-de-la-cabeza": "Standing Dumbbell Triceps Extension",
  sentadillas: "Barbell Squat",
  "sentadilla-frontal": "Front Barbell Squat",
  zancadas: "Dumbbell Lunges",
  "bulgarian-split-squat": "Split Squat with Dumbbells",
  "hip-thrust": "Barbell Hip Thrust",
  "curl-femoral": "Lying Leg Curls",
  "extension-de-cuadriceps": "Leg Extensions",
  "elevacion-de-gemelos": "Standing Calf Raises",
  "step-ups": "Dumbbell Step Ups",
  abdominales: "Sit-Up",
  "elevacion-de-piernas": "Flat Bench Lying Leg Raise",
  "ab-wheel": "Ab Roller",
  "plancha-lateral": "Side Bridge",
  "superman-hold": "Superman",
  "trote-en-cinta": "Jogging, Treadmill",
  "bicicleta-fija": "Bicycling, Stationary",
  eliptico: "Elliptical Trainer",
  soga: "Rope Jumping",
  "remo-ergometrico": "Rowing, Stationary",
  "air-bike": null,
  "caminata-inclinada": "Walking, Treadmill",
  "box-jumps": "Front Box Jump",
  "battle-ropes": "Battling Ropes",
  "movilidad-de-tobillos": "Ankle Circles",
  // El dataset solo tiene el estiramiento de cuádriceps acostado con banda; nuestros pasos son de pie.
  "estiramiento-de-cuadriceps": null,
  // El dataset tiene la versión a un brazo y con kettlebell: no coincide con la técnica descripta.
  "kettlebell-swings": null,
  thrusters: null,
};

export type MatchResult = { slug: string; datasetName: string | null; media: CatalogItem["media"] };

export function matchCatalog(catalog: CatalogItem[], dataset: DatasetExercise[]): MatchResult[] {
  const byName = new Map(dataset.map((d) => [d.name, d]));
  const byNormalized = new Map(dataset.map((d) => [normalize(d.name), d]));
  return catalog.map((e) => {
    let hit: DatasetExercise | undefined;
    if (e.slug in MANUAL) {
      const name = MANUAL[e.slug];
      hit = name === null ? undefined : byName.get(name);
      if (name && !hit) throw new Error(`MANUAL["${e.slug}"] = "${name}" no existe en el dataset`);
    } else {
      const candidates = [e.nameEn, ...e.aliases.filter((a) => a.locale === "en").map((a) => a.alias)].filter((x): x is string => !!x);
      hit = candidates.map((c) => byNormalized.get(normalize(c))).find(Boolean);
    }
    const image = hit?.images[0];
    return hit && image
      ? { slug: e.slug, datasetName: hit.name, media: { source: "free-exercise-db", path: image, license: LICENSE } }
      : { slug: e.slug, datasetName: null, media: { source: "svg", path: null, license: null } };
  });
}

async function loadDataset(src: string): Promise<DatasetExercise[]> {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`No se pudo descargar ${src}: HTTP ${res.status}`);
    return (await res.json()) as DatasetExercise[];
  }
  return JSON.parse(readFileSync(src, "utf8")) as DatasetExercise[];
}

async function main() {
  const src = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!src) {
    console.error("Uso: npx tsx scripts/exercises/match-free-exercise-db.ts <url-o-ruta de dist/exercises.json> [--dry-run]");
    process.exit(1);
  }
  const catalog = (JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as unknown[]).map((x) => catalogItemSchema.parse(x));
  const results = matchCatalog(catalog, await loadDataset(src));
  const bySlug = new Map(results.map((r) => [r.slug, r]));
  const updated = catalog.map((e) => (e.reviewed ? e : { ...e, media: bySlug.get(e.slug)!.media }));
  for (const r of results) console.log(`${r.datasetName ? "✓" : "·"} ${r.slug}${r.datasetName ? ` → ${r.datasetName}` : " (svg)"}`);
  const n = results.filter((r) => r.datasetName).length;
  console.log(`\n${n}/${results.length} con imagen del dataset; ${results.length - n} con ícono SVG.`);
  if (!dryRun) writeFileSync(CATALOG_PATH, JSON.stringify(updated, null, 2) + "\n");
}

if (process.argv[1]?.endsWith("match-free-exercise-db.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
