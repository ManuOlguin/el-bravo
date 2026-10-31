import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { createRoutineSchema } from "@/src/schemas/routine";
import { getCurrentUser } from "@/src/lib/currentUser";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { name, exercises } = createRoutineSchema.parse(body);

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Tenés que iniciar sesión." },
        { status: 401 }
      );
    }

    const exerciseIds = Array.from(
      new Set(
        exercises
          .map((e) => e.exerciseId)
          .filter((id) => id && id !== "__new")
      )
    );

    const existingExercises =
      exerciseIds.length > 0
        ? await prisma.exercise.findMany({
            where: { id: { in: exerciseIds } },
            select: { id: true, measureType: true },
          })
        : [];

    if (existingExercises.length !== exerciseIds.length) {
      return NextResponse.json(
        { error: "Alguno de los ejercicios no existe" },
        { status: 400 }
      );
    }

    const exerciseById = new Map(existingExercises.map((item) => [item.id, item]));

    const routine = await prisma.routine.create({
      data: {
        name,
        user: {
          connect: { id: user.id },
        },
        exercises: {
          create: exercises.map((e) => {
            const exercise = exerciseById.get(e.exerciseId);
            const isDuration = exercise?.measureType === "duration";

            return {
              sets: e.sets,
              reps: isDuration ? null : e.reps,
              durationSeconds: isDuration ? e.durationSeconds : null,
              weightKg: e.weightKg,
              exercise: {
                connect: { id: e.exerciseId },
              },
            };
          }),
        },
      },
    });

    return NextResponse.json(routine, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Datos inválidos", issues: error.issues },
        { status: 400 }
      );
    }

    console.error(error);
    return NextResponse.json(
      { error: "Algo salió mal. Probá de nuevo." },
      { status: 500 }
    );
  }
}