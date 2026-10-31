// Lógica pura de permisos (sin DB ni cookies), testeable con Vitest.

export type MembershipLike = {
  role: "admin" | "member";
  status: "pending" | "accepted" | "rejected" | "removed";
  leftAt: Date | null;
};

/** Rol efectivo en un grupo: solo cuenta una membresía aceptada y vigente. */
export function membershipRole(m: MembershipLike | null): "admin" | "member" | null {
  if (!m || m.leftAt || m.status !== "accepted") return null;
  return m.role;
}

/** Destino seguro para `?next=` después del login: solo rutas internas (evita open redirects). */
export function safeNextPath(next: string | null | undefined, fallback = "/home"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/^\/(login|register)(\/|\?|$)/.test(next)) return fallback;
  return next;
}
