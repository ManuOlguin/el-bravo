import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { getCurrentUser } from "@/src/lib/currentUser";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const exercisesRaw = await prisma.exercise.findMany({
      orderBy: { name: "asc" },
      include: {
        muscles: {
          include: {
            muscle: true,
          },
        },
      },
    });

    const exercises = exercisesRaw.map((exercise: any) => ({
      id: exercise.id,
      name: exercise.name,
      muscles: Array.isArray(exercise.muscles)
        ? exercise.muscles.map((relation: any) => ({
            id: relation.id,
            percentage: relation.percentage,
            muscle: {
              id: relation.muscle.id,
              name: relation.muscle.name,
              slug: relation.muscle.slug ?? relation.muscle.id,
              groupKey: relation.muscle.groupKey ?? "other",
            },
          }))
        : [],
    }));

    return NextResponse.json(exercises);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error obteniendo ejercicios" },
      { status: 500 }
    );
  }
}