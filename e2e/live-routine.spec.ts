import { expect, test, type Page } from "@playwright/test";
import { confirmDialog, login } from "./fixtures/helpers";

const block = (page: Page, name: string) =>
  page.getByRole("region", { name: "Ejercicios" }).locator("section").filter({ has: page.getByRole("heading", { name, exact: true, level: 3 }) });
const liveBlock = (page: Page, name: string) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true, level: 3 }) });

async function addExercise(page: Page, query: string, name: RegExp) {
  await page.getByRole("button", { name: "Agregar ejercicios", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Agregar ejercicios" });
  await picker.getByLabel("Buscar ejercicio").fill(query);
  await picker.getByRole("button", { name }).first().click();
  await picker.getByRole("button", { name: "Agregar (1)" }).click();
  await expect(picker).toBeHidden();
}

test("rutina con un ejercicio por tiempo: en vivo, retomar, terminar y actualizar la rutina", async ({ page }) => {
  await login(page, "rita");

  // Crear la rutina.
  await page.goto("/routines");
  await page.getByRole("link", { name: "Crear rutina" }).click();
  await expect(page).toHaveURL(/\/routines\/new$/);
  await page.getByLabel("Nombre").fill("Core E2E");
  await addExercise(page, "plancha", /^Plancha(?! Lateral)/);
  const plank = block(page, "Plancha");
  await expect(plank.getByLabel("Segundos de la serie 1", { exact: true })).toBeVisible();
  await plank.getByRole("button", { name: "Serie", exact: true }).click();
  await plank.getByLabel("Segundos de la serie 1", { exact: true }).fill("45");
  await plank.getByLabel("Segundos de la serie 2", { exact: true }).fill("60");

  await addExercise(page, "press de banca", /^Press de Banca/);
  const bench = block(page, "Press de Banca");
  for (const n of [1, 2, 3]) {
    await bench.getByLabel(`Kilos de la serie ${n}`, { exact: true }).fill("50");
    await bench.getByLabel(`Repeticiones de la serie ${n}`, { exact: true }).fill("10");
  }
  await page.getByRole("button", { name: "Crear rutina" }).click();
  await expect(page).toHaveURL(/\/routines$/);
  const card = page.getByRole("listitem").filter({ hasText: "Core E2E" });
  await expect(card).toContainText("2 ejercicios · 5 series");

  // Empezar en vivo y tildar 2 series.
  await card.getByRole("link", { name: "Empezar" }).click();
  await expect(page).toHaveURL(/\/routines\/[a-z0-9]+\/live$/);
  const liveUrl = page.url();
  const routineId = liveUrl.split("/").at(-2)!;
  await expect(page.getByText("0/5 series")).toBeVisible();
  await liveBlock(page, "Plancha").getByRole("button", { name: "Marcar serie 1 como hecha" }).click();
  await liveBlock(page, "Press de Banca").getByLabel("Kilos de la serie 1", { exact: true }).fill("55");
  await liveBlock(page, "Press de Banca").getByRole("button", { name: "Marcar serie 1 como hecha" }).click();
  await expect(page.getByText(/^2\/5 series/)).toBeVisible();

  // Recargar: ofrece retomar y conserva lo tildado.
  await page.reload();
  await expect(page.getByText("Tenés un entrenamiento en curso")).toBeVisible();
  await page.getByRole("button", { name: "Retomar entrenamiento" }).click();
  await expect(page.getByText(/^2\/5 series/)).toBeVisible();
  await expect(liveBlock(page, "Press de Banca").getByLabel("Kilos de la serie 1", { exact: true })).toHaveValue("55");
  await liveBlock(page, "Press de Banca").getByRole("button", { name: "Marcar serie 2 como hecha" }).click();
  await expect(page.getByText(/^3\/5 series/)).toBeVisible();

  // Terminar: 3 de 5 series, categoría Fuerza por defecto.
  await page.getByRole("button", { name: "Terminar" }).click();
  await confirmDialog(page, "Terminar");
  const sheet = page.getByRole("dialog", { name: "¿Qué hiciste?" });
  await expect(sheet.getByRole("radio", { name: "Fuerza" })).toHaveAttribute("aria-checked", "true");
  await sheet.getByRole("button", { name: "Guardar entrenamiento" }).click();
  const result = page.getByRole("dialog", { name: "Resultado del entrenamiento" });
  await expect(result.getByRole("heading", { name: "¡Bien ahí! 💪" })).toBeVisible({ timeout: 30_000 });
  await expect(result.getByText("Series", { exact: true }).locator("..")).toContainText("3");

  // Actualizar la rutina con lo que se hizo.
  await result.getByRole("button", { name: "Actualizar la rutina con estos pesos" }).click();
  await expect(result.getByRole("button", { name: "Rutina actualizada ✓" })).toBeVisible();

  await page.goto(`/routines/${routineId}/edit`);
  await expect(block(page, "Press de Banca").getByLabel("Kilos de la serie 1", { exact: true })).toHaveValue("55");
  await expect(block(page, "Plancha").getByLabel("Segundos de la serie 1", { exact: true })).toHaveValue("45");

  // Volver a abrir el modo en vivo ya no ofrece retomar (el borrador se limpió al guardar).
  await page.goto(liveUrl);
  await expect(page.getByText(/^0\/\d+ series/)).toBeVisible();
  await expect(page.getByText("Tenés un entrenamiento en curso")).toHaveCount(0);
});
