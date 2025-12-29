import { prisma } from "@/src/lib/db";
import { createExerciseSchema } from "@/src/schemas/exercise";
import { z } from "zod";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 1️⃣ Leer body
    const body = await request.json();

    // 2️⃣ Validar
    const { name } = createExerciseSchema.parse(body);

    // 3️⃣ Normalizar
    const normalizedName = name.trim();

    // 4️⃣ Verificar si existe
    const existingExercise = await prisma.exercise.findUnique({
      where: { name: normalizedName }
    });

    if (existingExercise) {
      return NextResponse.json(existingExercise, { status: 200 });
    }

    // 5️⃣ Crear
    const exercise = await prisma.exercise.create({
      data: {
        name: normalizedName
      }
    });

    return NextResponse.json(exercise, { status: 201 });

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