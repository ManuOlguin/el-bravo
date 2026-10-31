import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePageUser } from "@/src/server/auth/dal";
import { getRoutineForEditor } from "@/src/server/routines/service";
import { RoutineEditorScreen } from "@/src/features/workout/RoutineEditorScreen";

export const metadata: Metadata = { title: "Editar rutina" };

export default async function EditRoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const routine = await getRoutineForEditor(user.id, id).catch(() => null);
  if (!routine) notFound(); // no existe o no es tuya
  return <RoutineEditorScreen routine={routine} />;
}
