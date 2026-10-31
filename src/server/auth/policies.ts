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

const NEXT_BASE = "http://next.invalid";

/**
 * Destino seguro para `?next=` después del login: solo rutas internas (evita open redirects).
 * Se normaliza con el parser WHATWG (el mismo que usa el router del cliente): así `"/\t/evil.com"`
 * —el parser descarta tabs y saltos de línea y queda `//evil.com`— no se escapa a otro origen.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/home"): string {
  if (!next || !next.startsWith("/") || /[\u0000-\u001F\u007F\\]/.test(next)) return fallback;
  let url: URL;
  try {
    url = new URL(next, NEXT_BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== NEXT_BASE) return fallback;
  const path = url.pathname + url.search + url.hash;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  if (/^\/(login|register)(\/|\?|#|$)/.test(path)) return fallback;
  return path;
}
