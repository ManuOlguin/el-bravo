import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import bcrypt from "bcryptjs";
import { signAuthToken } from "@/src/lib/auth";

const COOKIE_NAME = process.env.JWT_COOKIE_NAME || "elbravo_token";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email y password requeridos" }, { status: 400 });
    }
    if (String(password).length < 8) {
      return NextResponse.json({ error: "Password mínimo 8 caracteres" }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (exists) {
      return NextResponse.json({ error: "Email ya registrado" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name ? String(name).trim() : null,
      },
      select: { id: true, email: true, name: true, photoUrl: true, createdAt: true },
    });

    const token = await signAuthToken({ sub: user.id, email: user.email });

    const res = NextResponse.json({ user });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Error registrando usuario" }, { status: 500 });
  }
}
