import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/src/server/auth/dal";
import { getRoutineForEditor } from "@/src/server/routines/service";
import { listActivityCategoriesForUser } from "@/src/features/workout/server/queries";
import { LiveWorkoutScreen } from "@/src/features/workout/LiveWorkoutScreen";

export const metadata: Metadata = { title: "Entrenando" };

/** Pantalla completa: `LiveWorkoutScreen` se dibuja como overlay fijo encima del shell (oculta la navegación). */
export default async function LiveRoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const routine = await getRoutineForEditor(user.id, id).catch(() => null);
  if (!routine) notFound();
  const categories = await listActivityCategoriesForUser(user.id);
  return <LiveWorkoutScreen routine={routine} categories={categories} tz={user.timezone} />;
}
