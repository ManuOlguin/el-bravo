import { SignJWT, jwtVerify } from "jose";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  return new TextEncoder().encode(secret);
}

export type AuthTokenPayload = {
  sub: string;   // userId
  email: string;
};

export async function signAuthToken(payload: AuthTokenPayload) {
  const secret = getJwtSecret();

  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifyAuthToken(token: string) {
  const secret = getJwtSecret();
  const { payload } = await jwtVerify(token, secret);

  const userId = payload.sub;
  const email = payload.email;

  if (!userId || typeof userId !== "string") throw new Error("Invalid token");
  if (!email || typeof email !== "string") throw new Error("Invalid token");

  return { userId, email };
}
