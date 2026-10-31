import { expect, test, type Page } from "@playwright/test";
import { addDays, confirmDialog, creds, dayPoints, logQuickWorkout, loggedInPage, mondayOf, todayLocal } from "./fixtures/helpers";

/** Fila del ranking en vivo de un usuario (vista de otro miembro). */
const standingRow = (page: Page, name: string) => page.getByRole("listitem").filter({ has: page.getByRole("link", { name, exact: true }) });

test("temporada: crear con sliders y premios, unirse, ranking D1, editar objetivo y publicar a mano", async ({ browser }) => {
  test.setTimeout(150_000);
  const groupId = creds().groups.temporadas.id;
  const admin = await loggedInPage(browser, "sara");
  const member = await loggedInPage(browser, "nico");

  // La temporada arranca el lunes pasado: la semana pasada es completa y ya terminó.
  const start = addDays(mondayOf(todayLocal()), -7);
  const end = addDays(start, 27);

  // --- El admin crea la temporada (wizard en pasos en mobile) ---
  await admin.goto(`/group/${groupId}/season/new`);
  await admin.getByLabel("Nombre").fill("Liga E2E");
  await admin.getByLabel("Empieza", { exact: true }).fill(start);
  await admin.getByLabel("Termina", { exact: true }).fill(end);
  await admin.getByRole("tab", { name: "Lo decide el admin" }).click();

  await admin.getByRole("tab", { name: "Actividades" }).click();
  // Slider: los minutos de fuerza valen el doble.
  await admin.getByLabel("Peso de Fuerza").fill("2");

  await admin.getByRole("tab", { name: "Premios" }).click();
  const mostDays = admin.getByRole("button", { name: /El más constante/ });
  if ((await mostDays.getAttribute("aria-pressed")) !== "true") await mostDays.click();
  await admin.locator("#award-bonus-most_days").fill("10");

  await admin.getByRole("button", { name: "Crear temporada" }).click();
  await admin.waitForURL(/\/season\/(?!new)[a-z0-9]+$/);
  const seasonUrl = admin.url();
  await expect(admin.getByRole("heading", { name: "Liga E2E" })).toBeVisible();

  // --- El miembro se une ---
  await member.goto(seasonUrl);
  await expect(member.getByText("No estás participando")).toBeVisible();
  await member.getByRole("button", { name: "Unirme a la temporada" }).click();
  await expect(member.getByText("0 pts · 0 días")).toBeVisible();

  // --- 3 entrenamientos de fuerza de 30 min la semana pasada (lun, mar, mié) ---
  for (const d of [0, 1, 2]) await logQuickWorkout(member, { category: "Fuerza", minutes: 30, date: addDays(start, d) });

  // D1: 30 min × peso 2 = 60 min efectivos por día → 3 días + bonus de semana cumplida (+20), racha 1 (+0).
  const expected = 3 * dayPoints(60) + 20;
  await member.goto(seasonUrl);
  await expect(member.getByText(`${expected} pts · 3 días`)).toBeVisible();
  await expect(member.getByText("1 semana cumplida")).toBeVisible();
  await admin.reload();
  const betoRow = standingRow(admin, "Nico E2E");
  await expect(betoRow).toContainText(String(expected));
  await expect(betoRow).toContainText("🥇");

  // --- Editar el objetivo (3 → 4 días) recalcula: la semana ya no se cumple ---
  await admin.getByRole("link", { name: "Editar" }).click();
  await admin.waitForURL(/\/edit$/);
  await admin.getByLabel("Objetivo semanal").fill("4");
  await admin.getByRole("button", { name: "Guardar cambios" }).click();
  await admin.waitForURL(seasonUrl);
  const recalculated = 3 * dayPoints(60);
  await expect(standingRow(admin, "Nico E2E")).toContainText(String(recalculated));
  await member.reload();
  await expect(member.getByText(`${recalculated} pts · 3 días`)).toBeVisible();

  // --- Cerrar en modo manual: el miembro espera, el admin publica ---
  await admin.getByRole("button", { name: "Cerrar temporada ahora" }).click();
  await confirmDialog(admin, "Cerrar temporada");
  await expect(admin.getByRole("button", { name: "Publicar resultados 🎉" })).toBeVisible();
  await member.reload();
  await expect(member.getByText("Esperando que Sara E2E publique los resultados…")).toBeVisible();
  await expect(member.getByRole("list", { name: "Podio" })).toHaveCount(0);

  await admin.getByRole("button", { name: "Publicar resultados 🎉" }).click();
  await confirmDialog(admin, "Publicar");
  await expect(admin.getByRole("button", { name: "Reabrir temporada" })).toBeVisible();

  // El miembro ve el reveal (premio → podio) y después todos los resultados.
  await member.reload();
  await expect(member.getByText("Premio 1 de 1")).toBeVisible();
  await expect(member.getByRole("button", { name: "Revelar el siguiente" })).toContainText("El más constante");
  await member.getByRole("button", { name: "Revelar el siguiente" }).click();
  const final = recalculated + 10; // + premio "El más constante"
  await expect(member.getByRole("listitem", { name: `Puesto 1: Nico E2E, ${final} puntos` })).toBeVisible();
  await member.getByRole("button", { name: "Ver todos los resultados" }).click();
  await expect(member.getByRole("heading", { name: "Premios" })).toBeVisible();
  await expect(member.getByRole("list", { name: "Podio" })).toBeVisible();

  await admin.context().close();
  await member.context().close();
});
