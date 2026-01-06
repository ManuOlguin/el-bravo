import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/db";
import { getCurrentUser } from "@/src/lib/currentUser";

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id
    const routines = await prisma.routine.findMany({
      where: {
        userId
      },
      select: {
        id: true,
        name: true,
        exercises: {
          select: {
            id: true,
            sets: true,
            reps: true,
            exercise: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    const formatted = routines.map(routine => ({
      id: routine.id,
      name: routine.name,
      exercises: routine.exercises.map(e => ({
        id: e.id,
        exerciseId: e.exercise.id,
        name: e.exercise.name,
        sets: e.sets,
        reps: e.reps
      }))
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error obteniendo rutinas" },
      { status: 500 }
    );
  }
}