import { Avatar, EmptyState } from "@/src/components/ui";
import Link from "next/link";
import { FollowButton } from "./FollowButton";

export type UserListItem = {
  id: string;
  name: string | null;
  photoUrl: string | null;
  relation: { isFollowing: boolean; followsMe: boolean } | null; // null = es el viewer
};

/** Lista de personas con link al perfil y botón de seguir (seguidores, seguidos, sugerencias). */
export function UserList({ users, emptyTitle }: { users: UserListItem[]; emptyTitle: string }) {
  if (users.length === 0) return <EmptyState title={emptyTitle} />;
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface-1">
      {users.map((u) => (
        <li key={u.id} className="flex items-center gap-3 px-4 py-3">
          <Avatar name={u.name} src={u.photoUrl} size="md" href={`/u/${u.id}`} />
          <Link href={`/u/${u.id}`} className="min-w-0 flex-1 truncate font-semibold hover:underline">
            {u.name ?? "Usuario"}
          </Link>
          {u.relation && (
            <FollowButton
              userId={u.id}
              userName={u.name}
              isFollowing={u.relation.isFollowing}
              followsMe={u.relation.followsMe}
              size="sm"
            />
          )}
        </li>
      ))}
    </ul>
  );
}
