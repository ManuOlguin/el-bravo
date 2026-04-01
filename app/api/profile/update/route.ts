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
    const { name, photoUrl, weeklyGoal } = body ?? {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    let normalizedWeeklyGoal: number | undefined = undefined;

    if (weeklyGoal !== undefined && weeklyGoal !== null && weeklyGoal !== "") {
      const parsedWeeklyGoal = Number(weeklyGoal);

      if (
        !Number.isInteger(parsedWeeklyGoal) ||
        parsedWeeklyGoal < 1 ||
        parsedWeeklyGoal > 14
      ) {
        return NextResponse.json(
          { error: "weeklyGoal must be an integer between 1 and 14" },
          { status: 400 }
        );
      }

      normalizedWeeklyGoal = parsedWeeklyGoal;
    }

    const normalizedPhotoUrl =
      typeof photoUrl === "string" && photoUrl.trim() ? photoUrl.trim() : null;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name.trim(),
        photoUrl: normalizedPhotoUrl,
        ...(normalizedWeeklyGoal !== undefined
          ? { weeklyGoal: normalizedWeeklyGoal }
          : {}),
      },
    });

    return NextResponse.json({ id: updated.id }, { status: 200 });
  } catch (err) {
    console.error("/api/profile/update error:", err);
    return NextResponse.json({ error: "Error updating profile" }, { status: 500 });
  }
}