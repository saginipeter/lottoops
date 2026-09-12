import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "migrate-roles.cjs",
  ]),
  {
    rules: {
      // Existing API response adapters still contain intentional boundary casts.
      // Keep them visible in CI while the typed DTO migration is completed.
      "@typescript-eslint/no-explicit-any": "warn",
      // These effects currently synchronize initial remote/local state. Keep the
      // rule visible without blocking deployment until the hooks are refactored.
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;
