"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Avatar, Button, Card, CardHeader, EmptyState, Pill, toast } from "@/src/components/ui";
import { formatDateTime, formatDuration } from "@/src/lib/time";
import { ReactionBar } from "@/src/features/social/ReactionBar";
import { loadGroupFeedAction } from "./actions";
import type { GroupFeedItem, GroupFeedPage } from "./data";

function FeedItem({ item, viewer, tz }: { item: GroupFeedItem; viewer: { id: string; name: string | null }; tz: string }) {
  const photo = item.thumbUrl ?? item.photoUrl;
  const isMe = item.user.id === viewer.id;
  return (
    <li className="space-y-2 border-t border-border px-4 py-3 first:border-t-0">
      <header className="flex items-center gap-3">
        <Avatar name={item.user.name} src={item.user.photoUrl} size="md" href={`/u/${item.user.id}`} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            <Link href={`/u/${item.user.id}`} className="font-bold hover:underline">
              {isMe ? "Vos" : (item.user.name ?? "Usuario")}
            </Link>
            <span className="text-fg-muted"> · {item.categoryName}</span>
          </p>
          <p className="truncate text-xs text-fg-subtle">
            {formatDuration(item.durationMinutes)} · {formatDateTime(new Date(item.startedAt), tz)}
          </p>
        </div>
        {item.points !== null && item.points > 0 && <Pill tone="primary">+{item.points} pts</Pill>}
      </header>
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- miniaturas externas (R2), sin optimizador
        <img
          src={photo}
          alt={`Foto del entrenamiento de ${isMe ? "vos" : (item.user.name ?? "un miembro")}`}
          loading="lazy"
          decoding="async"
          className="aspect-[4/3] w-full rounded-xl bg-surface-2 object-cover"
        />
      )}
      <ReactionBar activityId={item.id} initial={item.reactions} viewer={viewer} />
    </li>
  );
}

/** Entrenamientos de los miembros con "+N pts" de la temporada y "Cargar más" (cursor). */
export function ActivityFeed({
  groupId,
  initial,
  viewer,
  tz,
}: {
  groupId: string;
  initial: GroupFeedPage;
  viewer: { id: string; name: string | null };
  tz: string; // zona del viewer para mostrar horas
}) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [pending, start] = useTransition();

  function loadMore() {
    start(async () => {
      const r = await loadGroupFeedAction(groupId, cursor);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...r.data.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(r.data.nextCursor);
    });
  }

  return (
    <Card className="px-0 pb-2">
      <div className="px-4">
        <CardHeader title="Actividad del grupo" />
      </div>
      {items.length === 0 ? (
        <div className="px-4 pb-2">
          <EmptyState title="Nadie entrenó todavía" description="Cuando alguien del grupo registre un entrenamiento, aparece acá." className="py-6" />
        </div>
      ) : (
        <ul>
          {items.map((item) => (
            <FeedItem key={item.id} item={item} viewer={viewer} tz={tz} />
          ))}
        </ul>
      )}
      {cursor && (
        <div className="px-4 pt-2">
          <Button variant="secondary" fullWidth pending={pending} onClick={loadMore}>
            Cargar más
          </Button>
        </div>
      )}
    </Card>
  );
}
