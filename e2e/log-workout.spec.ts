import { expect, test, type Page } from "@playwright/test";
import { PHOTO_PATH, confirmDialog, creds, dayPoints, login } from "./fixtures/helpers";

/** Bloque de un ejercicio en el editor (Card con el nombre como h3). */
const exerciseBlock = (page: Page, name: string) =>
  page.getByRole("region", { name: "Ejercicios" }).locator("section").filter({ has: page.getByRole("heading", { name, exact: true, level: 3 }) });

async function fillSet(page: Page, exercise: string, n: number, kg: string, reps: string) {
  const block = exerciseBlock(page, exercise);
  await block.getByLabel(`Kilos de la serie ${n}`, { exact: true }).fill(kg);
  await block.getByLabel(`Repeticiones de la serie ${n}`, { exact: true }).fill(reps);
}

/** Puntos y días de "mi" tarjeta en la página de la temporada. */
async function mySeasonLine(page: Page) {
  const { bravos } = creds().groups;
  await page.goto(`/group/${bravos.id}/season/${bravos.seasonId}`);
  return page.getByText(/^\d+ pts · \d+ días?$/).first();
}

test("registrar fuerza con 2 ejercicios y 2 fotos, ver, editar y borrar", async ({ page }) => {
  await login(page, "lucas");
  await page.goto("/workout/new");

  await page.getByRole("radio", { name: "Fuerza" }).click();
  await page.getByRole("button", { name: "Agregar ejercicios", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Agregar ejercicios" });
  await picker.getByLabel("Buscar ejercicio").fill("press de banca");
  await picker.getByRole("button", { name: /^Press de Banca/ }).first().click();
  await picker.getByLabel("Buscar ejercicio").fill("sentadillas");
  await picker.getByRole("button", { name: /^Sentadillas/ }).first().click();
  await picker.getByRole("button", { name: "Agregar (2)" }).click();
  await expect(picker).toBeHidden();

  await fillSet(page, "Press de Banca", 1, "60", "8");
  await fillSet(page, "Press de Banca", 2, "62,5", "6");
  await fillSet(page, "Sentadillas", 1, "80", "10");

  await page.getByRole("button", { name: "45 min" }).click();
  await page.locator('input[type="file"]').setInputFiles([PHOTO_PATH, PHOTO_PATH]);
  await expect(page.getByRole("button", { name: "Quitar foto" })).toHaveCount(2);

  await page.getByRole("button", { name: "Guardar entrenamiento" }).click();
  const result = page.getByRole("dialog", { name: "Resultado del entrenamiento" });
  await expect(result.getByRole("heading", { name: "¡Bien ahí! 💪" })).toBeVisible({ timeout: 30_000 });
  // Puntos: 45 min el primer día de la semana en la temporada activa del grupo.
  const points = result.getByRole("region", { name: "Puntos" });
  await expect(points).toContainText(`+${dayPoints(45)} pts`);
  await expect(points).toContainText("Temporada E2E");
  // Solo las insignias afectadas: fuerza (Gym Rat) sí, running (Corre Forrest) no.
  const badges = result.getByRole("region", { name: "Insignias" });
  await expect(badges).toContainText("Gym Rat");
  await expect(badges).toContainText("El Persistente");
  await expect(badges).not.toContainText("Corre Forrest");
  await expect(result.getByText(/no se subi/)).toHaveCount(0);

  // Detalle: series y fotos.
  await result.getByRole("link", { name: "Ver entrenamiento" }).click();
  await page.waitForURL((u) => /^\/workout\/[a-z0-9]+$/.test(u.pathname) && u.pathname !== "/workout/new");
  const workoutUrl = page.url();
  const exercises = page.getByRole("region", { name: "Ejercicios" });
  await expect(exercises).toContainText("Press de Banca");
  await expect(exercises).toContainText("60×8");
  await expect(exercises).toContainText("62,5×6");
  await expect(exercises).toContainText("80×10");
  await expect(page.locator(`img[src*="/activities/"]`)).toHaveCount(2);
  await expect(page.getByRole("region", { name: "Puntos" })).toContainText(`+${dayPoints(45)}`);
  await expect(await mySeasonLine(page)).toHaveText(`${dayPoints(45)} pts · 1 día`);

  // Editar: 90 min recalcula los puntos.
  await page.goto(`${workoutUrl}/edit`);
  await page.getByRole("button", { name: "90 min" }).click();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  const edited = page.getByRole("dialog", { name: "Resultado del entrenamiento" });
  await expect(edited.getByRole("heading", { name: "Entrenamiento actualizado" })).toBeVisible({ timeout: 30_000 });
  await expect(edited.getByRole("region", { name: "Puntos" })).toContainText(`+${dayPoints(90)} pts`);
  await expect(await mySeasonLine(page)).toHaveText(`${dayPoints(90)} pts · 1 día`);

  // Borrar: vuelve al inicio y la temporada queda en 0.
  await page.goto(workoutUrl);
  await page.getByRole("button", { name: "Borrar" }).click();
  await confirmDialog(page, "Borrar");
  await expect(page).toHaveURL(/\/home$/);
  await expect(await mySeasonLine(page)).toHaveText("0 pts · 0 días");
  // (Con app/loading.tsx la respuesta se streamea: el 404 llega como 200 con la página de "no encontrado".)
  await page.goto(workoutUrl);
  await expect(page.getByText("No encontramos esta página")).toBeVisible();
});
