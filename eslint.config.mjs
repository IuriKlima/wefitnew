import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/generated/**",
      "**/next-env.d.ts",
      "**/vitest*.config.mjs"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "packages/database/scripts/*.mjs",
            "packages/database/rls-spike/*.mjs",
            "packages/database/rls-spike/src/*.mjs",
            "packages/database/rls-spike/test/*.mjs",
            "scripts/*.mjs",
            "scripts/test/*.mjs"
          ],
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 20
        },
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ]
    }
  },
  prettier
);
