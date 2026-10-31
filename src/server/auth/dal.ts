import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/src/lib/db";
import { DEFAULT_TZ } from "@/src/lib/time";
import { SESSION_COOKIE, verifySessionToken } from "./session";
import { AuthError } from "./errors";
import { membershipRole } from "./policies";

export { AuthError } from "./errors";

export type SessionUser = { id: string; email: string; name: string | null; photoUrl: string | null; timezone: string };

/** Usuario de la sesión actual (o null). Memoizado por request con React `cache()`. */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { userId, ver } = await verifySessionToken(token);
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, photoUrl: true, timezone: true, isActive: true, tokenVersion: true },
    });
    // Sesión revocada (cambio de contraseña / "cerrar sesión en todos lados") si la versión no coincide.
    if (!u || !u.isActive || u.tokenVersion !== ver) return null;
    return { id: u.id, email: u.email, name: u.name, photoUrl: u.photoUrl, timezone: u.timezone ?? DEFAULT_TZ };
  } catch {
    return null;
  }
});

/** Para Server Actions y route handlers: lanza `AuthError("UNAUTHENTICATED")`. */
export async function requireUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new AuthError("UNAUTHENTICATED");
  return s;
}

/**
 * Para Server Components/páginas: redirige a `/login?next=<ruta actual>`.
 * Si había cookie pero la sesión ya no vale (revocada o vencida) agrega `expired=1`: así proxy.ts
 * no rebota de /login a /home por ver una firma válida (evita un loop de redirects).
 */
export async function requirePageUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) {
    const path = (await headers()).get("x-pathname") ?? "/home";
    const hadCookie = !!(await cookies()).get(SESSION_COOKIE)?.value;
    redirect(`/login?next=${encodeURIComponent(path)}${hadCookie ? "&expired=1" : ""}`);
  }
  return s;
}

export async function requireGroupMember(
  groupId: string
): Promise<{ user: SessionUser; role: "admin" | "member" }> {
  const user = await requireUser();
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: user.id } },
    select: { role: true, status: true, leftAt: true },
  });
  const role = membershipRole(m);
  if (!role) throw new AuthError(m ? "FORBIDDEN" : "NOT_FOUND");
  return { user, role };
}

export async function requireGroupAdmin(groupId: string): Promise<SessionUser> {
  const { user, role } = await requireGroupMember(groupId);
  if (role !== "admin") throw new AuthError("FORBIDDEN");
  return user;
}
