import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

// Único lugar (junto con dal.ts y proxy.ts) que conoce la cookie y el JWT de sesión.
export const SESSION_COOKIE = process.env.JWT_COOKIE_NAME || "elbravo_token";
const MAX_AGE_S = 60 * 60 * 24 * 30;

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("Missing JWT_SECRET");
  return new TextEncoder().encode(s);
}

export type SessionTokenPayload = { userId: string; email: string; ver?: number };

export async function signSessionToken(p: SessionTokenPayload) {
  return new SignJWT({ email: p.email, ver: p.ver ?? 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(p.userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, secret());
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") throw new Error("Invalid token");
  return { userId: payload.sub, email: payload.email, ver: typeof payload.ver === "number" ? payload.ver : 0 };
}

export async function setSessionCookie(p: SessionTokenPayload) {
  const token = await signSessionToken(p);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}
