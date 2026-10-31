import { expect, test } from "@playwright/test";
import { creds, loggedInPage, user } from "./fixtures/helpers";

test("rutina pública: la autora la publica, otro la ve en su perfil y la copia", async ({ browser }) => {
  const vale = user("vale");
  const routineId = creds().routines.valeBack;
  // Nombre único por corrida: la copia de Juli conserva el nombre, así que una segunda corrida sobre la
  // misma DB (E2E_SKIP_SEED=1) no confunde su copia con la de la corrida anterior.
  const name = `Espalda de Vale ${Date.now()}`;

  // Punto de partida fijo: la rutina de Vale queda PRIVADA y con el nombre único (también si una corrida
  // anterior la dejó pública).
  const author = await loggedInPage(browser, "vale");
  await author.goto(`/routines/${routineId}/edit`);
  await author.getByLabel("Nombre").fill(name);
  await author.getByRole("tab", { name: "Privada" }).click();
  await author.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(author).toHaveURL(/\/routines$/);
  await expect(author.getByRole("listitem").filter({ hasText: name })).toBeVisible();

  // Privada: no aparece en el perfil y su link da 404 (nunca 403).
  const juli = await loggedInPage(browser, "juli");
  await juli.goto(`/u/${vale.id}`);
  await expect(juli.getByRole("heading", { name: vale.name })).toBeVisible();
  await expect(juli.getByRole("region", { name: "Rutinas" })).toHaveCount(0);
  await juli.goto(`/routines/${routineId}`);
  await expect(juli.getByText("No encontramos esta página")).toBeVisible();

  // Vale la hace pública desde el editor.
  await author.goto("/routines");
  const card = author.getByRole("listitem").filter({ hasText: name });
  await card.getByRole("link", { name: "Editar" }).click();
  await author.getByRole("tab", { name: "Pública" }).click();
  await author.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(author).toHaveURL(/\/routines$/);
  await expect(card.getByText("Pública", { exact: true })).toBeVisible();
  await author.context().close();

  // Juli la ve en el perfil de Vale y la abre.
  await juli.goto(`/u/${vale.id}`);
  await juli.getByRole("region", { name: "Rutinas" }).getByRole("link", { name: new RegExp(name) }).click();
  await expect(juli).toHaveURL(new RegExp(`/routines/${routineId}$`));
  await expect(juli.getByRole("heading", { name, level: 1 })).toBeVisible();
  await expect(juli.getByRole("link", { name: vale.name, exact: true })).toBeVisible();
  await expect(juli.getByRole("heading", { name: "Remo Vale E2E", level: 3 })).toBeVisible();

  // Compartir abre el diálogo con el texto de la rutina (sin aserciones sobre el portapapeles).
  await juli.getByRole("button", { name: "Compartir rutina" }).click();
  const share = juli.getByRole("dialog", { name: "Compartir rutina" });
  await expect(share).toContainText(name);
  await expect(share).toContainText("Remo Vale E2E");
  await juli.keyboard.press("Escape");
  await expect(share).toBeHidden();

  // El email de la autora no viaja ni en el HTML ni en el payload RSC. Control positivo: primero se
  // comprueba que la respuesta ES la página de la rutina (200 y con su nombre).
  for (const headers of [undefined, { RSC: "1" }]) {
    const res = await juli.request.get(`/routines/${routineId}`, headers ? { headers } : undefined);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain(name);
    expect(body).not.toContain(vale.email);
  }

  // Copiar: queda en sus rutinas, privada, con la atribución.
  await juli.getByRole("button", { name: "Copiar a mis rutinas" }).click();
  await expect(juli).toHaveURL(/\/routines$/);
  const copy = juli.getByRole("listitem").filter({ hasText: name });
  await expect(copy).toHaveCount(1);
  await expect(copy).toContainText("Basada en la rutina de Vale E2E");
  await expect(copy).toContainText("2 ejercicios · 5 series");
  await expect(copy.getByText("Pública", { exact: true })).toHaveCount(0);

  // El ejercicio propio de Vale se copió como de Juli: la copia se guarda sin "Alguno de los ejercicios ya no existe".
  await copy.getByRole("link", { name: "Editar" }).click();
  // Esperar al editor: mientras dura la transición sigue montada la lista (con las copias de otras corridas).
  await expect(juli.getByRole("heading", { name: "Editar rutina", level: 1 })).toBeVisible();
  await expect(juli.getByText("Basada en la rutina de Vale E2E")).toBeVisible();
  await expect(juli.getByRole("heading", { name: "Remo Vale E2E", level: 3 })).toBeVisible();
  await juli.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(juli).toHaveURL(/\/routines$/);
  await juli.context().close();
});
