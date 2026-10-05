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
    // Archived dashboard versions and imported review material are not part of
    // the Next.js portfolio source tree.
    "backup-v1/**",
    "claude/**",
    "dist/**",
    // Third-party browser bundle copied from the installed GridStack package.
    "static/vendor/**",
  ]),
]);

export default eslintConfig;
