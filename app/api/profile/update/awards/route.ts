import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";
import { evaluateAwardsForUser } from "@/src/lib/awards/evaluateAwards";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const awards = await evaluateAwardsForUser(user.id);

    const earned = awards.filter((award) => award.earned);
    const inProgress = awards.filter((award) => !award.earned);

    return NextResponse.json({
      awards,
      summary: {
        total: awards.length,
        earned: earned.length,
        inProgress: inProgress.length,
      },
    });
  } catch (error) {
    console.error("/api/profile/awards error:", error);
    return NextResponse.json(
      { error: "Error obteniendo awards del perfil" },
      { status: 500 }
    );
  }
}