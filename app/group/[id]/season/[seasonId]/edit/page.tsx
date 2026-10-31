import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";
import LogoutButton from "@/src/components/LogoutButton";
import EditSeasonForm from "@/src/components/EditSeasonForm";
import { dbDateToLocalDate } from "@/src/lib/time";

export default async function EditSeasonPage({
  params,
}: {
  params: Promise<{ id: string; seasonId: string }>;
}) {
  const { id: groupId, seasonId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const membership = await prisma.groupMember.findFirst({
    where: {
      userId: user.id,
      groupId,
      leftAt: null,
    },
    select: {
      role: true,
    },
  });

  if (!membership) redirect(`/group/${groupId}`);
  if (membership.role !== "admin") redirect(`/group/${groupId}`);

  const season = await prisma.season.findFirst({
    where: {
      id: seasonId,
      groupId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      startDate: true,
      endDate: true,
      weeklyGoal: true,
      minDailyMinutes: true,
      resultsReveal: true,
      awards: { select: { awardType: true, bonusPoints: true } },
      categories: {
        select: {
          activityCategoryId: true,
          weight: true,
        },
      },
    },
  });

  if (!season) redirect(`/group/${groupId}`);

  return (
    <main className="min-h-screen bg-[#08142d] p-6 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <a
            href={`/group/${groupId}`}
            className="inline-flex items-center rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500"
          >
            ← Volver al grupo
          </a>

          <LogoutButton />
        </div>

        <section className="rounded-[28px] bg-slate-800/85 p-6 shadow-2xl">
          <div className="mb-6">
            <h1 className="text-4xl font-bold text-white">Editar temporada</h1>
            <p className="mt-2 text-sm text-slate-400">
              Ajustá nombre, fechas, objetivo semanal y tipos de actividad que suman puntos.
            </p>
          </div>

          <EditSeasonForm
            groupId={groupId}
            seasonId={season.id}
            initialName={season.name}
            initialDescription={season.description ?? ""}
            initialStartDate={dbDateToLocalDate(season.startDate)}
            initialEndDate={dbDateToLocalDate(season.endDate)}
            initialWeeklyGoal={season.weeklyGoal}
            initialAllowedActivityCategoryIds={season.categories.map(
              (item: { activityCategoryId: string }) => item.activityCategoryId
            )}
            initialConfig={{
              minDailyMinutes: season.minDailyMinutes,
              resultsReveal: season.resultsReveal,
              weights: Object.fromEntries(season.categories.map((c) => [c.activityCategoryId, Number(c.weight)])),
              awards: season.awards,
            }}
          />
        </section>
      </div>
    </main>
  );
}