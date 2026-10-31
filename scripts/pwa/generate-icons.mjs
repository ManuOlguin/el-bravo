#!/usr/bin/env node
// Genera los íconos PNG de la PWA a partir de public/icons/icon.svg.
// Uso: node scripts/pwa/generate-icons.mjs
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dir = path.join(root, "public/icons");
const svg = await readFile(path.join(dir, "icon.svg"));

// El SVG ya tiene fondo a sangre y el logo dentro de la zona segura (círculo de r = 40 %),
// así que sirve tanto para "any" como para "maskable" y para el ícono de iOS (sin transparencia).
const outputs = [
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  { file: "icon-maskable-512.png", size: 512 },
  { file: "apple-touch-icon.png", size: 180 },
];

for (const { file, size } of outputs) {
  await sharp(svg, { density: Math.ceil((72 * size) / 512) * 2 })
    .resize(size, size)
    .flatten({ background: "#0a0a0a" })
    .png({ compressionLevel: 9 })
    .toFile(path.join(dir, file));
  console.log(`✓ public/icons/${file} (${size}×${size})`);
}
