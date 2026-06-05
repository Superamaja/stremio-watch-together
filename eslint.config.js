import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["archive/**", "host.user.js", "guest.user.js"],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        __DEFAULT_FIREBASE_CONFIG__: "readonly",
      },
    },
    rules: {
      "no-useless-escape": "off",
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
];
