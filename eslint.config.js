import eslintConfigPrettier from "eslint-config-prettier";
import astro from "eslint-plugin-astro";
import prettierPlugin from "eslint-plugin-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

const logicRules = {
  "no-redeclare": "error",
  "no-undef": "error",
  "no-dupe-keys": "error",
  "no-empty-function": "error",
  curly: ["error", "multi-line"],
  "prefer-const": "error",
  "prefer-template": "error",
  "no-var": "error",
  eqeqeq: "error",
  "no-unused-vars": ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
  "no-duplicate-imports": ["error", { allowSeparateTypeImports: true }],
  "prettier/prettier": "error",
};

const tsLogicRuleOverrides = {
  "no-redeclare": "off",
  "@typescript-eslint/no-redeclare": "error",
  "no-empty-function": "off",
  "@typescript-eslint/no-empty-function": "error",
  "no-unused-vars": "off",
  "@typescript-eslint/no-unused-vars": [
    "error",
    { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
  ],
  "@typescript-eslint/no-explicit-any": "off",
  // TypeScript already reports undefined names
  "no-undef": "off",
};

const jsLikeFiles = ["src/**/*.{js,mjs}", "scripts/**/*.mjs", "*.config.js", "*.config.mjs"];
const astroClientScripts = ["**/*.astro/*.js", "**/*.astro/*.ts"];

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: ["dist/**", ".astro/**", "node_modules/**", "package-lock.json", "data/**"],
  },

  {
    plugins: {
      prettier: prettierPlugin,
    },
  },

  ...astro.configs["flat/base"],

  {
    files: jsLikeFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: logicRules,
  },

  {
    files: ["src/**/*.ts"],
    plugins: { "@typescript-eslint": tseslint.plugin },
    languageOptions: { parser: tseslint.parser },
    rules: { ...logicRules, ...tsLogicRuleOverrides },
  },

  {
    files: ["src/**/*.astro"],
    rules: { ...logicRules, "no-undef": "off" },
  },

  {
    files: astroClientScripts,
    plugins: { "@typescript-eslint": tseslint.plugin },
    languageOptions: { parser: tseslint.parser, globals: globals.browser },
    rules: {
      ...logicRules,
      ...tsLogicRuleOverrides,
      // Prettier already formats these scripts as part of the whole .astro file
      "prettier/prettier": "off",
    },
  },

  eslintConfigPrettier,
];
