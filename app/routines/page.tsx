import type { Metadata } from "next";
import { EmptyState, LinkButton, PageHeader } from "@/src/components/ui";
import { formatDate } from "@/src/lib/time";
import { requirePageUser } from "@/src/server/auth/dal";
import { listRoutines } from "@/src/server/routines/service";
import { RoutineCard } from "@/src/features/workout/RoutineCard";

export const metadata: Metadata = { title: "Rutinas" };

export default async function RoutinesPage() {
  const user = await requirePageUser();
  const routines = await listRoutines(user.id);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Rutinas"
        subtitle="Armá tus rutinas y entrenalas en vivo, tachando series."
        actions={
          <>
            <LinkButton href="/routines/import" size="sm" variant="secondary">
              Importar
            </LinkButton>
            {routines.length > 0 && (
              <LinkButton href="/routines/new" size="sm">
                + Nueva
              </LinkButton>
            )}
          </>
        }
      />
      {routines.length === 0 ? (
        <EmptyState
          icon={<span className="text-xl">🏋️</span>}
          title="Todavía no tenés rutinas"
          description="Creá una con tus ejercicios, series y pesos, y después empezala en vivo en el gimnasio."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <LinkButton href="/routines/new">Crear rutina</LinkButton>
              <LinkButton href="/routines/import" variant="secondary">
                Importar
              </LinkButton>
            </div>
          }
        />
      ) : (
        <ul className="space-y-3">
          {routines.map((r) => (
            <RoutineCard key={r.id} routine={r} lastUsedLabel={r.lastUsedAt ? formatDate(r.lastUsedAt, user.timezone) : null} />
          ))}
        </ul>
      )}
    </div>
  );
}
