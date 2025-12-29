import { createRoutineSchema } from "@/src/schemas/routine";
import { prisma } from "@/src/lib/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";

export async function createRoutine(req) {
  try {
    // 1️⃣ Validar body
    const parsed = createRoutineSchema.parse(req.body)
    const { name, exercises } = parsed

    const userId = await getCurrentUser();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2️⃣ Validar que los ejercicios existan
    const exerciseIds = exercises.map(e => e.exerciseId)

    const existingExercises = await prisma.exercise.findMany({
      where: {
        id: { in: exerciseIds }
      },
      select: { id: true }
    })

    if (existingExercises.length !== exerciseIds.length) {
      return NextResponse.status(400).json({
        error: "One or more exercises do not exist"
      })
    }

    // 3️⃣ Crear rutina
    const routine = await prisma.routine.create({
      data: {
        name,
        user: {
          connect: { id: userId }
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
    })

    return NextResponse.status(201).json(routine)

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.status(400).json({
        errors: error.errors
      })
    }

    console.error(error)
    return NextResponse.status(500).json({ error: "Internal server error" })
  }
}