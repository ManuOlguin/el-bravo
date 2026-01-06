import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { createRoutineSchema } from "@/src/schemas/routine";
import { getCurrentUser } from "@/src/lib/currentUser";
import { z } from "zod";

export async function POST(req: Request) {
  try {
    // 1️⃣ Leer body correctamente
    const body = await req.json();

    // 2️⃣ Validar con Zod
    const { name, exercises } = createRoutineSchema.parse(body);

    // 3️⃣ Usuario actual
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // 4️⃣ Validar que los ejercicios existan
    const exerciseIds = exercises.map(e => e.exerciseId);

    const existingExercises = await prisma.exercise.findMany({
      where: {
        id: { in: exerciseIds }
      },
      select: { id: true }
    });

    if (existingExercises.length !== exerciseIds.length) {
      return NextResponse.json(
        { error: "One or more exercises do not exist" },
        { status: 400 }
      );
    }

    // 5️⃣ Crear rutina
    const routine = await prisma.routine.create({
      data: {
        name,
        user: {
          connect: { id: user.id }
        },
        exercises: {
          create: exercises.map(e => ({
            sets: e.sets,
            reps: e.reps,
            exercise: {
              connect: { id: e.exerciseId }
            }
          }))
        }
      }
    });

    return NextResponse.json(routine, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { errors: error.errors },
        { status: 400 }
      );
    }

    console.error(error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}