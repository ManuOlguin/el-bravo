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

/** Fotos por importación (3b). */
export const MAX_IMAGES = 4;
/** Páginas de un PDF (3b): se controla cuando se pueden contar sin parsearlo (ver src/server/ai/attachments.ts). */
export const MAX_PDF_PAGES = 10;
/** Lo que viaja al servidor en una importación: Vercel corta el body en 4,5 MB (y next.config, en 4.5mb). */
export const MAX_TOTAL_BYTES = 4_000_000;
/** Una foto ya achicada (1600 px, JPEG): normalmente 200–700 KB. */
export const MAX_IMAGE_BYTES = 1_500_000;
/** Foto original antes de achicarla en el navegador (decodificar algo más grande puede colgar el celular). */
export const MAX_RAW_IMAGE_BYTES = 30_000_000;
/** Word/Excel/texto: se leen en el navegador y no se suben. */
export const MAX_TEXT_FILE_BYTES = 5_000_000;
