import { readFileSync } from "node:fs";
import { expect, type Browser, type Page } from "@playwright/test";
import { CREDENTIALS_PATH, TZ } from "../env";
import type { E2ECredentials, E2EUserKey } from "./seed-e2e";

export { TZ };

let cached: E2ECredentials | null = null;
/** Credenciales y ids que escribió `seed-e2e.ts` en esta corrida. */
export function creds(): E2ECredentials {
  cached ??= JSON.parse(readFileSync(CREDENTIALS_PATH, "utf8")) as E2ECredentials;
  return cached;
}
export const user = (key: E2EUserKey) => creds().users[key];

/** Completa /login y espera la redirección (a `/home` o al `next`). */
export async function login(page: Page, key: E2EUserKey | { email: string; password: string }, opts: { next?: string } = {}) {
  const u = typeof key === "string" ? user(key) : key;
  await page.goto(opts.next ? `/login?next=${encodeURIComponent(opts.next)}` : "/login");
  await page.getByLabel("Email").fill(u.email);
  await page.getByLabel("Contraseña").fill(u.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Página nueva (context propio) con la sesión iniciada. */
export async function loggedInPage(browser: Browser, key: E2EUserKey): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, key);
  return page;
}

/** Acepta el `<ConfirmDialog>` abierto tocando el botón de confirmación. */
export async function confirmDialog(page: Page, confirmLabel: string | RegExp) {
  const dialog = page.getByRole("dialog").filter({ has: page.getByRole("button", { name: confirmLabel }) });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: confirmLabel }).click();
}

// --- Fechas en la zona de los usuarios del seed ---

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const DAY_MS = 86_400_000;

export function todayLocal(): string {
  return fmt.format(new Date());
}
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  return new Date(d.getTime() + n * DAY_MS).toISOString().slice(0, 10);
}
/** Lunes de la semana de `date` (semanas lunes a domingo). */
export function mondayOf(date: string): string {
  const dow = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lunes
  return addDays(date, -dow);
}

/** Puntos de un día con las reglas estándar (D1): 10 + round(10 × log2(1 + min/30)). */
export function dayPoints(minutes: number): number {
  return 10 + Math.round(10 * Math.log2(1 + Math.min(minutes, 240) / 30));
}

/** Imagen JPEG chica para las fotos (fixture). */
export const PHOTO_PATH = `${__dirname}/photo.jpg`;

/**
 * Recorre el festejo post-entrenamiento ("Continuar" hasta "Ver resumen") y devuelve los títulos de cada
 * pantalla, en orden. Después queda el diálogo "Resultado del entrenamiento".
 */
export async function passCelebration(page: Page): Promise<string[]> {
  const dialog = page.getByRole("dialog", { name: "Festejo del entrenamiento" });
  await expect(dialog.getByRole("heading", { name: "¡Entrenamiento completo!" })).toBeVisible({ timeout: 30_000 });
  const titles: string[] = [];
  for (let i = 0; i < 15; i++) {
    titles.push((await dialog.getByRole("heading", { level: 2 }).innerText()).trim());
    const next = dialog.getByRole("button", { name: /^(Continuar|Ver resumen)$/ });
    const label = (await next.innerText()).trim();
    await next.click();
    if (label === "Ver resumen") return titles;
  }
  throw new Error(`El festejo no terminó: ${titles.join(" → ")}`);
}

/** Registra un entrenamiento sin ejercicios desde /workout/new pasa el festejo y espera el resultado. */
export async function logQuickWorkout(page: Page, opts: { category: string; minutes: number; date?: string }) {
  await page.goto("/workout/new");
  await page.getByRole("radio", { name: opts.category, exact: true }).click();
  if (opts.date) await page.getByLabel("Fecha").fill(opts.date);
  await page.getByLabel("Duración en minutos").fill(String(opts.minutes));
  await page.getByRole("button", { name: "Guardar entrenamiento" }).click();
  await passCelebration(page);
  const result = page.getByRole("dialog", { name: "Resultado del entrenamiento" });
  await expect(result.getByRole("heading", { name: "¡Bien ahí! 💪" })).toBeVisible();
  return result;
}
