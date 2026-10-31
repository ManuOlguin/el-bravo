import { defineConfig } from "vitest/config";
import path from "node:path";

const alias = { "@": path.resolve(__dirname) };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
          exclude: ["**/*.int.test.ts", "node_modules/**"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["src/**/*.int.test.ts", "tests/**/*.int.test.ts"],
          environment: "node",
          globalSetup: ["tests/setup/global-setup.ts"],
          setupFiles: ["tests/setup/env.ts"],
          // Un solo proceso: los archivos comparten la DB de test y corren en serie.
          // (`fileParallelism` no es válido por proyecto en Vitest 3.)
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 20000,
        },
      },
    ],
  },
});
