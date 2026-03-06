import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";

export async function POST(req: Request) {
  try {

    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const {
      startedAt,
      endedAt,
      notes,
      type,
      routineId,
      exercises = []
    } = body ?? {};

    if (!startedAt || !endedAt) {
      return NextResponse.json(
        { error: "Start and end required" },
        { status: 400 }
      );
    }

    const s = new Date(startedAt);
    const e = new Date(endedAt);

    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s >= e) {
      return NextResponse.json(
        { error: "Invalid dates" },
        { status: 400 }
      );
    }

    // 1️⃣ Crear la actividad
    const activity = await prisma.activity.create({
      data: {
        userId: user.id,
        startedAt: s,
        endedAt: e,
        notes: notes ?? null,
        type: type ?? "gym",
        routineId: routineId ?? null
      }
    });

    // 2️⃣ Crear ejercicios de la actividad
    if (exercises.length > 0) {

      await prisma.activityExercise.createMany({
        data: exercises.map((e: any) => ({
          activityId: activity.id,
          exerciseId: e.exerciseId,
          sets: Number(e.sets),
          reps: Number(e.reps)
        }))
      });

    }

    return NextResponse.json(
      { id: activity.id },
      { status: 201 }
    );

  } catch (err) {

    console.error("/api/activities/create error:", err);

    return NextResponse.json(
      { error: "Error creating activity" },
      { status: 500 }
    );
  }
}