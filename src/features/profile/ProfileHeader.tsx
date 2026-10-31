import Link from "next/link";
import { Avatar, LinkButton, Pill } from "@/src/components/ui";
import { formatDate } from "@/src/lib/time";
import type { PublicProfile } from "@/src/server/social/profile";
import { FollowButton } from "@/src/features/social/FollowButton";

/** Avatar, nombre, bio, contadores y acción principal (editar si es el dueño; seguir si no). */
export function ProfileHeader({ profile, isOwner, viewerTz }: { profile: PublicProfile; isOwner: boolean; viewerTz: string }) {
  const { user, counts, relation } = profile;
  return (
    <header className="flex flex-col items-center gap-3 pt-2 text-center">
      <Avatar name={user.name} src={user.photoUrl} size="xl" />
      <div className="min-w-0 max-w-full">
        <h1 className="text-2xl font-extrabold leading-tight break-words">{user.name ?? "Usuario"}</h1>
        {!isOwner && relation.followsMe && !relation.isFriend && <Pill className="mt-1">Te sigue</Pill>}
        {user.bio && <p className="mt-2 text-sm text-fg-muted break-words">{user.bio}</p>}
        <p className="mt-1 text-xs text-fg-subtle">En El Bravo desde {formatDate(user.createdAt, viewerTz, "long")}</p>
      </div>

      <nav aria-label="Contadores" className="flex flex-wrap items-center justify-center gap-x-2 text-sm text-fg-muted">
        <Link href={`/u/${user.id}/followers`} className="rounded-md px-1 hover:text-fg">
          <strong className="text-fg tabular-nums">{counts.followers}</strong> {counts.followers === 1 ? "seguidor" : "seguidores"}
        </Link>
        <span aria-hidden="true">·</span>
        <Link href={`/u/${user.id}/following`} className="rounded-md px-1 hover:text-fg">
          <strong className="text-fg tabular-nums">{counts.following}</strong> {counts.following === 1 ? "seguido" : "seguidos"}
        </Link>
      </nav>

      <div className="flex w-full max-w-xs gap-2">
        {isOwner ? (
          <>
            <LinkButton href="/settings/profile" variant="secondary" fullWidth>
              Editar perfil
            </LinkButton>
            <LinkButton href="/u" variant="secondary" fullWidth>
              Buscar personas
            </LinkButton>
          </>
        ) : (
          <FollowButton userId={user.id} userName={user.name} isFollowing={relation.isFollowing} followsMe={relation.followsMe} fullWidth />
        )}
      </div>
    </header>
  );
}
