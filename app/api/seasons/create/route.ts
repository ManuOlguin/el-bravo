import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/currentUser";
import { prisma } from "@/src/lib/db";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // find membership and ensure admin
    const membership = await prisma.groupMember.findFirst({ where: { userId: user.id, leftAt: null } });
    if (!membership) return NextResponse.json({ error: "No group" }, { status: 400 });
    if (membership.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { name, startDate, endDate, minPerWeek, description } = body ?? {};

    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
    }


    const season = await prisma.season.create({
      data: {
        groupId: membership.groupId,
        name: name.trim(),
        description: description ?? null,
        startDate: start,
        endDate: end
      },
    });

    return NextResponse.json({ id: season.id }, { status: 201 });
  } catch (err) {
    console.error("/api/seasons/create error:", err);
    return NextResponse.json({ error: "Error creating season" }, { status: 500 });
  }
}
