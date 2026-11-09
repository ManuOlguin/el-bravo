/**
 * Límites de importar rutinas (spec 2026-10-31, fases 3 y 3b). Puro: lo usan el navegador (para avisar antes de mandar)
 * y el servidor (que vuelve a validar todo: nunca confía en el cliente).
 */

/** Texto pegado o extraído de un archivo. */
export const MAX_IMPORT_TEXT_CHARS = 8000;
/** Rutinas que devuelve la IA por importación; si el texto trae más, se avisa cuántas quedaron afuera. */
export const MAX_ROUTINES_PER_IMPORT = 7;
/**
 * Cuánto se espera a la IA al importar (texto o archivos, una o varias rutinas). Tiene que entrar con margen en el
 * `maxDuration` de app/routines/import/page.tsx (lo verifica tests/import-limits.test.ts). 85 s requiere Fluid Compute
 * o plan Pro en Vercel (ver el plan de la fase 3b, Task 1); plan B: 50 s con `maxDuration = 60`.
 */
export const AI_IMPORT_TIMEOUT_MS = 85_000;
