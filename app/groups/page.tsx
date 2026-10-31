import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, Card, EmptyState, LinkButton, PageHeader, Pill } from "@/src/components/ui";
import { requirePageUser } from "@/src/server/auth/dal";
import { getMyGroups } from "@/src/features/group/list-data";
import { JoinGroupButton } from "@/src/features/group/JoinGroupSheet";
import { medalOf, plural, timeLeftLabel } from "@/src/features/season/format";

export const metadata: Metadata = { title: "Grupos" };

export default async function GroupsPage() {
  const user = await requirePageUser();
  const groups = await getMyGroups(user.id);

  return (
    <div className="mx-auto max-w-screen-sm">
      <PageHeader title="Grupos" subtitle="Competí por temporadas con tus amigos." />
      <div className="mb-4 grid grid-cols-2 gap-2">
        <LinkButton href="/groups/new">Crear grupo</LinkButton>
        <JoinGroupButton />
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">👥</span>}
          title="Todavía no estás en ningún grupo"
          description="Creá uno e invitá a tus amigos, o unite con el código que te pasaron."
        />
      ) : (
        <ul className="space-y-3">
          {groups.map((g) => (
            <li key={g.id}>
              <Link href={`/group/${g.id}`} className="block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <Card interactive className="flex items-center gap-3">
                  <Avatar name={g.name} src={g.photoUrl} size="lg" className="rounded-2xl" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                      <span className="truncate font-bold">{g.name}</span>
                      {g.role === "admin" && <Pill tone="primary">Admin</Pill>}
                    </p>
                    <p className="truncate text-xs text-fg-muted">{plural(g.memberCount, "miembro", "miembros")}</p>
                    {g.season ? (
                      <p className="truncate text-xs text-fg-subtle">
                        {g.season.name} · {timeLeftLabel(g.today, g.season.endDate).toLowerCase()}
                      </p>
                    ) : (
                      <p className="text-xs text-fg-subtle">Sin temporada en curso</p>
                    )}
                  </div>
                  {g.season?.rank != null && (
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-extrabold tabular-nums">{medalOf(g.season.rank) ?? `${g.season.rank}°`}</p>
                      <p className="text-xs text-fg-muted tabular-nums">{g.season.points} pts</p>
                    </div>
                  )}
                  {g.season && !g.season.joined && <Pill tone="gold">Sumate</Pill>}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
