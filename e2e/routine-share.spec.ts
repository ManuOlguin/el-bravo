import { expect, test } from "@playwright/test";
import { login } from "./fixtures/helpers";

test("importar una rutina en texto: encuentra los conocidos, crea el nuevo al guardar", async ({ page }) => {
  // Nombre único: el test no depende de otras corridas ni de otros specs.
  const name = `Rutina de Juan ${Date.now()}`;
  // El ejercicio nuevo también se crea (como propio de sofi) al guardar: nombre único para que una
  // segunda corrida sin re-sembrar no lo encuentre. Sufijo aleatorio (no numérico correlativo) para
  // que no caiga dentro de la tolerancia de 1-2 letras del matching contra el de la corrida anterior.
  const newExercise = `Remo en máquina Hammer ${Math.random().toString(36).slice(2, 10)}`;

  await login(page, "sofi");
  await page.goto("/routines/import");
  await page.getByLabel("Rutina en texto").fill(`🏋️ ${name}
Press de banca — 4×8 @ 60 kg · desc 90s
Plancha — 3×45s
${newExercise} — 3×12`);
  await page.getByRole("button", { name: "Leer rutina" }).click();

  const list = page.getByRole("list", { name: "Ejercicios importados" });
  await expect(list.getByText("✓ Encontrado")).toHaveCount(2);
  await expect(list.getByText("✨ Nuevo")).toHaveCount(1);
  await page.getByRole("button", { name: "Continuar" }).click();

  await expect(page.getByRole("heading", { name: "Revisá la rutina importada" })).toBeVisible();
  await expect(page.getByText("Nuevo", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Crear rutina" }).click();

  await expect(page).toHaveURL(/\/routines$/);
  const card = page.getByRole("listitem").filter({ hasText: name });
  await expect(card).toBeVisible();
  await expect(card).toContainText("3 ejercicios");
  await expect(card).toContainText("10 series");
});

test("la revisión avisa de líneas sin leer, deja cargar músculos y frena nombres que ya existen", async ({ page }) => {
  await login(page, "sofi");
  await page.goto("/routines/import");
  await page.getByLabel("Rutina en texto").fill(`Rutina de prueba
Press de banca — 4×8 @ 60 kg
Remo Hammer review — 3×12
Entreno 18:00`);
  await page.getByRole("button", { name: "Leer rutina" }).click();

  await expect(page.getByText("No pudimos leer estas líneas")).toBeVisible();
  await expect(page.getByText("«Entreno 18:00»")).toBeVisible();

  const cont = page.getByRole("button", { name: "Continuar" });
  await page.getByRole("button", { name: /Músculos y equipo/ }).click();
  await page.getByLabel(/^Equipo de/).selectOption("machine");
  await page.getByLabel("Agregar músculo").selectOption({ index: 1 });
  await expect(page.getByText("Suma: 100 %")).toBeVisible();
  await expect(cont).toBeEnabled();

  // Renombrar a un ejercicio que ya existe: se frena con un aviso.
  const name = page.getByLabel(/^Nombre del ejercicio nuevo/);
  await name.fill("Plancha");
  await expect(page.getByText(/Ya existe «Plancha»/)).toBeVisible();
  await expect(cont).toBeDisabled();
  await name.fill("Remo Hammer review");
  await expect(cont).toBeEnabled();
});

test("compartir una rutina muestra el texto El Bravo para copiar", async ({ page }) => {
  await login(page, "ana");
  await page.goto("/routines");

  const card = page.getByRole("listitem").filter({ hasText: "Empuje E2E" });
  await card.getByRole("button", { name: "Compartir rutina" }).click();

  const sheet = page.getByRole("dialog", { name: "Compartir rutina" });
  const text = sheet.locator("pre");
  await expect(text).toBeVisible();
  await expect(text).toContainText(/^🏋️ Empuje E2E/);
  await expect(text).toContainText("Press de Banca — ");
  await expect(text).toContainText("Sentadillas — ");
  await expect(sheet.getByRole("button", { name: "Copiar" })).toBeVisible();
});

test("sin OPENAI_API_KEY, un texto libre no ofrece leer con IA", async ({ page }) => {
  await login(page, "sofi");
  await page.goto("/routines/import");
  await page.getByLabel("Rutina en texto").fill(`Día 1: hacé 4 series de banca pesada, después remo y terminá con abs.
Descansá bien entre series.`);
  await page.getByRole("button", { name: "Leer rutina" }).click();
  await expect(page.getByText(/No pudimos leer la rutina/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Leer con IA" })).toHaveCount(0);
  await expect(page.getByText(/se envía a OpenAI/)).toHaveCount(0);
});
