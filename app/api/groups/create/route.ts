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
    const { name, photoUrl, description } = body ?? {};

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const group = await prisma.group.create({
      data: {
        name: name.trim(),
        photoUrl: photoUrl ?? null,
        createdBy: user.id,
        // create initial member as admin
        members: {
          create: {
            userId: user.id,
            role: "admin",
          },
        },
      },
    });

    // optional: create a first season or other related records here

    return NextResponse.json({ id: group.id }, { status: 201 });
  } catch (err) {
    console.error("/api/groups/create error:", err);
    return NextResponse.json({ error: "Error creating group" }, { status: 500 });
  }
}
