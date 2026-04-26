import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

import boundaries from "eslint-plugin-boundaries";

export default tseslint.config(
  {
    ignores: ["dist"],
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "boundaries": boundaries,
    },
    settings: {
      "boundaries/elements": [
        {
          "type": "app",
          "pattern": "src/app/**/*"
        },
        {
          "type": "features",
          "pattern": "src/features/**/*"
        },
        {
          "type": "shared",
          "pattern": "src/shared/**/*"
        },
        {
          "type": "pages",
          "pattern": "src/pages/**/*"
        }
      ]
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/exhaustive-deps": "off",
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-empty": "off",
      "boundaries/element-types": [2, {
        "default": "allow",
        "rules": [
          {
            "from": "features",
            "disallow": ["features/*"],
            "message": "Features MUST NOT import from other features. Use shared/ or public API."
          },
          {
            "from": "features",
            "allow": ["shared", "app"]
          }
        ]
      }]
    },
  },
);
