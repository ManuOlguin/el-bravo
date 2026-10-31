import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Guardas de v2 (roadmap §4). `no-alert` pasa a "error" en W3.
  {
    rules: {
      "no-alert": "warn",
      "@next/next/no-html-link-for-pages": "error",
      "no-restricted-syntax": [
        "warn",
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
