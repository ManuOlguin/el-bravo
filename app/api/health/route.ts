import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

// Público (monitoreo): solo dice si la app llega a la DB, sin datos (antes devolvía la cantidad de usuarios).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
