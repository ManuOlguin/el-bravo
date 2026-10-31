import "server-only";
import { SignJWT, jwtVerify } from "jose";

// Invitación personal a un grupo (D5: "invitar amigos sin código"): JWT corto firmado con JWT_SECRET.
// `aud` distinto al de la sesión para que un token no se pueda usar como el otro.
const AUDIENCE = "elbravo:group-invite";
const TTL = "7d";

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("Missing JWT_SECRET");
  return new TextEncoder().encode(s);
}

export async function signGroupInviteToken(p: { groupId: string; userId: string; inviterId: string }): Promise<string> {
  return new SignJWT({ groupId: p.groupId, userId: p.userId, inviterId: p.inviterId })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(secret());
}

/** Devuelve null si el token es inválido, vencido o no es de invitación. */
export async function verifyGroupInviteToken(
  token: string
): Promise<{ groupId: string; userId: string; inviterId: string; issuedAt: Date } | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: AUDIENCE });
    const { groupId, userId, inviterId } = payload as Record<string, unknown>;
    if (typeof groupId !== "string" || typeof userId !== "string" || typeof inviterId !== "string") return null;
    if (typeof payload.iat !== "number") return null;
    return { groupId, userId, inviterId, issuedAt: new Date(payload.iat * 1000) };
  } catch {
    return null;
  }
}
