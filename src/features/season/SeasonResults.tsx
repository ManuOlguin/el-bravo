"use client";

import { useEffect, useState } from "react";
import { Button, Card, Skeleton } from "@/src/components/ui";
import type { StandingRow } from "@/src/server/scoring/types";
import { AwardCard, AwardsShowcase } from "./AwardsShowcase";
import { FinalStandingsTable } from "./FinalStandingsTable";
import { Podium } from "./Podium";
import { MyNumbersCard, SeasonStats } from "./SeasonStats";
import type { MyNumbers, SeasonAwardView, SeasonStats as Stats } from "./data";

export const revealKey = (seasonId: string) => `season-revealed:${seasonId}`;

function readRevealed(seasonId: string) {
  try {
    return window.localStorage.getItem(revealKey(seasonId)) === "1";
  } catch {
    return true; // sin storage (modo privado): no insistir con el reveal
  }
}
function markRevealed(seasonId: string) {
  try {
    window.localStorage.setItem(revealKey(seasonId), "1");
  } catch {
    /* sin storage: no pasa nada */
  }
}

/**
 * Vista "reveal" (primera vez que abrís una temporada publicada): los premios se revelan uno por uno
 * al tocar y al final el podio. Se puede saltear.
 */
function Reveal({
  seasonName,
  awards,
  standings,
  viewerId,
  onDone,
}: {
  seasonName: string;
  awards: SeasonAwardView[];
  standings: StandingRow[];
  viewerId: string;
  onDone(): void;
}) {
  const [step, setStep] = useState(0); // 0..awards.length-1 = premios; awards.length = podio
  const onPodium = step >= awards.length;
  const award = awards[step];

  return (
    <div className="flex min-h-[60dvh] flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {onPodium ? "Y el podio es…" : `Premio ${step + 1} de ${awards.length}`}
        </p>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Saltear
        </Button>
      </div>
      <h2 className="sr-only">Resultados de {seasonName}</h2>
      <button
        type="button"
        onClick={() => (onPodium ? onDone() : setStep((s) => s + 1))}
        className="flex flex-1 flex-col justify-center gap-4 rounded-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={onPodium ? "Ver todos los resultados" : "Revelar el siguiente"}
      >
        <span key={step} className="block animate-modal-in">
          {onPodium ? (
            <Podium standings={standings} viewerId={viewerId} links={false} />
          ) : (
            award && <AwardCard award={award} viewerId={viewerId} className="py-6" links={false} />
          )}
        </span>
        <span className="block text-center text-sm text-fg-muted">{onPodium ? "Tocá para ver todo" : "Tocá para seguir"}</span>
      </button>
    </div>
  );
}

/** Resultados de una temporada finalizada y publicada: podio, premios, tabla final, stats y tus números. */
export function SeasonResults({
  seasonId,
  seasonName,
  standings,
  awards,
  stats,
  me,
  viewerId,
  reveal = true,
}: {
  seasonId: string;
  seasonName: string;
  standings: StandingRow[];
  awards: SeasonAwardView[];
  stats: Stats | null;
  me: MyNumbers | null;
  viewerId: string;
  /** false = vista previa (admin), sin reveal ni localStorage. */
  reveal?: boolean;
}) {
  const [mode, setMode] = useState<"loading" | "reveal" | "done">(reveal ? "loading" : "done");
  useEffect(() => {
    if (!reveal) return;
    // localStorage solo existe en el cliente: se decide después de montar.
    setMode(readRevealed(seasonId) ? "done" : "reveal"); // eslint-disable-line react-hooks/set-state-in-effect -- lectura única de localStorage al montar
  }, [reveal, seasonId]);

  if (mode === "loading") return <Skeleton className="h-96 w-full rounded-card" />;
  if (mode === "reveal") {
    return (
      <Reveal
        seasonName={seasonName}
        awards={awards.filter((a) => a.winners.length > 0)}
        standings={standings}
        viewerId={viewerId}
        onDone={() => {
          markRevealed(seasonId);
          setMode("done");
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card className="pt-6">
        <Podium standings={standings} viewerId={viewerId} animate={reveal} />
      </Card>
      {me && <MyNumbersCard me={me} participants={standings.length} />}
      <AwardsShowcase awards={awards} viewerId={viewerId} />
      <FinalStandingsTable standings={standings} viewerId={viewerId} />
      {stats && <SeasonStats stats={stats} />}
    </div>
  );
}
