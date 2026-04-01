import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { getCurrentUser } from "@/src/lib/currentUser";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const musclesRaw = await prisma.muscle.findMany({
      orderBy: { name: "asc" },
    });

    const muscles = musclesRaw.map((muscle: any) => ({
      id: muscle.id,
      name: muscle.name,
      slug: muscle.slug ?? muscle.id,
      groupKey: muscle.groupKey ?? "other",
    }));

    return NextResponse.json(muscles);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error obteniendo músculos" },
      { status: 500 }
    );
  }
}