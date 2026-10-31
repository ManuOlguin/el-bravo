"use client";
// Sección "Festejo post-entreno" del catálogo /dev/ui: la secuencia completa con datos de ejemplo, sin DB.
import { useState } from "react";
import { Button } from "@/src/components/ui";
import { buildCelebrationSteps } from "@/src/features/workout/celebration";
import { CelebrationSequence } from "@/src/features/workout/CelebrationSequence";
import type { Celebration } from "@/src/features/workout/types";
import type { ScoringEffect } from "@/src/server/scoring/types";
import type { BadgeChange } from "@/src/server/badges/types";

const SCORING: ScoringEffect[] = [
  { seasonId: "s1", seasonName: "Temporada de verano", groupId: "g1", groupName: "Los Bravos", activityPoints: 26, activityReason: null, totalBefore: 288, totalAfter: 334, rankBefore: 3, rankAfter: 1 },
  { seasonId: "s2", seasonName: "Liga del laburo", groupId: "g2", groupName: "Oficina", activityPoints: 26, activityReason: null, totalBefore: 120, totalAfter: 146, rankBefore: 2, rankAfter: 2 },
];

const BADGES: BadgeChange[] = [
  { code: "GYM_RAT", name: "Gym Rat", iconKey: "dumbbell", levelBefore: 1, levelAfter: 2, progressBefore: 49, progressAfter: 50, nextThreshold: 150 },
  { code: "CORRE_FORREST", name: "Corre Forrest", iconKey: "run", levelBefore: 0, levelAfter: 0, progressBefore: 3, progressAfter: 4, nextThreshold: 5 },
  { code: "MARATONISTA", name: "Maratonista", iconKey: "clock", levelBefore: 0, levelAfter: 0, progressBefore: 445, progressAfter: 505, nextThreshold: 600 },
];

const CELEBRATION: Celebration = {
  workoutNumber: 42,
  week: { workouts: 3, goal: 3, justMet: true, perfectStreak: 4 },
  records: [
    { exerciseId: "bench", exerciseName: "Press de banca", weightKg: 85, reps: 5, previousKg: 80 },
    { exerciseId: "squat", exerciseName: "Sentadillas", weightKg: 102.5, reps: 6, previousKg: 100 },
  ],
  standings: [
    {
      seasonId: "s1",
      meId: "me",
      // Subió de 3° a 1°: pasó a Beto y a Caro.
      rows: [
        { userId: "me", name: "Ana Demo", photoUrl: null, rank: 1, points: 334 },
        { userId: "beto", name: "Beto Demo", photoUrl: null, rank: 2, points: 310 },
        { userId: "caro", name: "Caro Demo", photoUrl: null, rank: 3, points: 295 },
      ],
      passed: ["Beto", "Caro"],
    },
    {
      seasonId: "s2",
      meId: "me",
      rows: [
        { userId: "lu", name: "Lucía", photoUrl: null, rank: 1, points: 180 },
        { userId: "me", name: "Ana Demo", photoUrl: null, rank: 2, points: 146 },
        { userId: "tomi", name: "Tomi", photoUrl: null, rank: 3, points: 90 },
      ],
      passed: [],
    },
  ],
};

const VARIANTS = {
  completo: buildCelebrationSteps(SCORING, BADGES, CELEBRATION),
  "semana a medias": buildCelebrationSteps([{ ...SCORING[1], rankBefore: 2 }], [], { ...CELEBRATION, week: { workouts: 2, goal: 3, justMet: false, perfectStreak: 0 }, records: [], standings: [CELEBRATION.standings[1]] }),
  "sin temporadas": buildCelebrationSteps([], [], { workoutNumber: 1, week: null, records: [], standings: [] }),
};

export function CelebrationSection() {
  const [open, setOpen] = useState<keyof typeof VARIANTS | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      {(Object.keys(VARIANTS) as (keyof typeof VARIANTS)[]).map((k) => (
        <Button key={k} variant="secondary" size="sm" onClick={() => setOpen(k)}>
          Festejo: {k}
        </Button>
      ))}
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
          <div className="mx-auto flex min-h-full w-full max-w-screen-sm flex-col px-4">
            <CelebrationSequence
              steps={VARIANTS[open]}
              summary={{ durationMinutes: 62, exercises: 4, sets: 16, volumeKg: 5400 }}
              sharedDaySeasonIds={[]}
              onDone={() => setOpen(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
