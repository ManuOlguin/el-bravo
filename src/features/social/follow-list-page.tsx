import { notFound } from "next/navigation";
import { PageHeader } from "@/src/components/ui";
import { prisma } from "@/src/lib/db";
import { requirePageUser } from "@/src/server/auth/dal";
import { listFollowers, listFollowing, relationsFor } from "@/src/server/social/follows";
import { UserList } from "./UserList";

/** Página compartida de `/u/[id]/followers` y `/u/[id]/following`. */
export async function FollowListPage({ userId, kind }: { userId: string; kind: "followers" | "following" }) {
  const viewer = await requirePageUser();
  const owner = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, isActive: true } });
  if (!owner?.isActive) notFound();

  const users = kind === "followers" ? await listFollowers(userId) : await listFollowing(userId);
  const relations = await relationsFor(
    viewer.id,
    users.map((u) => u.id)
  );
  const title = kind === "followers" ? "Seguidores" : "Seguidos";
  return (
    <div className="mx-auto max-w-screen-sm">
      <PageHeader title={title} subtitle={owner.name ?? undefined} back={`/u/${userId}`} />
      <UserList
        users={users.map((u) => ({ ...u, relation: u.id === viewer.id ? null : (relations.get(u.id) ?? null) }))}
        emptyTitle={kind === "followers" ? "Todavía no tiene seguidores" : "Todavía no sigue a nadie"}
      />
    </div>
  );
}
