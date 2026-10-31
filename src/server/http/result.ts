// TEMP W0-B: se reemplaza al mergear W0-A
// Stub mínimo con la firma de 00-roadmap §5.3 (solo lo que usa la UI).
// Al mergear, quedarse con la versión de W0-A.

export type ActionResult<T = void> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}
