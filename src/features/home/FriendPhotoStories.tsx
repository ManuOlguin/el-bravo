"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, Sheet } from "@/src/components/ui";
import { formatDateTime, formatDuration } from "@/src/lib/time";
import type { FeedItem } from "@/src/server/social/feed";
import { ReactionBar } from "@/src/features/social/ReactionBar";

/** Carrusel tipo historias con las últimas actividades CON FOTO de amigos. Tocar abre el detalle con reacciones. */
export function FriendPhotoStories({ items, viewer, viewerTz }: { items: FeedItem[]; viewer: { id: string; name: string | null }; viewerTz: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = items.find((i) => i.activityId === openId) ?? null;
  if (items.length === 0) return null;

  return (
    <>
      <ul className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 py-1" aria-label="Fotos de tus amigos">
        {items.map((item) => (
          <li key={item.activityId} className="w-24 shrink-0 snap-start">
            <button
              type="button"
              onClick={() => setOpenId(item.activityId)}
              aria-label={`Ver el entrenamiento de ${item.user.name ?? "un amigo"}: ${item.categoryName}`}
              className="group block w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="relative block aspect-[3/4] overflow-hidden rounded-2xl bg-surface-2 ring-2 ring-primary ring-offset-2 ring-offset-bg">
                {/* eslint-disable-next-line @next/next/no-img-element -- miniaturas externas (R2) */}
                <img
                  src={item.thumbUrl ?? item.photoUrl ?? ""}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-200 group-active:scale-95"
                />
                <span className="absolute bottom-1 left-1">
                  <Avatar name={item.user.name} src={item.user.photoUrl} size="xs" />
                </span>
              </span>
              <span className="mt-1.5 block truncate text-xs font-semibold">{item.user.name ?? "Usuario"}</span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={open !== null} onClose={() => setOpenId(null)} title={open ? (open.user.name ?? "Entrenamiento") : undefined}>
        {open && (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- fotos externas (R2) */}
            <img
              src={open.photoUrl ?? open.thumbUrl ?? ""}
              alt={`Foto del entrenamiento de ${open.user.name ?? "un amigo"}`}
              className="max-h-[55dvh] w-full rounded-xl bg-surface-2 object-contain"
            />
            <div className="flex items-center gap-3">
              <Avatar name={open.user.name} src={open.user.photoUrl} size="md" href={`/u/${open.user.id}`} />
              <div className="min-w-0 flex-1">
                <Link href={`/u/${open.user.id}`} className="block truncate font-bold hover:underline">
                  {open.user.name ?? "Usuario"}
                </Link>
                <p className="truncate text-sm text-fg-muted">
                  {open.categoryName} · {formatDuration(open.durationMinutes)} · {formatDateTime(open.startedAt, viewerTz)}
                </p>
              </div>
            </div>
            <ReactionBar key={open.activityId} activityId={open.activityId} initial={open.reactions} viewer={viewer} />
          </div>
        )}
      </Sheet>
    </>
  );
}
