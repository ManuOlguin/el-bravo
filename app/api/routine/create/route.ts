import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { createRoutineSchema } from "@/src/schemas/routine";
import { requireUser } from "@/src/server/auth/dal";
import { routeError } from "../../bridge";
import { routineExercisesCreate } from "../legacy";

// PUENTE (W0-C): escribe RoutineExercise + RoutineSet (N series iguales). W2-1 lo reemplaza.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { name, exercises } = createRoutineSchema.parse(await req.json());

    const exerciseIds = Array.from(new Set(exercises.map((e) => e.exerciseId)));
    const existing = await prisma.exercise.findMany({
      where: { id: { in: exerciseIds } },
      select: { id: true, measureType: true },
    });
    if (existing.length !== exerciseIds.length) {
      return NextResponse.json({ error: "Alguno de los ejercicios no existe" }, { status: 400 });
    }

    const routine = await prisma.routine.create({
      data: {
        name,
        userId: user.id,
        exercises: { create: routineExercisesCreate(exercises, new Map(existing.map((e) => [e.id, e]))) },
      },
    });

    return NextResponse.json(routine, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
