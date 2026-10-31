import { expect, test } from "@playwright/test";
import { confirmDialog, logQuickWorkout, loggedInPage, todayLocal, user } from "./fixtures/helpers";

test("seguir y dejar de seguir; perfil ajeno sin email", async ({ browser }) => {
  const sofi = await loggedInPage(browser, "sofi");
  const tomi = user("tomi");

  await sofi.goto(`/u/${tomi.id}`);
  await expect(sofi.getByRole("heading", { name: tomi.name })).toBeVisible();
  await sofi.getByRole("button", { name: "Seguir", exact: true }).click();
  await expect(sofi.getByRole("button", { name: "Siguiendo ✓" })).toBeVisible();
  await sofi.reload();
  await expect(sofi.getByRole("button", { name: "Siguiendo ✓" })).toBeVisible();

  await sofi.getByRole("button", { name: "Siguiendo ✓" }).click();
  await confirmDialog(sofi, "Dejar de seguir");
  await expect(sofi.getByRole("button", { name: "Seguir", exact: true })).toBeVisible();
  await sofi.reload();
  await expect(sofi.getByRole("button", { name: "Seguir", exact: true })).toBeVisible();

  // El email no aparece ni en la página ni en el payload RSC que viaja al cliente.
  await expect(sofi.getByText(tomi.email)).toHaveCount(0);
  const html = await (await sofi.request.get(`/u/${tomi.id}`)).text();
  expect(html).not.toContain(tomi.email);
  const rsc = await (await sofi.request.get(`/u/${tomi.id}`, { headers: { RSC: "1" } })).text();
  expect(rsc).not.toContain(tomi.email);
  expect(rsc).not.toContain("passwordHash");

  await sofi.context().close();
});

test("notificación \"fue el primero en arrancar la semana\" en la campana del otro", async ({ browser }) => {
  const sofi = await loggedInPage(browser, "sofi");
  await logQuickWorkout(sofi, { category: "Running", minutes: 30, date: todayLocal() });
  await sofi.context().close();

  const tomi = await loggedInPage(browser, "tomi");
  await tomi.goto("/home");
  const bell = tomi.getByRole("button", { name: /^Notificaciones \(\d+ sin leer\)$/ });
  await expect(bell).toBeVisible();
  await bell.click();
  const sheet = tomi.getByRole("dialog", { name: "Notificaciones" });
  await expect(sheet.getByText(/Sofi E2E fue el primero en arrancar la semana en Social E2E/)).toBeVisible();

  // También en /notifications.
  await tomi.goto("/notifications");
  await expect(tomi.getByText(/Sofi E2E fue el primero en arrancar la semana en Social E2E/)).toBeVisible();
  await tomi.context().close();
});
