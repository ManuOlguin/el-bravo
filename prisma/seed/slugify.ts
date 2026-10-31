/** "Press de Banca (inclinado)" → "press-de-banca-inclinado". Lo usan el seed y scripts/migrate-v2-data.ts. */
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
