"use client";
// Sección "Insignias" del catálogo /dev/ui (W1-2). Datos de ejemplo, sin DB.
import { useState } from "react";
import { Button } from "@/src/components/ui";
import { BadgeChangeList, BadgeGrid } from "@/src/features/badges";
import type { BadgeChange, UserBadgeView } from "@/src/server/badges/types";

const lv = (...t: number[]) => t.map((threshold, i) => ({ level: i + 1, threshold }));

const SAMPLE_BADGES: UserBadgeView[] = [
  { code: "EL_PERSISTENTE", name: "El Persistente", description: "Entrenamientos registrados en total.", iconKey: "flame", level: 1, maxLevel: 4, progress: 12, nextThreshold: 50, achievedAt: new Date("2026-10-20T21:00:00Z"), levels: lv(10, 50, 150, 300) },
  { code: "GYM_RAT", name: "Gym Rat", description: "Entrenamientos de fuerza, calistenia, crossfit o funcional.", iconKey: "dumbbell", level: 2, maxLevel: 3, progress: 64, nextThreshold: 150, achievedAt: new Date("2026-09-02T21:00:00Z"), levels: lv(10, 50, 150) },
  { code: "CORRE_FORREST", name: "Corre Forrest", description: "Salidas a correr (running o trail).", iconKey: "run", level: 0, maxLevel: 3, progress: 3, nextThreshold: 5, achievedAt: null, levels: lv(5, 25, 75) },
  { code: "IMPARABLE", name: "Imparable", description: "Tu mejor racha de semanas cumpliendo tu objetivo.", iconKey: "bolt", level: 3, maxLevel: 3, progress: 17, nextThreshold: null, achievedAt: new Date("2026-08-10T21:00:00Z"), levels: lv(4, 8, 16) },
  { code: "EL_PIERNAS", name: "El Piernas", description: "Series de ejercicios de piernas.", iconKey: "leg", level: 0, maxLevel: 3, progress: 0, nextThreshold: 50, achievedAt: null, levels: lv(50, 250, 1000) },
  { code: "SIX_PACK", name: "Six Pack", description: "Series de ejercicios de core.", iconKey: "abs", level: 1, maxLevel: 3, progress: 80, nextThreshold: 250, achievedAt: new Date("2026-10-01T21:00:00Z"), levels: lv(50, 250, 1000) },
  { code: "TODOTERRENO", name: "Todoterreno", description: "Tipos de actividad distintos que probaste.", iconKey: "compass", level: 0, maxLevel: 3, progress: 2, nextThreshold: 3, achievedAt: null, levels: lv(3, 5, 8) },
  { code: "MARATONISTA", name: "Maratonista", description: "Minutos totales entrenados.", iconKey: "clock", level: 1, maxLevel: 3, progress: 735, nextThreshold: 3000, achievedAt: new Date("2026-10-28T21:00:00Z"), levels: lv(600, 3000, 10000) },
  { code: "MADRUGADOR", name: "Madrugador", description: "Entrenamientos antes de las 8 de la mañana.", iconKey: "sunrise", level: 0, maxLevel: 3, progress: 1, nextThreshold: 5, achievedAt: null, levels: lv(5, 25, 75) },
];

const SAMPLE_CHANGES: BadgeChange[] = [
  { code: "EL_PERSISTENTE", name: "El Persistente", iconKey: "flame", levelBefore: 0, levelAfter: 1, progressBefore: 9, progressAfter: 10, nextThreshold: 50 },
  { code: "GYM_RAT", name: "Gym Rat", iconKey: "dumbbell", levelBefore: 1, levelAfter: 1, progressBefore: 6, progressAfter: 7, nextThreshold: 10 },
  { code: "MARATONISTA", name: "Maratonista", iconKey: "clock", levelBefore: 0, levelAfter: 0, progressBefore: 400, progressAfter: 445, nextThreshold: 600 },
  { code: "TODOTERRENO", name: "Todoterreno", iconKey: "compass", levelBefore: 0, levelAfter: 0, progressBefore: 1, progressAfter: 2, nextThreshold: 3 },
  { code: "SIX_PACK", name: "Six Pack", iconKey: "abs", levelBefore: 1, levelAfter: 1, progressBefore: 80, progressAfter: 84, nextThreshold: 250 },
];

export function BadgesSection() {
  const [replay, setReplay] = useState(0);
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-bold uppercase tracking-wide text-fg-subtle">Insignias</h2>
      <BadgeGrid badges={SAMPLE_BADGES} />
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-fg-muted">Post-entreno (BadgeChangeList)</p>
        <Button size="sm" variant="secondary" onClick={() => setReplay((n) => n + 1)}>
          Repetir animación
        </Button>
      </div>
      <BadgeChangeList key={replay} changes={SAMPLE_CHANGES} />
    </section>
  );
}
