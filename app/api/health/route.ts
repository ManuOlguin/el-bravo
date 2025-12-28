import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function GET() {
  const usersCount = await prisma.user.count();
  return NextResponse.json({ ok: true, usersCount });
}