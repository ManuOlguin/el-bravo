import type { Metadata } from "next";
import { requirePageUser } from "@/src/server/auth/dal";
import { RoutineEditorScreen } from "@/src/features/workout/RoutineEditorScreen";

export const metadata: Metadata = { title: "Nueva rutina" };

export default async function NewRoutinePage() {
  await requirePageUser();
  return <RoutineEditorScreen />;
}
