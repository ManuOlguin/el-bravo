import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { createRoutineSchema } from "@/src/schemas/routine";
import { requireUser } from "@/src/server/auth/dal";
import { routeError } from "../../bridge";
import { legacyRoutineFields, routineExercisesCreate, routineSetsInclude } from "../legacy";

// PUENTE (W0-C): lee y escribe RoutineExercise + RoutineSet en orden. W2-1 lo reemplaza.

const notFound = () => NextResponse.json({ error: "Rutina no encontrada" }, { status: 404 });

// GET /api/routine/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const routine = await prisma.routine.findFirst({
      where: { id, userId: user.id },
      include: {
        exercises: {
          orderBy: { position: "asc" },
          include: { exercise: true, sets: routineSetsInclude },
        },
      },
    });
    if (!routine) return notFound();

    return NextResponse.json({
      id: routine.id,
      name: routine.name,
      exercises: routine.exercises.map((re) => ({
        exerciseId: re.exerciseId,
        name: re.exercise.name,
        measureType: re.exercise.measureType,
        ...legacyRoutineFields(re),
      })),
    });
  } catch (error) {
    return routeError(error, "Error obteniendo rutina");
  }
}

// PUT /api/routine/[id] — reemplaza nombre y ejercicios en una transacción.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const { name, exercises } = createRoutineSchema.parse(await req.json());

    const routine = await prisma.routine.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!routine) return notFound();

    const exerciseIds = Array.from(new Set(exercises.map((e) => e.exerciseId)));
    const existing = await prisma.exercise.findMany({
      where: { id: { in: exerciseIds } },
      select: { id: true, measureType: true },
    });
    if (existing.length !== exerciseIds.length) {
      return NextResponse.json({ error: "Alguno de los ejercicios no existe" }, { status: 400 });
    }
    const measureById = new Map(existing.map((e) => [e.id, e]));

    await prisma.$transaction(async (tx) => {
      await tx.routineExercise.deleteMany({ where: { routineId: id } });
      await tx.routine.update({
        where: { id },
        data: { name, exercises: { create: routineExercisesCreate(exercises, measureById) } },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error, "Error actualizando rutina");
  }
}

// DELETE /api/routine/[id] — los ejercicios y series caen por cascade; las actividades quedan sin rutina.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const routine = await prisma.routine.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    if (!routine) return notFound();
    await prisma.routine.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return routeError(error, "Error eliminando rutina");
  }
}
