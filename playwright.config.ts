import { defineConfig } from "@playwright/test";
import { E2E_BASE_URL, E2E_DATABASE_URL, E2E_PORT } from "./e2e/env";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

/**
 * E2E de flujos críticos (W3 Task 1). `npm run test:e2e`.
 * - Server de producción (`next build` + `next start`) en E2E_PORT (3031) contra una DB propia
 *   (`<db>_e2e`), recreada y sembrada en `e2e/global-setup.ts`.
 * - Los specs corren en serie (comparten la DB) en el proyecto `mobile` (375×812, UA de iPhone, en
 *   Chromium). `desktop` corre solo el smoke visual.
 * - `E2E_SKIP_BUILD=1` reutiliza el build existente; `E2E_SKIP_SEED=1` no recrea la DB.
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: "*.spec.ts",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  globalTimeout: 20 * 60_000, // nunca colgarse indefinidamente
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: E2E_BASE_URL,
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent: IPHONE_UA,
      },
    },
    {
      name: "desktop",
      testMatch: "visual-smoke.spec.ts",
      use: { browserName: "chromium", viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `${process.env.E2E_SKIP_BUILD === "1" ? "" : "npm run build && "}npx next start -p ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/login`,
    timeout: 240_000,
    reuseExistingServer: false,
    stdout: "ignore",
    stderr: "pipe",
    env: { DATABASE_URL: E2E_DATABASE_URL, PORT: String(E2E_PORT) },
  },
});
