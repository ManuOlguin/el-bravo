import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/db";

// ==========================
// GET /api/routine/[id]
// ==========================
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    if (!id) {
      return NextResponse.json(
        { error: "ID inválido" },
        { status: 400 }
      );
    }

    const routine = await prisma.routine.findUnique({
      where: { id },
      include: {
        exercises: {
          include: {
            exercise: true,
          },
        },
      },
    });

    if (!routine) {
      return NextResponse.json(
        { error: "Rutina no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: routine.id,
      name: routine.name,
      exercises: routine.exercises.map((re) => ({
        exerciseId: re.exerciseId,
        sets: re.sets,
        reps: re.reps,
        weightKg: re.weightKg ?? null,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error obteniendo rutina" },
      { status: 500 }
    );
  }
}

// ==========================
// PUT /api/routine/[id]
// ==========================
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await req.json();
    const { name, exercises } = body;

    if (!id || !name || !Array.isArray(exercises)) {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 }
      );
    }

    await prisma.routineExercise.deleteMany({
      where: { routineId: id },
    });

    await prisma.routine.update({
      where: { id },
      data: {
        name,
        exercises: {
          create: exercises.map((ex: any) => ({
            exerciseId: ex.exerciseId,
            sets: Number(ex.sets),
            reps: Number(ex.reps),
            weightKg:
              ex.weightKg === null ||
              ex.weightKg === undefined ||
              ex.weightKg === ""
                ? null
                : Number(ex.weightKg),
          })),
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error actualizando rutina" },
      { status: 500 }
    );
  }
}

// ==========================
// DELETE /api/routine/[id]
// ==========================
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    if (!id) {
      return NextResponse.json(
        { error: "ID inválido" },
        { status: 400 }
      );
    }

    await prisma.routineExercise.deleteMany({
      where: { routineId: id },
    });

    await prisma.routine.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error eliminando rutina" },
      { status: 500 }
    );
  }
}