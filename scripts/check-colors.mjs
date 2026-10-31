// Guarda contra colores hex hardcodeados en componentes (roadmap §4: solo tokens de app/globals.css).
// Uso: `npm run lint:colors` (verifica) | `node scripts/check-colors.mjs --update` (reescribe la baseline).
// Falla si un archivo SUPERA su cantidad de hex en scripts/color-baseline.json o si un archivo nuevo tiene hex.
// La baseline solo baja: cuando limpiás un archivo, corré --update. W3 la deja en {}.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "src"];
const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const baselinePath = "scripts/color-baseline.json";
const update = process.argv.includes("--update");

// Archivos donde un color literal es obligatorio (metadata del navegador / PWA, no hay CSS vars ahí).
const ALLOW = new Set(["app/manifest.ts", "app/layout.tsx"]);
const isTest = (f) => /\.(test|int\.test)\.[jt]sx?$/.test(f);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "generated" || name === "node_modules") continue;
      walk(p, out);
    } else if (/\.(tsx|ts|jsx|js|mjs)$/.test(p)) out.push(p);
  }
  return out;
}

const counts = {};
for (const root of ROOTS) {
  if (!existsSync(root)) continue;
  for (const f of walk(root)) {
    const rel = f.split("\\").join("/");
    if (ALLOW.has(rel) || isTest(rel)) continue;
    const n = (readFileSync(f, "utf8").match(HEX) || []).length;
    if (n) counts[rel] = n;
  }
}

const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));

if (update) {
  writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + "\n");
  const total = Object.values(sorted).reduce((a, b) => a + b, 0);
  console.log(`Baseline actualizada: ${Object.keys(sorted).length} archivos, ${total} colores`);
  process.exit(0);
}

const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};
const offenders = Object.entries(sorted).filter(([f, n]) => n > (baseline[f] ?? 0));
if (offenders.length) {
  console.error("Colores hex hardcodeados nuevos (usá tokens de app/globals.css):");
  for (const [f, n] of offenders) console.error(`  ${f}: ${n} (baseline ${baseline[f] ?? 0})`);
  process.exit(1);
}
const improved = Object.entries(baseline).filter(([f, n]) => (sorted[f] ?? 0) < n);
if (improved.length) {
  console.log(`(${improved.length} archivo(s) bajaron de la baseline: corré \`node scripts/check-colors.mjs --update\`)`);
}
console.log("lint:colors OK");
