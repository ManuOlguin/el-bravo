import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { getCurrentUser } from "@/src/lib/currentUser";
import { legacyRoutineFields, routineSetsInclude } from "../legacy";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const routines = await prisma.routine.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        exercises: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            sets: { ...routineSetsInclude, select: { targetReps: true, targetDurationSeconds: true, targetWeightKg: true } },
            exercise: {
              select: {
                id: true,
                name: true,
                measureType: true,
                muscles: {
                  select: {
                    exerciseId: true,
                    muscleId: true,
                    percentage: true,
                    muscle: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                        groupKey: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const formatted = routines.map((routine) => ({
      id: routine.id,
      name: routine.name,
      createdAt: routine.createdAt,
      exercises: routine.exercises.map((entry) => ({
        id: entry.id,
        exerciseId: entry.exercise.id,
        name: entry.exercise.name,
        measureType: entry.exercise.measureType,
        ...legacyRoutineFields(entry),
        muscles: entry.exercise.muscles.map((muscleEntry) => ({
          exerciseId: muscleEntry.exerciseId,
          muscleId: muscleEntry.muscleId,
          percentage: muscleEntry.percentage,
          muscle: {
            id: muscleEntry.muscle.id,
            name: muscleEntry.muscle.name,
            slug: muscleEntry.muscle.slug,
            groupKey: muscleEntry.muscle.groupKey,
          },
        })),
      })),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("/api/routine/list error:", error);

    return NextResponse.json(
      { error: "Error cargando rutinas" },
      { status: 500 }
    );
  }
}