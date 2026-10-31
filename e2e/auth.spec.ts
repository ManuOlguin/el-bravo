import { expect, test } from "@playwright/test";
import { confirmDialog, login, user } from "./fixtures/helpers";

test.describe("auth", () => {
  test("registro y logout", async ({ page }) => {
    const email = `nuevo-${Date.now()}@e2e.test`;
    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Nuevo E2E");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill("una-clave-larga-e2e");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page).toHaveURL(/\/home$/);

    await page.goto("/settings");
    await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
    await confirmDialog(page, "Cerrar sesión");
    await expect(page).toHaveURL(/\/login/);

    // Sin sesión, una página privada manda al login con `next`.
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login\?next=%2Fhome/);
  });

  test("registro con email repetido muestra el error del campo", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Nombre").fill("Repetido");
    await page.getByLabel("Email").fill(user("ana").email);
    await page.getByLabel("Contraseña").fill("una-clave-larga-e2e");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Ya hay una cuenta con ese email.")).toBeVisible();
  });

  test("login con ?next= vuelve a la página pedida", async ({ page }) => {
    await page.goto("/routines");
    await expect(page).toHaveURL(/\/login\?next=%2Froutines/);
    const u = user("ana");
    await page.getByLabel("Email").fill(u.email);
    await page.getByLabel("Contraseña").fill(u.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/routines$/);
    await expect(page.getByRole("heading", { name: "Rutinas" })).toBeVisible();
  });

  test("next externo se ignora (open redirect)", async ({ page }) => {
    await login(page, "ana", { next: "/\t/evil.example" });
    await expect(page).toHaveURL(/localhost:\d+\/home$/);
  });

  test("bloqueo después de 5 intentos fallidos", async ({ page }) => {
    const u = user("lock");
    await page.goto("/login");
    await page.getByLabel("Email").fill(u.email);
    const alert = page.locator("form").getByRole("alert");
    for (let i = 0; i < 5; i++) {
      await page.getByLabel("Contraseña").fill(`mala-${i}-clave`);
      await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), page.getByRole("button", { name: "Ingresar" }).click()]);
      await expect(alert).toHaveText("Email o contraseña incorrectos.");
    }
    // El sexto intento queda bloqueado aunque la contraseña sea la correcta.
    await page.getByLabel("Contraseña").fill(u.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(alert).toContainText("Demasiados intentos");
    await expect(page).toHaveURL(/\/login/);
  });

  test("cambiar la contraseña cierra la otra sesión", async ({ browser }) => {
    const u = user("pass");
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    await login(a, "pass");
    await login(b, "pass");

    const newPassword = `${u.password}-nueva`;
    await a.goto("/settings/password");
    await a.getByLabel("Contraseña actual").fill(u.password);
    await a.getByLabel("Contraseña nueva", { exact: true }).fill(newPassword);
    await a.getByLabel("Repetí la contraseña nueva").fill(newPassword);
    await a.getByRole("button", { name: "Cambiar contraseña" }).click();
    await expect(a.getByText("Contraseña actualizada")).toBeVisible();

    // La sesión que cambió la contraseña sigue; la otra queda revocada.
    await a.goto("/home");
    await expect(a).toHaveURL(/\/home$/);
    await b.goto("/home");
    await expect(b).toHaveURL(/\/login\?next=%2Fhome&expired=1/);
    await expect(b.getByText("Tu sesión se cerró")).toBeVisible();

    // La contraseña vieja ya no sirve y la nueva sí.
    await b.getByLabel("Email").fill(u.email);
    await b.getByLabel("Contraseña").fill(u.password);
    await b.getByRole("button", { name: "Ingresar" }).click();
    await expect(b.locator("form").getByRole("alert")).toHaveText("Email o contraseña incorrectos.");
    await b.getByLabel("Contraseña").fill(newPassword);
    await b.getByRole("button", { name: "Ingresar" }).click();
    await expect(b).toHaveURL(/\/home$/);

    await ctxA.close();
    await ctxB.close();
  });
});
