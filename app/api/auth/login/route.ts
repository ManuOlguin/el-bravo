import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import bcrypt from "bcryptjs";
import { signAuthToken } from "@/src/lib/auth";

const COOKIE_NAME = process.env.JWT_COOKIE_NAME || "elbravo_token";

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

    const token = await signAuthToken({ sub: user.id, email: user.email });

    const { passwordHash, ...safeUser } = user;

    const res = NextResponse.json({ user: safeUser });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Error iniciando sesión" }, { status: 500 });
  }
}
