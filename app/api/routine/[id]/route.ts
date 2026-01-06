import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/db";

// ==========================
// GET /api/routine/[id]
// ==========================
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // ✅ Next 14

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
            exercise: true
          }
        }
      }
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
      exercises: routine.exercises.map(re => ({
        exerciseId: re.exerciseId,
        sets: re.sets,
        reps: re.reps
      }))
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

    // borrar ejercicios previos
    await prisma.routineExercise.deleteMany({
      where: { routineId: id }
    });

    // actualizar rutina
    await prisma.routine.update({
      where: { id },
      data: {
        name,
        exercises: {
          create: exercises.map((ex: any) => ({
            exerciseId: ex.exerciseId,
            sets: ex.sets,
            reps: ex.reps
          }))
        }
      }
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

    // borrar ejercicios primero (FK)
    await prisma.routineExercise.deleteMany({
      where: { routineId: id }
    });

    // borrar rutina
    await prisma.routine.delete({
      where: { id }
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
