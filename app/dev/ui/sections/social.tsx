"use client";

import { FriendActivityCard } from "@/src/features/social/FriendActivityCard";
import { ReactionBar } from "@/src/features/social/ReactionBar";
import type { FeedItem } from "@/src/server/social/feed";
import { toggleInSummary, type ReactionEmoji, type ReactionSummary } from "@/src/server/social/reaction-types";
import type { ActionResult } from "@/src/server/http/result";

// Datos de ejemplo para /dev/ui (W1-4). Las reacciones se simulan en memoria, sin servidor.
const viewer = { id: "me", name: "Manu" };

const store = new Map<string, ReactionSummary>();
function fakeToggle(fail = false) {
  return async (activityId: string, emoji: ReactionEmoji): Promise<ActionResult<{ summary: ReactionSummary }>> => {
    await new Promise((r) => setTimeout(r, 600));
    if (fail) return { ok: false, error: "No pudimos guardar la reacción (simulado)." };
    const next = toggleInSummary(store.get(activityId) ?? [], emoji, viewer);
    store.set(activityId, next);
    return { ok: true, data: { summary: next } };
  };
}

const sampleReactions: ReactionSummary = [
  { emoji: "💪", count: 3, mine: true, users: [viewer, { id: "u2", name: "Leo" }, { id: "u3", name: "Caro" }] },
  { emoji: "🔥", count: 1, mine: false, users: [{ id: "u2", name: "Leo" }] },
];

const items: FeedItem[] = [
  {
    activityId: "demo-1",
    user: { id: "u2", name: "Leo Melman", photoUrl: null },
    categoryName: "Fuerza",
    startedAt: new Date("2026-10-31T21:30:00Z"),
    durationMinutes: 75,
    thumbUrl: null,
    photoUrl: null,
    reactions: sampleReactions,
  },
  {
    activityId: "demo-2",
    user: { id: "me", name: "Manu", photoUrl: null },
    categoryName: "Running",
    startedAt: new Date("2026-10-30T10:05:00Z"),
    durationMinutes: 42,
    thumbUrl: null,
    photoUrl: null,
    reactions: [],
  },
];
for (const i of items) store.set(i.activityId, i.reactions);

export function SocialSection({ Section }: { Section: (p: { title: string; children: React.ReactNode }) => React.ReactNode }) {
  return (
    <Section title="Social (W1-4)">
      <div className="space-y-2">
        <p className="text-xs text-fg-subtle">ReactionBar (tocá, “+”, o mantené apretado un chip)</p>
        <ReactionBar activityId="demo-bar" initial={sampleReactions} viewer={viewer} action={fakeToggle()} />
        <p className="text-xs text-fg-subtle">ReactionBar con error simulado (se revierte con toast)</p>
        <ReactionBar activityId="demo-fail" initial={[]} viewer={viewer} action={fakeToggle(true)} />
      </div>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <FriendActivityCard
            key={item.activityId}
            item={item}
            viewer={viewer}
            viewerTz="America/Argentina/Buenos_Aires"
            points={i === 0 ? 31 : null}
            reactionAction={fakeToggle()}
          />
        ))}
      </ul>
    </Section>
  );
}
