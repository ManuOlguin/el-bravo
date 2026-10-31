import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card, CardHeader, LinkButton, PageHeader } from "@/src/components/ui";
import { AuthError, requirePageUser } from "@/src/server/auth/dal";
import { getSeasonFormData } from "@/src/features/season/form-data";
import { SeasonForm } from "@/src/features/season/SeasonForm";
import { seasonFormFromSummary } from "@/src/features/season/season-form-state";
import { DeleteSeasonButton, ReopenSeasonButton } from "@/src/features/season/SeasonAdminActions";

export const metadata: Metadata = { title: "Editar temporada" };

export default async function EditSeasonPage({ params }: { params: Promise<{ id: string; seasonId: string }> }) {
  const user = await requirePageUser();
  const { id, seasonId } = await params;
  let data;
  try {
    data = await getSeasonFormData(id, user.id, seasonId);
  } catch (e) {
    if (e instanceof AuthError) notFound();
    throw e;
  }
  const { group, season } = data;
  if (!season) notFound();
  const seasonHref = `/group/${group.id}/season/${season.id}`;
  if (group.myRole !== "admin") redirect(seasonHref);

  return (
    <div className="mx-auto max-w-screen-sm space-y-4">
      <PageHeader title="Editar temporada" subtitle={season.name} back={seasonHref} />

      {season.status === "finalized" ? (
        <Card className="space-y-3">
          <CardHeader
            title="La temporada está cerrada"
            subtitle="Los resultados están congelados. Para cambiar algo, reabrila: se borran los premios entregados y se vuelve a calcular todo."
          />
          <div className="flex flex-wrap gap-2">
            <ReopenSeasonButton seasonId={season.id} />
            <LinkButton href={seasonHref} variant="ghost">
              Ver resultados
            </LinkButton>
          </div>
        </Card>
      ) : (
        <SeasonForm
          groupId={group.id}
          seasonId={season.id}
          categories={data.categories}
          initial={seasonFormFromSummary(season, data.categories)}
          today={data.today}
          otherSeasons={data.otherSeasons}
          active={season.status === "active"}
        />
      )}

      <Card className="border-danger/40">
        <CardHeader title="Zona de peligro" subtitle="Borrar la temporada elimina su ranking y premios para todos." />
        <DeleteSeasonButton seasonId={season.id} groupId={group.id} />
      </Card>
    </div>
  );
}
