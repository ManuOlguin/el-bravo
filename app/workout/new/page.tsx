import type { Metadata } from "next";
import { requirePageUser } from "@/src/server/auth/dal";
import { getRoutineForEditor, listRoutines } from "@/src/server/routines/service";
import { listActivityCategoriesForUser } from "@/src/features/workout/server/queries";
import { LogWorkoutScreen } from "@/src/features/workout/LogWorkoutScreen";

/** "Ahora" del request (la hora por defecto del formulario es ahora − duración). */
const requestTime = () => Date.now();

export const metadata: Metadata = { title: "Registrar entrenamiento" };

export default async function NewWorkoutPage({ searchParams }: { searchParams: Promise<{ routine?: string }> }) {
  const user = await requirePageUser();
  const { routine: routineId } = await searchParams;
  const [categories, routines, initialRoutine] = await Promise.all([
    listActivityCategoriesForUser(user.id),
    listRoutines(user.id),
    routineId ? getRoutineForEditor(user.id, routineId).catch(() => null) : Promise.resolve(null),
  ]);
  return (
    <LogWorkoutScreen
      kind="create"
      categories={categories}
      routines={routines.map((r) => ({ id: r.id, name: r.name, exerciseCount: r.exerciseCount, setCount: r.setCount }))}
      tz={user.timezone}
      nowMs={requestTime()}
      initialRoutine={initialRoutine}
    />
  );
}
