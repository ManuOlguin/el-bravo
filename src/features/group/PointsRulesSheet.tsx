"use client";

import { useState } from "react";
import { Button, Sheet } from "@/src/components/ui";
import { PointsRules } from "@/src/features/season/PointsRules";
import type { SeasonSummary } from "@/src/features/season/types";

/** Botón "¿Cómo se suman los puntos?" + sheet con las reglas de la temporada. */
export function PointsRulesSheet({
  season,
  label = "¿Cómo se suman los puntos?",
}: {
  season: Pick<SeasonSummary, "rules" | "categories" | "awards">;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Cómo se suman los puntos">
        <PointsRules season={season} />
      </Sheet>
    </>
  );
}
