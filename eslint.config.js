import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config([
  {
    ignores: ["dist/**", "src-tauri/target/**", "node_modules/**"],
  },
  {
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "warn",
    },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
]);
