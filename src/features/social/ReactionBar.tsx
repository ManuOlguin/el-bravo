"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Sheet, cn, toast } from "@/src/components/ui";
import { toggleReactionAction } from "@/src/server/actions/social";
import type { ActionResult } from "@/src/server/http/result";
import { REACTION_EMOJIS, toggleInSummary, type ReactionEmoji, type ReactionSummary } from "@/src/server/social/reaction-types";

type ToggleFn = (activityId: string, emoji: ReactionEmoji) => Promise<ActionResult<{ summary: ReactionSummary }>>;

const LONG_PRESS_MS = 450;

/**
 * Chips de reacciones de un entrenamiento. Tocar alterna la reacción (optimista; si falla se revierte
 * con un toast). "+" abre el selector de los 5 emojis. Mantener apretado un chip muestra quién reaccionó.
 */
export function ReactionBar({
  activityId,
  initial,
  viewer,
  action = toggleReactionAction,
  className,
}: {
  activityId: string;
  initial: ReactionSummary;
  viewer: { id: string; name: string | null };
  /** Para demos/tests: reemplaza la Server Action. */
  action?: ToggleFn;
  className?: string;
}) {
  const [summary, setSummary] = useState(initial);
  const [optimistic, applyOptimistic] = useOptimistic(summary, (cur: ReactionSummary, emoji: ReactionEmoji) =>
    toggleInSummary(cur, emoji, viewer)
  );
  const [, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [whoEmoji, setWhoEmoji] = useState<ReactionEmoji | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // El selector se cierra al tocar afuera.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [pickerOpen]);

  function toggle(emoji: ReactionEmoji) {
    setPickerOpen(false);
    startTransition(async () => {
      applyOptimistic(emoji);
      const r = await action(activityId, emoji);
      if (r.ok) setSummary(r.data.summary);
      else toast.error(r.error); // al terminar la transición, el estado optimista se descarta solo
    });
  }

  function startPress(emoji: ReactionEmoji) {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setWhoEmoji(emoji);
    }, LONG_PRESS_MS);
  }
  function endPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }

  const who = whoEmoji ? optimistic.find((s) => s.emoji === whoEmoji) : null;

  return (
    <div ref={rootRef} className={cn("relative flex flex-wrap items-center gap-1.5", className)}>
      {optimistic.map((s) => (
        <button
          key={s.emoji}
          type="button"
          aria-pressed={s.mine}
          aria-label={`${s.emoji} ${s.count}${s.mine ? ", reaccionaste" : ""}. Mantené apretado para ver quiénes.`}
          onClick={() => {
            if (longPressed.current) {
              longPressed.current = false;
              return;
            }
            toggle(s.emoji);
          }}
          onPointerDown={() => startPress(s.emoji)}
          onPointerUp={endPress}
          onPointerLeave={endPress}
          onPointerCancel={endPress}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "inline-flex h-8 select-none items-center gap-1 rounded-full border px-2.5 text-sm font-semibold tabular-nums",
            "transition-[transform,background-color] duration-100 active:scale-95 [-webkit-touch-callout:none]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            s.mine ? "border-transparent bg-surface-3 text-fg ring-1 ring-primary" : "border-border bg-surface-2 text-fg-muted hover:bg-surface-3"
          )}
        >
          <span aria-hidden="true">{s.emoji}</span>
          <span>{s.count}</span>
        </button>
      ))}

      <button
        type="button"
        aria-label="Reaccionar"
        aria-expanded={pickerOpen}
        onClick={() => setPickerOpen((o) => !o)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-border text-fg-muted transition-transform duration-100 hover:bg-surface-2 hover:text-fg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {pickerOpen && (
        <div
          role="menu"
          aria-label="Elegí una reacción"
          onKeyDown={(e) => e.key === "Escape" && setPickerOpen(false)}
          className="absolute bottom-full left-0 z-20 mb-2 flex gap-1 whitespace-nowrap rounded-full border border-border bg-surface-1 p-1 shadow-card"
        >
          {REACTION_EMOJIS.map((emoji) => {
            const mine = optimistic.some((s) => s.emoji === emoji && s.mine);
            return (
              <button
                key={emoji}
                type="button"
                role="menuitemcheckbox"
                aria-checked={mine}
                onClick={() => toggle(emoji)}
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl leading-none transition-transform duration-100 hover:scale-110 active:scale-95",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  mine && "bg-surface-3 ring-1 ring-primary"
                )}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      )}

      <Sheet open={!!who} onClose={() => setWhoEmoji(null)} title={who ? `Reaccionaron con ${who.emoji}` : undefined}>
        <ul className="divide-y divide-border">
          {who?.users.map((u) => (
            <li key={u.id}>
              <Link href={`/u/${u.id}`} className="block py-3 font-semibold hover:underline">
                {u.id === viewer.id ? "Vos" : (u.name ?? "Usuario")}
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}
