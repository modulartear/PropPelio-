# Setup — PropPelio

Guía de puesta en marcha del entorno de desarrollo. **Todo el entorno es cloud:
no se instala ni se corre nada en una máquina local.**

> Este documento se actualiza a medida que se ejecuta cada tarea de setup.
> Lo que está marcado como PENDIENTE todavía no se hizo — no asumas que está listo.

---

## 1. Estado actual del setup (Fase 0)

| #   | Tarea                                                          | Estado                                             | Quién   |
| --- | -------------------------------------------------------------- | -------------------------------------------------- | ------- |
| 1   | Repo privado en GitHub                                         | ✅ Hecho (`modulartear/PropPelio-`)                | —       |
| 1b  | Habilitar Codespaces sobre el repo                             | ⏳ PENDIENTE                                       | Usuario |
| 2   | Scaffolding Next.js (TS, App Router, Tailwind, ESLint, `src/`) | ✅ Hecho                                           | Claude  |
| 3   | `devcontainer.json`                                            | ✅ Escrito — ⚠️ sin verificar en un Codespace real | Claude  |
| 4   | Prettier + ESLint                                              | ✅ Hecho                                           | Claude  |
| 5   | Proyecto en Supabase + credenciales                            | ⏳ PENDIENTE                                       | Usuario |
| 6   | Prisma apuntando a Supabase                                    | ⏳ PENDIENTE                                       | Claude  |
| 7   | `@supabase/supabase-js` (Auth + Storage)                       | ⏳ PENDIENTE                                       | Claude  |
| 8   | Env vars como Codespaces secrets + Vercel                      | ⏳ PENDIENTE                                       | Ambos   |
| 9   | Repo conectado a Vercel + deploy "hello world"                 | ⏳ PENDIENTE                                       | Usuario |
| 10  | Dominio raíz + wildcard `*.dominio.com` en Vercel              | ⏳ PENDIENTE                                       | Usuario |
| 11  | Documentación en `/docs`                                       | 🔄 En curso (este archivo)                         | Claude  |

---

## 2. Abrir el entorno de desarrollo

### Opción A — GitHub Codespaces (entorno oficial del proyecto)

1. Ir a `https://github.com/modulartear/PropPelio-`.
2. Botón **Code → Codespaces → Create codespace on `<rama>`**.
3. Esperar a que el contenedor termine de construirse. El `postCreateCommand`
   corre `.devcontainer/post-create.sh`, que instala las dependencias y Claude
   Code automáticamente — **no hace falta correr `npm install` a mano**.
4. `npm run dev` → Codespaces expone el puerto 3000 y ofrece abrirlo en el navegador.

> ⚠️ **Sin verificar todavía.** El devcontainer está escrito, pero ninguna
> sesión lo construyó aún. La primera vez que abras un Codespace, confirmá que
> el build termina sin errores y que `npm run dev` levanta sin pasos manuales —
> ese es el primer punto del criterio de cierre de la Fase 0.

### Qué configura el devcontainer

| Ítem                | Valor                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| Imagen base         | `mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm` (Node 22) |
| Features            | GitHub CLI                                                                |
| Extensiones VS Code | Claude Code, ESLint, Prettier, Tailwind IntelliSense, Prisma, GitLens     |
| Formateo            | `formatOnSave` con Prettier + autofix de ESLint al guardar                |
| Puertos             | 3000 (Next.js dev), 5555 (Prisma Studio)                                  |
| `postCreateCommand` | `.devcontainer/post-create.sh` → `npm ci` + instala Claude Code global    |

### Opción B — Claude Code on the web

Contenedor remoto efímero que clona el repo al arrancar. Sirve para trabajo
asistido, pero **no** lee `.devcontainer/devcontainer.json`, así que no es
prueba de que el Codespace levante bien. Esa verificación se hace en Codespaces.

---

## 3. Requisitos del entorno

| Herramienta | Versión | Nota                                                                |
| ----------- | ------- | ------------------------------------------------------------------- |
| Node.js     | 22.x    | Fijada por el devcontainer (imagen `typescript-node:1-22-bookworm`) |
| npm         | 10.x    | Gestor de paquetes del proyecto                                     |

---

## 4. Comandos del proyecto

```bash
npm install           # instalar dependencias
npm run dev           # servidor de desarrollo (http://localhost:3000)
npm run build         # build de producción — correr antes de pushear
npm run start         # servir el build de producción

npm run lint          # ESLint
npm run lint:fix      # ESLint con autofix
npm run format        # Prettier: reescribe los archivos
npm run format:check  # Prettier: sólo verifica, no escribe
npm run typecheck     # tsc --noEmit
```

---

## 4b. Estilo de código (Prettier + ESLint)

**Reparto de responsabilidades:** Prettier decide el **formato**; ESLint decide
la **corrección**. No se pisan.

### Prettier — `.prettierrc.json`

| Opción               | Valor                         | Por qué                                                                                               |
| -------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| `semi`               | `true`                        | Punto y coma explícito                                                                                |
| `singleQuote`        | `false`                       | Comillas dobles, igual que el output de `create-next-app`                                             |
| `trailingComma`      | `"all"`                       | Diffs más limpios al agregar líneas                                                                   |
| `printWidth`         | `100`                         | Los componentes con muchas clases de Tailwind respiran mejor que con 80                               |
| `endOfLine`          | `"lf"`                        | Evita ruido de CRLF entre entornos                                                                    |
| `plugins`            | `prettier-plugin-tailwindcss` | Ordena las clases de Tailwind en el orden oficial                                                     |
| `tailwindStylesheet` | `./src/app/globals.css`       | **Requerido en Tailwind v4**: no hay `tailwind.config.ts`, así que el plugin lee el tema desde el CSS |

### ESLint — `eslint.config.mjs`

Base: `next/core-web-vitals` + `next/typescript`. Reglas propias agregadas:

| Regla                                | Nivel                           | Por qué                                                                                            |
| ------------------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `@typescript-eslint/no-unused-vars`  | `error`                         | Un import o binding huérfano suele ser síntoma de un refactor a medias. Escape hatch: prefijo `_`. |
| `@typescript-eslint/no-explicit-any` | `warn`                          | `any` desactiva el tipado justo donde más se necesita (queries filtradas por `tenantId`).          |
| `no-console`                         | `warn` (permite `warn`/`error`) | Un `console.log` olvidado en un Server Component termina en los logs de producción de Vercel.      |

> ⚠️ `eslint-config-prettier` **tiene que quedar último** en el array de
> `eslint.config.mjs`. Es lo que apaga las reglas de formato de ESLint que
> chocan con Prettier. Si se mueve de lugar, las dos herramientas se
> contradicen y el archivo alterna formato en cada guardado.

**No hay hook de pre-commit** (husky/lint-staged) por decisión explícita — ver
D-009. El `formatOnSave` del devcontainer cubre el caso habitual.

---

## 5. Variables de entorno / secrets

> ⏳ PENDIENTE (tarea 8). Todavía no hay ninguna variable definida porque el
> proyecto de Supabase no está creado (tarea 5).

**Regla del proyecto: no se commitea ningún `.env` con valores reales, y no se
usa `.env.local` en disco.** Los valores viven en:

- **GitHub → Settings → Secrets and variables → Codespaces** (para desarrollo).
- **Vercel → Project → Settings → Environment Variables** (para preview y producción).

El contrato de variables se documentará acá y en `.env.example` cuando se
ejecute la tarea 8.

---

## 6. Deploys

> ⏳ PENDIENTE (tarea 9). El repo todavía no está conectado a Vercel.

Modelo previsto una vez conectado:

- Push a cualquier rama → **preview deployment** con URL propia.
- Push a `main` → **deploy de producción**.

---

## 7. Historial de cambios de este documento

| Fecha      | Cambio                                                                    |
| ---------- | ------------------------------------------------------------------------- |
| 2026-07-27 | Creación del documento. Refleja el estado tras el scaffolding de Next.js. |
