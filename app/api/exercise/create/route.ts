import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { getCurrentUser } from "@/src/lib/currentUser";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const muscles = Array.isArray(body?.muscles) ? body.muscles : [];

    if (!name) {
      return NextResponse.json(
        { error: "El nombre del ejercicio es obligatorio" },
        { status: 400 }
      );
    }

    const existingExercise = await prisma.exercise.findUnique({
      where: { name },
      select: { id: true },
    });

    if (existingExercise) {
      return NextResponse.json(
        { error: "Ya existe un ejercicio con ese nombre" },
        { status: 400 }
      );
    }

    if (muscles.length === 0) {
      return NextResponse.json(
        { error: "Tenés que definir al menos un músculo" },
        { status: 400 }
      );
    }

    const usedMuscles = new Set<string>();
    let totalPercentage = 0;

    for (const item of muscles) {
      const muscleId =
        typeof item?.muscleId === "string" ? item.muscleId.trim() : "";
      const percentage = Number(item?.percentage);

      if (!muscleId) {
        return NextResponse.json(
          { error: "Todos los músculos deben estar seleccionados" },
          { status: 400 }
        );
      }

      if (!Number.isFinite(percentage) || percentage <= 0) {
        return NextResponse.json(
          { error: "Todos los porcentajes deben ser mayores a 0" },
          { status: 400 }
        );
      }

      if (usedMuscles.has(muscleId)) {
        return NextResponse.json(
          { error: "No podés repetir músculos en el mismo ejercicio" },
          { status: 400 }
        );
      }

      usedMuscles.add(muscleId);
      totalPercentage += percentage;
    }

    if (totalPercentage !== 100) {
      return NextResponse.json(
        { error: "Los porcentajes musculares deben sumar exactamente 100" },
        { status: 400 }
      );
    }

    const dbMuscles = await prisma.muscle.findMany({
      where: {
        id: {
          in: muscles.map((item: any) => item.muscleId),
        },
      },
    });

    if (dbMuscles.length !== muscles.length) {
      return NextResponse.json(
        { error: "Hay músculos inválidos en la solicitud" },
        { status: 400 }
      );
    }

    const createdRaw = await prisma.exercise.create({
      data: {
        name,
        muscles: {
          create: muscles.map((item: any) => ({
            muscleId: item.muscleId,
            percentage: Number(item.percentage),
          })),
        },
      },
      include: {
        muscles: {
          include: {
            muscle: true,
          },
        },
      },
    });

    const created = {
      id: createdRaw.id,
      name: createdRaw.name,
      muscles: Array.isArray(createdRaw.muscles)
        ? createdRaw.muscles.map((relation: any) => ({
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
    };

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error creando ejercicio" },
      { status: 500 }
    );
  }
}