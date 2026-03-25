import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Erlaube unescaped entities in JSX (z.B. Apostrophe)
      "react/no-unescaped-entities": "off",
      // TypeScript: unused vars als Warning statt Error (mit _ Prefix ignorieren)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      // Erlaube any als Warning (nicht Error) während der Migration
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Override default ignores
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**"]),
]);

export default eslintConfig;
