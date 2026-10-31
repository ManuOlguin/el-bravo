/** Helpers puros de presentación de niveles de insignias. */
import type { BadgeChange } from "@/src/server/badges/types";

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
  [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

/** 1 → "I", 4 → "IV". 0 o negativo → "". */
export function romanLevel(n: number): string {
  let rest = Math.floor(n);
  if (rest <= 0) return "";
  let out = "";
  for (const [value, symbol] of ROMAN) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}

export type LevelTone = "locked" | "bronze" | "silver" | "gold";

/** 0 bloqueada, 1 bronce, 2 plata, 3+ oro. */
export function levelTone(level: number): LevelTone {
  if (level <= 0) return "locked";
  if (level === 1) return "bronze";
  if (level === 2) return "silver";
  return "gold";
}

const TONE_CLASS: Record<LevelTone, string> = {
  locked: "text-fg-subtle",
  bronze: "text-bronze",
  silver: "text-silver",
  gold: "text-gold",
};

/** Clase de color (token) para el nivel. Se usa con `currentColor` en anillos e íconos. */
export function levelToneClass(level: number): string {
  return TONE_CLASS[levelTone(level)];
}

type Progress = { progress: number; nextThreshold: number | null };

/** 0..1 hacia el próximo umbral; 1 si ya está en el nivel máximo. */
export function ringFraction({ progress, nextThreshold }: Progress): number {
  if (nextThreshold === null) return 1;
  if (nextThreshold <= 0) return 0;
  return Math.min(1, Math.max(0, progress / nextThreshold));
}

/** "3/10" o "Nivel máximo". */
export function progressLabel({ progress, nextThreshold }: Progress): string {
  return nextThreshold === null ? "Nivel máximo" : `${progress}/${nextThreshold}`;
}

/** Pantalla post-entreno: subidas de nivel primero y, después, hasta `maxProgressed` avances sin subir de nivel. */
export function splitBadgeChanges(changes: BadgeChange[], maxProgressed = 3) {
  const levelUps = changes.filter((c) => c.levelAfter > c.levelBefore);
  const progressed = changes
    .filter((c) => c.levelAfter === c.levelBefore && c.progressAfter > c.progressBefore)
    .slice(0, maxProgressed);
  return { levelUps, progressed };
}
