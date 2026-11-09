/** Tope de body de una Server Action fuera de /routines/import (el default de Next). */
export const DEFAULT_ACTION_BODY_LIMIT = 1_048_576;

/**
 * Next decodifica todo el body de una Server Action (hasta `bodySizeLimit`) ANTES de correr la acción, así que
 * `requireUser()` no protege el tamaño. Como el límite global está en 4,5 MB para importar fotos/PDF, el proxy
 * devuelve el 1 MiB original en el resto de las rutas.
 */
export function isOversizedServerAction(req: { method: string; pathname: string; headers: Headers }): boolean {
  if (req.method !== "POST" || !req.headers.has("next-action")) return false;
  if (req.pathname === "/routines/import") return false;
  const length = Number(req.headers.get("content-length"));
  return Number.isFinite(length) && length > DEFAULT_ACTION_BODY_LIMIT;
}
