import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { requirePageUser } from "@/src/server/auth/dal";
import { getActivityForEdit } from "@/src/server/activities/service";
import { listRoutines } from "@/src/server/routines/service";
import { getExerciseSummaries, listActivityCategoriesForUser } from "@/src/features/workout/server/queries";
import { LogWorkoutScreen } from "@/src/features/workout/LogWorkoutScreen";

/** "Ahora" del request (la hora por defecto del formulario es ahora − duración). */
const requestTime = () => Date.now();

export const metadata: Metadata = { title: "Editar entrenamiento" };

export default async function EditWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const input = await getActivityForEdit(user.id, id).catch(() => null);
  if (!input) notFound(); // no existe o no es tuyo
  const [categories, routines, exercises, media] = await Promise.all([
    listActivityCategoriesForUser(user.id),
    listRoutines(user.id),
    getExerciseSummaries(input.exercises.map((e) => e.exerciseId)),
    prisma.activityMedia.findMany({
      where: { activityId: id, status: "ready" },
      orderBy: { position: "asc" },
      select: { id: true, url: true, thumbUrl: true },
    }),
  ]);
  return (
    <LogWorkoutScreen
      kind="edit"
      categories={categories}
      routines={routines.map((r) => ({ id: r.id, name: r.name, exerciseCount: r.exerciseCount, setCount: r.setCount }))}
      tz={user.timezone}
      nowMs={requestTime()}
      edit={{ input, exercises: [...exercises.values()], photos: media }}
    />
  );
}
