import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/db";

export async function GET() {
  try {
    const exercises = await prisma.exercise.findMany({
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: "asc"
      }
    });

    return NextResponse.json(exercises);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error obteniendo ejercicios" },
      { status: 500 }
    );
  }
}