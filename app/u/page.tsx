import type { Metadata } from "next";
import { PageHeader } from "@/src/components/ui";
import { requirePageUser } from "@/src/server/auth/dal";
import { getFollowSuggestions, relationsFor } from "@/src/server/social/follows";
import { UserSearch } from "@/src/features/social/UserSearch";
import { UserList } from "@/src/features/social/UserList";

export const metadata: Metadata = { title: "Buscar personas" };

export default async function PeoplePage() {
  const viewer = await requirePageUser();
  const suggestions = await getFollowSuggestions(viewer.id, 10);
  const relations = await relationsFor(
    viewer.id,
    suggestions.map((u) => u.id)
  );
  return (
    <div className="mx-auto max-w-screen-sm space-y-6">
      <PageHeader title="Personas" subtitle="Seguí a tus amigos para ver sus entrenamientos" back={`/u/${viewer.id}`} />
      <UserSearch />
      {suggestions.length > 0 && (
        <section aria-labelledby="suggestions-title" className="space-y-2">
          <h2 id="suggestions-title" className="text-sm font-bold uppercase tracking-wide text-fg-subtle">
            De tus grupos
          </h2>
          <UserList
            users={suggestions.map((u) => ({ ...u, relation: relations.get(u.id) ?? { isFollowing: false, followsMe: false } }))}
            emptyTitle=""
          />
        </section>
      )}
    </div>
  );
}
