import { expect, test, type Page } from "@playwright/test";
import { login, passCelebration } from "./fixtures/helpers";

async function fillRun(page: Page) {
  await page.goto("/workout/new");
  await page.getByRole("radio", { name: "Running", exact: true }).click();
  await page.getByLabel("Duración en minutos").fill("30");
}

/** Cantidad de entrenamientos en las stats del perfil propio. */
async function workoutCount(page: Page) {
  await page.goto("/profile");
  const stats = page.getByRole("region", { name: "Estadísticas" });
  // El primer dato es "Entrenamientos" (la etiqueta lleva un guion blando).
  return stats.locator("dd").first();
}

test.describe.configure({ mode: "serial" });

test("sin conexión al guardar: muestra el error y al reintentar online queda 1 solo entrenamiento", async ({ page, context }) => {
  await login(page, "olga");
  await fillRun(page);

  await context.setOffline(true);
  await page.getByRole("button", { name: "Guardar entrenamiento" }).click();
  const dialog = page.getByRole("dialog", { name: "Guardando tu entrenamiento" });
  await expect(dialog.getByRole("heading", { name: "No se pudo guardar" })).toBeVisible();
  await expect(dialog.getByRole("alert")).toContainText("Revisá tu conexión");

  await context.setOffline(false);
  await dialog.getByRole("button", { name: "Reintentar" }).click();
  await passCelebration(page);
  const result = page.getByRole("dialog", { name: "Resultado del entrenamiento" });
  await expect(result.getByRole("heading", { name: "¡Bien ahí! 💪" })).toBeVisible();

  await expect(await workoutCount(page)).toHaveText("1");
});

test("se pierde la respuesta del servidor: el reintento no duplica (mismo clientRequestId)", async ({ page }) => {
  await login(page, "olga");
  await fillRun(page);

  // La acción llega al servidor y se guarda, pero la respuesta no vuelve al navegador.
  let dropped = false;
  await page.route("**/workout/new", async (route) => {
    if (route.request().method() !== "POST" || dropped) return route.fallback();
    dropped = true;
    await route.fetch(); // el servidor procesa el POST
    await route.abort("connectionreset");
  });

  await page.getByRole("button", { name: "Guardar entrenamiento" }).click();
  const dialog = page.getByRole("dialog", { name: "Guardando tu entrenamiento" });
  await expect(dialog.getByRole("heading", { name: "No se pudo guardar" })).toBeVisible();
  expect(dropped).toBe(true);

  await dialog.getByRole("button", { name: "Reintentar" }).click();
  const result = page.getByRole("dialog", { name: "Resultado del entrenamiento" });
  await expect(result.getByRole("heading", { name: "Ya estaba guardado 👌" })).toBeVisible({ timeout: 30_000 });
  await expect(result.getByText("El primer intento había llegado: no se duplicó.")).toBeVisible();

  await expect(await workoutCount(page)).toHaveText("2");
});
