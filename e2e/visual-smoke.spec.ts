import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { creds, login, user } from "./fixtures/helpers";

/** Screenshot de página completa adjunto al reporte + chequeo de scroll horizontal y errores de JS. */
async function check(page: Page, testInfo: TestInfo, path: string, name: string) {
  const errors: string[] = [];
  const onError = (e: Error) => errors.push(e.message);
  page.on("pageerror", onError);
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main, body").first()).toBeVisible();
  await expect(page.getByText("No encontramos esta página")).toHaveCount(0);
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect.soft(scrollWidth, `${name}: scroll horizontal (${scrollWidth} > ${innerWidth})`).toBeLessThanOrEqual(innerWidth);
  const file = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
  page.off("pageerror", onError);
  expect.soft(errors, `${name}: errores de JS`).toEqual([]);
}

test("páginas públicas", async ({ page }, testInfo) => {
  await check(page, testInfo, "/login", "login");
  await check(page, testInfo, "/register", "register");
});

test("páginas principales con sesión", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const { bravos } = creds().groups;
  await login(page, "ana");
  const pages: [string, string][] = [
    ["/home", "home"],
    ["/groups", "groups"],
    ["/groups/new", "groups-new"],
    [`/group/${bravos.id}`, "group"],
    [`/group/${bravos.id}/settings`, "group-settings"],
    [`/group/${bravos.id}/season/${bravos.seasonId}`, "season"],
    [`/group/${bravos.id}/season/${bravos.seasonId}/edit`, "season-edit"],
    [`/group/${bravos.id}/season/new`, "season-new"],
    ["/workout/new", "workout-new"],
    ["/routines", "routines"],
    ["/routines/new", "routines-new"],
    [`/routines/${creds().routines.anaPush}`, "routine-detail"],
    [`/routines/${creds().routines.anaPush}/live`, "routine-live"],
    ["/stats", "stats"],
    ["/profile", "profile"],
    [`/u/${user("beto").id}`, "user-profile"],
    [`/u/${user("beto").id}/followers`, "user-followers"],
    ["/u", "user-search"],
    ["/notifications", "notifications"],
    ["/settings", "settings"],
    ["/settings/profile", "settings-profile"],
    ["/settings/password", "settings-password"],
    ["/settings/notifications", "settings-notifications"],
  ];
  for (const [path, name] of pages) await check(page, testInfo, path, name);
});
