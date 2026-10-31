"use client";
// PUENTE (W2-1): lo sigue usando app/profile (W2-4) hasta su reescritura. Las pantallas nuevas usan
// `DeleteWorkoutButton` de src/features/workout. Borrar este archivo cuando nadie lo importe.
import { DeleteWorkoutButton } from "@/src/features/workout/DeleteWorkoutButton";

export default function DeleteActivityButton({ activityId }: { activityId: string }) {
  return <DeleteWorkoutButton activityId={activityId} variant="icon" />;
}
