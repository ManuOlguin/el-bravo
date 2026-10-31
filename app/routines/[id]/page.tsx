import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/src/server/auth/dal";
import { getPublicRoutine } from "@/src/server/routines/service";
import { routineShareUrl } from "@/src/server/routines/share-url";
import { RoutineDetailView } from "@/src/features/routines-share/RoutineDetailView";

export const metadata: Metadata = { title: "Rutina" };

/** Propia (cualquier visibilidad) o pública de otro; la privada de otro o inexistente → 404 (nunca 403). */
export default async function RoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const routine = await getPublicRoutine(user.id, id).catch(() => null);
  if (!routine) notFound();
  const shareUrl = routine.visibility === "public" ? routineShareUrl(routine.id) : undefined;
  return <RoutineDetailView routine={routine} shareUrl={shareUrl} />;
}
