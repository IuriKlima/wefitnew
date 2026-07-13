import { FlatCompat } from "@eslint/eslintrc";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals.js";
import nextTs from "eslint-config-next/typescript.js";
import prettier from "eslint-config-prettier";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname
});

export default defineConfig([
  ...compat.config(nextVitals),
  ...compat.config(nextTs),
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off"
    }
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  prettier
]);
