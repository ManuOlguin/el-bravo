import Link from "next/link";
import type { FeedItem } from "@/src/server/social/feed";
import type { UserListItem } from "@/src/features/social/UserList";
import { FriendsFeedList } from "@/src/features/social/FriendsFeedList";
import { FindFriendsEmpty } from "./FindFriendsEmpty";
import { FriendPhotoStories } from "./FriendPhotoStories";

/**
 * Sección "Tus amigos" de la home: carrusel de fotos + feed paginado (`getFriendsFeed`).
 * Si todavía no sigue a nadie, muestra el buscador y sugerencias de sus grupos.
 */
export function FriendsFeed({
  feed,
  photos,
  followingCount,
  suggestions,
  viewer,
  viewerTz,
}: {
  feed: { items: FeedItem[]; nextCursor: string | null };
  photos: FeedItem[];
  followingCount: number;
  suggestions: UserListItem[];
  viewer: { id: string; name: string | null };
  viewerTz: string;
}) {
  return (
    <section aria-labelledby="friends-title" className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="friends-title" className="text-sm font-bold uppercase tracking-wide text-fg-subtle">
          Tus amigos
        </h2>
        {followingCount > 0 && (
          <Link href="/u" className="text-sm font-semibold text-primary hover:underline">
            Buscar personas
          </Link>
        )}
      </div>
      {followingCount === 0 ? (
        <FindFriendsEmpty suggestions={suggestions} />
      ) : (
        <>
          <FriendPhotoStories items={photos} viewer={viewer} viewerTz={viewerTz} />
          <FriendsFeedList initialItems={feed.items} initialCursor={feed.nextCursor} viewer={viewer} viewerTz={viewerTz} />
        </>
      )}
    </section>
  );
}
