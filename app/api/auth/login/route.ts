import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import bcrypt from "bcryptjs";
import { setSessionCookie } from "@/src/server/auth/session";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const pass = String(password || "");

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        photoUrl: true,
        passwordHash: true,
        createdAt: true,
      },
    });

    if (!user) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

    const ok = await bcrypt.compare(pass, user.passwordHash);
    if (!ok) return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });

    await setSessionCookie({ userId: user.id, email: user.email });

    const { passwordHash, ...safeUser } = user;

    const res = NextResponse.json({ user: safeUser });

    return res;
  } catch {
    return NextResponse.json({ error: "Error iniciando sesión" }, { status: 500 });
  }
}
