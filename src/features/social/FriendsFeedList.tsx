"use client";

import { useState, useTransition } from "react";
import { Button, EmptyState, LinkButton, toast } from "@/src/components/ui";
import { loadFriendsFeedAction } from "@/src/server/actions/social";
import type { FeedItem } from "@/src/server/social/feed";
import { FriendActivityCard } from "./FriendActivityCard";

/** Lista paginada del feed de amigos ("Ver más" con cursor). W2-4 la puede usar en la home. */
export function FriendsFeedList({
  initialItems,
  initialCursor,
  viewer,
  viewerTz,
}: {
  initialItems: FeedItem[];
  initialCursor: string | null;
  viewer: { id: string; name: string | null };
  viewerTz: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    startTransition(async () => {
      const r = await loadFriendsFeedAction(cursor);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.activityId));
        return [...prev, ...r.data.items.filter((i) => !seen.has(i.activityId))];
      });
      setCursor(r.data.nextCursor);
    });
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Seguí a tus amigos para ver sus entrenamientos"
        action={
          <LinkButton href="/u" variant="secondary">
            Buscar personas
          </LinkButton>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {items.map((item) => (
          <FriendActivityCard key={item.activityId} item={item} viewer={viewer} viewerTz={viewerTz} />
        ))}
      </ul>
      {cursor && (
        <Button variant="secondary" fullWidth pending={pending} onClick={loadMore}>
          Ver más
        </Button>
      )}
    </div>
  );
}
