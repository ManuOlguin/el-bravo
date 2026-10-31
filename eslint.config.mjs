import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Guardas de v2 (roadmap §4), en modo estricto desde W3.
  {
    rules: {
      "no-alert": "error",
      "@next/next/no-html-link-for-pages": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='toLocaleString'][arguments.length<2]",
          message: "Usá src/lib/time (formatDate/formatDateTime) con timeZone explícita.",
        },
        {
          selector: "CallExpression[callee.property.name='toLocaleDateString'][arguments.length<2]",
          message: "Usá src/lib/time con timeZone explícita.",
        },
        {
          selector: "CallExpression[callee.property.name='toLocaleTimeString'][arguments.length<2]",
          message: "Usá src/lib/time (localTimeOf) con timeZone explícita.",
        },
        {
          selector: "CallExpression[callee.property.name=/^(setHours|getDay|getDate)$/]",
          message: "Fechas locales del servidor: usá src/lib/time (localDateOf, weekKeyOf, zonedToUtc…).",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktrees de agentes y salidas de scripts
    ".claude/**",
    "scripts/out/**",
  ]),
]);

export default eslintConfig;
