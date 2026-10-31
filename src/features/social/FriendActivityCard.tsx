import Link from "next/link";
import { Avatar, Card, Pill } from "@/src/components/ui";
import { formatDateTime, formatDuration } from "@/src/lib/time";
import type { FeedItem } from "@/src/server/social/feed";
import { ReactionBar } from "./ReactionBar";

/**
 * Tarjeta del feed de amigos: avatar, nombre, actividad, duración, foto (miniatura), puntos si
 * comparten temporada (`points`, de `getActivityPoints` de W1-1) y reacciones.
 */
export function FriendActivityCard({
  item,
  viewer,
  viewerTz,
  points,
  reactionAction,
}: {
  item: FeedItem;
  viewer: { id: string; name: string | null };
  viewerTz: string;
  points?: number | null;
  /** Solo para demos (/dev/ui): reemplaza la Server Action de reacciones. */
  reactionAction?: React.ComponentProps<typeof ReactionBar>["action"];
}) {
  const photo = item.thumbUrl ?? item.photoUrl;
  const isMe = item.user.id === viewer.id;
  return (
    <Card as="li" className="space-y-3">
      <header className="flex items-center gap-3">
        <Avatar name={item.user.name} src={item.user.photoUrl} size="md" href={`/u/${item.user.id}`} />
        <div className="min-w-0 flex-1">
          <Link href={`/u/${item.user.id}`} className="block truncate font-bold hover:underline">
            {isMe ? "Vos" : (item.user.name ?? "Usuario")}
          </Link>
          <p className="truncate text-xs text-fg-subtle">{formatDateTime(item.startedAt, viewerTz)}</p>
        </div>
        {typeof points === "number" && points > 0 && <Pill tone="primary">+{points} pts</Pill>}
      </header>

      <p className="text-sm">
        <span className="font-semibold">{item.categoryName}</span>
        <span className="text-fg-muted"> · {formatDuration(item.durationMinutes)}</span>
      </p>

      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- miniaturas externas (R2), sin optimizador
        <img src={photo} alt={`Foto del entrenamiento de ${item.user.name ?? "un amigo"}`} loading="lazy" decoding="async" className="aspect-[4/3] w-full rounded-xl bg-surface-2 object-cover" />
      )}

      <ReactionBar activityId={item.activityId} initial={item.reactions} viewer={viewer} action={reactionAction} />
    </Card>
  );
}
