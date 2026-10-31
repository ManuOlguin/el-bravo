"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Avatar, Button, cn } from "@/src/components/ui";
import { BadgeMedallion, BadgeTitle } from "@/src/features/badges";
import { romanLevel } from "@/src/features/badges/levels";
import { formatDuration } from "@/src/lib/time";
import { climbed, orderBefore, pointsGained, type CelebrationStep } from "./celebration";
import { displayReason, formatKg, formatVolume } from "./format";
import { CheckIcon } from "./icons";
import type { BadgeChange } from "@/src/server/badges/types";
import type { ScoringEffect } from "@/src/server/scoring/types";
import type { SeasonStandingWindow } from "./types";
import type { WorkoutSummaryNumbers } from "./WorkoutResult";

/* ───────────────────────── utilidades de animación ───────────────────────── */

const REDUCED = "(prefers-reduced-motion: reduce)";
function subscribeReduced(cb: () => void) {
  const m = window.matchMedia(REDUCED);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
function useReducedMotion() {
  return useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false
  );
}

/** Número que sube de `from` a `to` (ease-out). Con movimiento reducido muestra el final directo. */
function useCountUp(to: number, { from = 0, duration = 900, delay = 0 } = {}) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let start: number | null = null;
    const tick = (t: number) => {
      start ??= t + delay;
      const p = Math.min(1, Math.max(0, (t - start) / duration));
      setValue(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, from, duration, delay, reduced]);
  return reduced ? to : value;
}

function CountUp({ to, from, delay, className }: { to: number; from?: number; delay?: number; className?: string }) {
  const v = useCountUp(to, { from, delay });
  return <span className={cn("tabular-nums", className)}>{v}</span>;
}

const CONFETTI_COLORS = ["bg-primary", "bg-gold", "bg-fg", "bg-primary-strong", "bg-silver"];

/** Papelitos que caen desde arriba. Posiciones deterministas (por índice) para que el render sea puro. */
function Confetti({ pieces = 48 }: { pieces?: number }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-10 overflow-hidden">
      {Array.from({ length: pieces }, (_, i) => (
        <span
          key={i}
          className={cn("absolute -top-4 block animate-confetti rounded-[2px]", CONFETTI_COLORS[i % CONFETTI_COLORS.length], i % 3 === 0 ? "h-2 w-2" : "h-3 w-1.5")}
          style={
            {
              left: `${(i * 37) % 100}%`,
              animationDelay: `${(i % 12) * 55}ms`,
              animationDuration: `${2 + ((i * 7) % 10) / 10}s`,
              "--cx": `${((i * 53) % 30) - 15}vw`,
              "--cr": `${((i * 97) % 720) - 360}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** Entrada escalonada: cada hijo aparece `i × 120 ms` después. */
function Rise({ i = 0, className, children }: { i?: number; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("animate-rise-in motion-reduce:animate-none", className)} style={{ animationDelay: `${150 + i * 120}ms` }}>
      {children}
    </div>
  );
}

/** Ícono grande con un anillo que se expande detrás. */
function Hero({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "gold" }) {
  return (
    <div className="relative grid place-items-center">
      <span
        aria-hidden="true"
        className={cn(
          "absolute h-32 w-32 animate-ring-burst rounded-full border-4 motion-reduce:hidden",
          tone === "gold" ? "border-gold" : "border-primary"
        )}
      />
      <div
        className={cn(
          "grid h-28 w-28 animate-pop-in place-items-center rounded-full text-5xl motion-reduce:animate-none",
          tone === "gold" ? "bg-gold/15 text-gold" : "bg-primary-gradient text-on-primary"
        )}
      >
        {children}
      </div>
    </div>
  );
}

function Title({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Rise className="space-y-2 text-center">
      <h2 className="text-3xl font-extrabold leading-tight">{children}</h2>
      {sub && <p className="text-base text-fg-muted">{sub}</p>}
    </Rise>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Lista natural: "Beto", "Beto y Caro", "Beto, Caro y Dani". */
function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/* ───────────────────────── pantallas ───────────────────────── */

function CompleteStep({ step, summary }: { step: Extract<CelebrationStep, { kind: "complete" }>; summary: WorkoutSummaryNumbers }) {
  const chips = [
    { label: "Duración", value: formatDuration(summary.durationMinutes) },
    summary.exercises > 0 && { label: "Ejercicios", value: String(summary.exercises) },
    summary.sets > 0 && { label: "Series", value: String(summary.sets) },
    summary.volumeKg > 0 && { label: "Volumen", value: formatVolume(summary.volumeKg) },
  ].filter(Boolean) as { label: string; value: string }[];
  return (
    <>
      <Hero>
        <CheckIcon size={56} />
      </Hero>
      <Title sub={step.workoutNumber ? `Tu entrenamiento número ${step.workoutNumber}` : undefined}>¡Entrenamiento completo!</Title>
      {step.totalPoints > 0 ? (
        <Rise i={1} className="text-center">
          <p className="text-6xl font-extrabold text-primary">
            +<CountUp to={step.totalPoints} delay={350} />
          </p>
          <p className="text-sm font-semibold uppercase tracking-wide text-fg-muted">puntos</p>
        </Rise>
      ) : (
        <Rise i={1}>
          <p className="max-w-xs text-center text-sm text-fg-muted">No suma en ninguna temporada activa, pero cuenta para tus stats y tus rachas.</p>
        </Rise>
      )}
      <Rise i={2} className="flex flex-wrap justify-center gap-2">
        {chips.map((c) => (
          <span key={c.label} className="rounded-full border border-border bg-surface-1 px-3 py-1.5 text-sm">
            <span className="font-bold tabular-nums">{c.value}</span> <span className="text-fg-muted">{c.label.toLowerCase()}</span>
          </span>
        ))}
      </Rise>
    </>
  );
}

const ROW_H = 52; // px por fila de la mini tabla
const MOVE_DELAY = 900; // ms antes de que la fila del usuario suba

/**
 * Mini tabla de la temporada: el usuario y sus vecinos. Arranca en el orden de ANTES del entrenamiento
 * y, si subió, su fila se desliza hacia arriba pasando a los que superó (los demás bajan un lugar).
 */
function MiniStandings({ effect, standings, delay }: { effect: ScoringEffect; standings: SeasonStandingWindow; delay: number }) {
  const reduced = useReducedMotion();
  const { rows, meId } = standings;
  const before = orderBefore(rows, meId, effect.totalBefore);
  const after = rows.map((r) => r.userId);
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMoved(true), delay + MOVE_DELAY);
    return () => clearTimeout(t);
  }, [delay]);
  const showAfter = moved || reduced;
  const order = showAfter ? after : before;
  const meBefore = before.indexOf(meId);
  const meAfter = after.indexOf(meId);

  return (
    <ol className="relative" style={{ height: rows.length * ROW_H }} aria-label={`Ranking de ${effect.seasonName}`}>
      {rows.map((r) => {
        const me = r.userId === meId;
        // Los que el usuario pasó estaban arriba suyo y ahora están abajo: antes tenían un puesto menos.
        const wasPassed = !me && before.indexOf(r.userId) < meBefore && after.indexOf(r.userId) > meAfter;
        const rank = showAfter ? r.rank : me ? (effect.rankBefore ?? r.rank) : wasPassed ? r.rank - 1 : r.rank;
        return (
          <li
            key={r.userId}
            aria-current={me ? "true" : undefined}
            className={cn(
              "absolute inset-x-0 flex items-center gap-3 px-4 transition-transform duration-700 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
              me ? "z-10 rounded-xl bg-surface-2 ring-2 ring-primary" : "z-0"
            )}
            style={{ height: ROW_H, transform: `translateY(${order.indexOf(r.userId) * ROW_H}px)` }}
          >
            <span className={cn("w-7 text-right text-sm font-extrabold tabular-nums", me ? "text-primary" : "text-fg-subtle")}>#{rank}</span>
            <Avatar name={r.name} src={r.photoUrl} size="sm" />
            <span className={cn("min-w-0 flex-1 truncate text-sm", me ? "font-extrabold" : "font-semibold text-fg-muted")}>{me ? "Vos" : r.name ?? "Sin nombre"}</span>
            {me ? (
              <CountUp to={effect.totalAfter} from={effect.totalBefore} delay={delay + 400} className="text-sm font-extrabold" />
            ) : (
              <span className="text-sm tabular-nums text-fg-muted">{r.points}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function PointsStep({ step, sharedDaySeasonIds }: { step: Extract<CelebrationStep, { kind: "points" }>; sharedDaySeasonIds: string[] }) {
  const anyClimb = step.seasons.some((s) => climbed(s.effect));
  return (
    <>
      {anyClimb && <Confetti />}
      <Title sub={step.seasons.length > 1 ? `En ${step.seasons.length} temporadas` : undefined}>Sumaste puntos</Title>
      <div className="w-full max-w-sm space-y-3">
        {step.seasons.map(({ effect: e, standings }, i) => {
          const reason = displayReason(e.activityReason) ?? (sharedDaySeasonIds.includes(e.seasonId) ? "Se sumó al tiempo de tu día" : null);
          const delay = 300 + i * 500;
          const up = climbed(e) ? e.rankBefore! - e.rankAfter : 0;
          return (
            <Rise key={e.seasonId} i={i + 1} className="overflow-hidden rounded-card border border-border bg-surface-1">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{e.seasonName}</p>
                  <p className="truncate text-xs text-fg-subtle">{e.groupName}</p>
                </div>
                <p className="shrink-0 animate-pop-in text-3xl font-extrabold text-primary motion-reduce:animate-none" style={{ animationDelay: `${delay}ms` }}>
                  +{pointsGained(e)}
                </p>
              </div>
              {standings && standings.rows.length > 0 ? (
                <div className="space-y-2 py-2">
                  <MiniStandings effect={e} standings={standings} delay={delay} />
                  {up > 0 && (
                    <p
                      className="animate-pop-in px-4 text-center text-sm motion-reduce:animate-none"
                      style={{ animationDelay: `${delay + MOVE_DELAY + 500}ms` }}
                    >
                      <span className="font-extrabold text-primary">▲ Subiste {plural(up, "puesto", "puestos")}</span>
                      {standings.passed.length > 0 && (
                        <span className="text-fg-muted">
                          {" "}
                          · pasaste a <strong className="text-fg">{joinNames(standings.passed)}</strong>
                        </span>
                      )}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <span className="text-fg-muted">Total</span>
                  <span className="text-fg-muted">
                    {e.totalBefore} → <CountUp to={e.totalAfter} from={e.totalBefore} delay={delay + 200} className="text-lg font-extrabold text-fg" />
                  </span>
                </div>
              )}
              {reason && <p className="border-t border-border px-4 py-2 text-xs text-fg-muted">{reason}</p>}
            </Rise>
          );
        })}
      </div>
    </>
  );
}

function WeekStep({ step }: { step: Extract<CelebrationStep, { kind: "week" }> }) {
  const missing = Math.max(0, step.goal - step.workouts);
  const dots = Math.max(step.goal, step.workouts);
  return (
    <>
      {step.justMet && <Confetti />}
      <div className="flex flex-wrap justify-center gap-3" aria-label={`${step.workouts} de ${step.goal} entrenamientos esta semana`}>
        {Array.from({ length: dots }, (_, i) => {
          const filled = i < step.workouts;
          const extra = i >= step.goal; // por encima del objetivo: dorado
          const isNew = i === step.workouts - 1;
          return (
            <span
              key={i}
              aria-hidden="true"
              className={cn(
                "grid h-14 w-14 place-items-center rounded-full border-2",
                !filled ? "border-border bg-surface-1" : extra ? "border-gold bg-gold/20 text-gold" : "border-primary bg-primary-gradient text-on-primary",
                filled && "animate-pop-in motion-reduce:animate-none",
                isNew && "animate-glow"
              )}
              style={filled ? { animationDelay: `${200 + i * 160}ms` } : undefined}
            >
              {filled && <CheckIcon size={24} />}
            </span>
          );
        })}
      </div>
      <Title
        sub={
          step.justMet
            ? step.perfectStreak > 1
              ? `🔥 ${plural(step.perfectStreak, "semana perfecta", "semanas perfectas")} seguidas`
              : "Cumpliste tu objetivo de la semana"
            : step.workouts > step.goal
              ? `${plural(step.workouts - step.goal, "entrenamiento extra", "entrenamientos extra")} por encima de tu objetivo 💪`
              : `Te ${missing === 1 ? "falta 1" : `faltan ${missing}`} para cumplir el objetivo`
        }
      >
        {step.justMet ? "¡Semana cumplida!" : step.workouts > step.goal ? `¡${step.workouts} esta semana!` : `${step.workouts} de ${step.goal} esta semana`}
      </Title>
    </>
  );
}

function RecordsStep({ step }: { step: Extract<CelebrationStep, { kind: "records" }> }) {
  return (
    <>
      <Confetti pieces={32} />
      <Hero tone="gold">🏆</Hero>
      <Title>{step.records.length === 1 ? "¡Nuevo récord!" : `¡${step.records.length} récords nuevos!`}</Title>
      <div className="w-full max-w-sm divide-y divide-border overflow-hidden rounded-card border border-border bg-surface-1">
        {step.records.map((r, i) => (
          <Rise key={r.exerciseId} i={i + 1} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-bold">{r.exerciseName}</p>
              <p className="text-xs text-fg-subtle">antes: {formatKg(r.previousKg)} kg</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-extrabold tabular-nums">
                {formatKg(r.weightKg)} kg{r.reps ? <span className="text-sm font-semibold text-fg-muted"> × {r.reps}</span> : null}
              </p>
              <p className="text-xs font-bold text-gold">+{formatKg(r.weightKg - r.previousKg)} kg</p>
            </div>
          </Rise>
        ))}
      </div>
    </>
  );
}

function BadgeProgressRow({ c, i }: { c: BadgeChange; i: number }) {
  const target = c.nextThreshold ?? c.progressAfter;
  const [pct, setPct] = useState(Math.min(100, (c.progressBefore / target) * 100));
  // La barra arranca en el valor anterior y se llena hasta el nuevo.
  useEffect(() => {
    const t = setTimeout(() => setPct(Math.min(100, (c.progressAfter / target) * 100)), 450 + i * 150);
    return () => clearTimeout(t);
  }, [c.progressAfter, target, i]);
  const missing = target - c.progressAfter;
  return (
    <Rise i={i + 1} className="flex items-center gap-3 px-4 py-3">
      <BadgeMedallion size={48} badge={{ iconKey: c.iconKey, level: c.levelAfter, progress: c.progressAfter, nextThreshold: c.nextThreshold }} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <BadgeTitle name={c.name} level={c.levelAfter} className="truncate text-sm font-bold" />
          <span className="shrink-0 text-xs tabular-nums text-fg-muted">
            <span className="font-bold text-primary">+{c.progressAfter - c.progressBefore}</span> · {c.progressAfter}/{target}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-primary-gradient-x transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-fg-subtle">
          {missing <= 0 ? "¡Listo para subir!" : `Te ${missing === 1 ? "falta 1" : `faltan ${missing}`} para ${c.levelAfter > 0 ? `el nivel ${romanLevel(c.levelAfter + 1)}` : "desbloquearla"}`}
        </p>
      </div>
    </Rise>
  );
}

function BadgeProgressStep({ step }: { step: Extract<CelebrationStep, { kind: "badgeProgress" }> }) {
  return (
    <>
      <Title sub="Así avanzaron tus insignias">Cada vez más cerca</Title>
      <div className="w-full max-w-sm divide-y divide-border overflow-hidden rounded-card border border-border bg-surface-1">
        {step.changes.map((c, i) => (
          <BadgeProgressRow key={c.code} c={c} i={i} />
        ))}
      </div>
    </>
  );
}

function BadgeStep({ step }: { step: Extract<CelebrationStep, { kind: "badge" }> }) {
  const c = step.change;
  return (
    <>
      <Confetti />
      <div className="relative grid place-items-center">
        <span aria-hidden="true" className="absolute h-40 w-40 animate-ring-burst rounded-full border-4 border-gold motion-reduce:hidden" />
        <div className="animate-pop-in rounded-full motion-reduce:animate-none">
          <span className="block animate-glow rounded-full">
            <BadgeMedallion size={136} badge={{ iconKey: c.iconKey, level: c.levelAfter, progress: c.progressAfter, nextThreshold: c.nextThreshold }} />
          </span>
        </div>
      </div>
      <Rise className="space-y-2 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-gold">{c.levelBefore > 0 ? "¡Subiste de nivel!" : "¡Insignia nueva!"}</p>
        <h2 className="text-3xl font-extrabold leading-tight">
          <BadgeTitle name={c.name} level={c.levelAfter} />
        </h2>
        {c.levelBefore > 0 && (
          <p className="text-base text-fg-muted">
            De {romanLevel(c.levelBefore)} a {romanLevel(c.levelAfter)}
          </p>
        )}
      </Rise>
    </>
  );
}

/* ───────────────────────── secuencia ───────────────────────── */

const MILESTONES = new Set<CelebrationStep["kind"]>(["records", "badge"]);

/**
 * Festejo post-entrenamiento: una pantalla completa por logro, de a una, con "Continuar".
 * "Saltar" va directo al resumen (`onDone`). Vibra en los hitos (subir de puesto, semana cumplida, récord, insignia).
 */
export function CelebrationSequence({
  steps,
  summary,
  sharedDaySeasonIds,
  onDone,
}: {
  steps: CelebrationStep[];
  summary: WorkoutSummaryNumbers;
  sharedDaySeasonIds: string[];
  onDone(): void;
}) {
  const [index, setIndex] = useState(0);
  const continueRef = useRef<HTMLButtonElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  useEffect(() => {
    continueRef.current?.focus();
    const milestone =
      MILESTONES.has(step.kind) ||
      (step.kind === "week" && step.justMet) ||
      (step.kind === "points" && step.seasons.some((x) => climbed(x.effect)));
    if (milestone) navigator.vibrate?.([30, 60, 30]);
  }, [step]);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 py-3">
        <ol className="flex flex-1 gap-1" aria-label={`Paso ${index + 1} de ${steps.length}`}>
          {steps.map((s, i) => (
            <li key={i} aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <span className={cn("block h-full rounded-full bg-primary-gradient-x transition-[width] duration-500", i <= index ? "w-full" : "w-0")} />
            </li>
          ))}
        </ol>
        {!last && (
          <button type="button" onClick={onDone} className="rounded-lg px-2 py-1 text-sm font-semibold text-fg-muted hover:text-fg">
            Saltar
          </button>
        )}
      </div>

      {/* `key` reinicia las animaciones en cada pantalla. */}
      <section key={index} aria-live="polite" className="flex flex-1 flex-col items-center justify-center gap-6 py-6">
        {step.kind === "complete" && <CompleteStep step={step} summary={summary} />}
        {step.kind === "points" && <PointsStep step={step} sharedDaySeasonIds={sharedDaySeasonIds} />}
        {step.kind === "week" && <WeekStep step={step} />}
        {step.kind === "records" && <RecordsStep step={step} />}
        {step.kind === "badgeProgress" && <BadgeProgressStep step={step} />}
        {step.kind === "badge" && <BadgeStep step={step} />}
      </section>

      <div className="pb-4 pt-2">
        <Button ref={continueRef} size="lg" fullWidth onClick={() => (last ? onDone() : setIndex(index + 1))}>
          {last ? "Ver resumen" : "Continuar"}
        </Button>
      </div>
    </div>
  );
}
