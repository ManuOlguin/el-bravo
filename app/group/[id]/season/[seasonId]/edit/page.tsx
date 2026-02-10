import { redirect } from "next/navigation";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";
import LogoutButton from "@/src/components/LogoutButton";
import EditSeasonForm from "@/src/components/EditSeasonForm";

type Params = { id: string; seasonId: string };

export default async function EditSeasonPage({
  params,
}: {
  // ✅ Next te lo está pasando como Promise (por eso el error que viste)
  params: Promise<Params>;
}) {
  const { id: groupId, seasonId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Solo admin puede editar
  const membership = await prisma.groupMember.findFirst({
    where: { userId: user.id, groupId, leftAt: null },
    select: { role: true },
  });

  if (!membership) redirect(`/group/${groupId}`);
  if (membership.role !== "admin") redirect(`/group/${groupId}`);

  const season = await prisma.season.findFirst({
    where: { id: seasonId, groupId },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      minPerWeek: true,
    },
  });

  if (!season) redirect(`/group/${groupId}`);

  const isFinished = new Date(season.endDate).getTime() < Date.now();

  return (
    <main className="min-h-screen bg-gray-900 p-6 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <a
            href={`/group/${groupId}`}
            className="inline-flex items-center px-3 py-2 bg-gray-700 rounded-md text-sm hover:bg-gray-600"
          >
            ← Volver al grupo
          </a>
          <LogoutButton />
        </div>

        <div className="bg-gray-800 rounded-lg p-6 shadow">
          <h1 className="text-2xl font-semibold mb-4">Editar temporada</h1>

          {isFinished ? (
            <p className="text-sm text-yellow-300 mb-4">
              Esta temporada ya terminó. No se puede editar.
            </p>
          ) : null}

          <EditSeasonForm
            groupId={groupId}
            season={{
              id: season.id,
              name: season.name,
              startDate: season.startDate,
              endDate: season.endDate,
              minPerWeek: season.minPerWeek ?? 2,
            }}
          />
        </div>
      </div>
    </main>
  );
}
