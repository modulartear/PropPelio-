import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import eslintConfigPrettier from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      ".vercel/**",
      "next-env.d.ts",
    ],
  },

  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Reglas del equipo.
  {
    rules: {
      // Las variables sin usar son error, no warning: en un proyecto multi-tenant
      // un import o binding huerfano suele ser sintoma de un refactor a medias.
      // El prefijo `_` es el escape hatch explicito.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // `any` desactiva el tipado justo donde mas lo necesitamos (queries con
      // filtro por tenantId). Warning y no error para no frenar el desarrollo,
      // pero visible en cada lint.
      "@typescript-eslint/no-explicit-any": "warn",

      // console.log olvidado en server components termina en los logs de
      // produccion de Vercel. warn/error si estan permitidos.
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Tiene que ir ULTIMO: apaga las reglas de formato de ESLint que chocan
  // con Prettier. Si se mueve de lugar, ESLint y Prettier se contradicen.
  eslintConfigPrettier,
];

export default eslintConfig;
