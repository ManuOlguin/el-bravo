import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/src/components/ui";
import { AuthError, requirePageUser } from "@/src/server/auth/dal";
import { getSeasonFormData } from "@/src/features/season/form-data";
import { SeasonForm } from "@/src/features/season/SeasonForm";

export const metadata: Metadata = { title: "Nueva temporada" };

export default async function NewSeasonPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  let data;
  try {
    data = await getSeasonFormData(id, user.id);
  } catch (e) {
    if (e instanceof AuthError) notFound();
    throw e;
  }
  if (data.group.myRole !== "admin") redirect(`/group/${data.group.id}`);

  return (
    <div className="mx-auto max-w-screen-sm">
      <PageHeader title="Nueva temporada" subtitle={data.group.name} back={`/group/${data.group.id}`} />
      <SeasonForm groupId={data.group.id} categories={data.categories} today={data.today} otherSeasons={data.otherSeasons} />
    </div>
  );
}
