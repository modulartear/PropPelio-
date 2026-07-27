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
| 5   | Proyecto en Supabase + credenciales                            | ✅ Proyecto creado en `sa-east-1`                  | Usuario |
| 6   | Prisma apuntando a Supabase                                    | ✅ Hecho — ⚠️ sin conectar a la DB real            | Claude  |
| 7   | `@supabase/supabase-js` (Auth + Storage)                       | ✅ Hecho                                           | Claude  |
| 8   | Env vars como Codespaces secrets + Vercel                      | ✅ Contrato definido — ⏳ falta cargarlas          | Ambos   |
| 9   | Repo conectado a Vercel + deploy "hello world"                 | ✅ Hecho — `prop-pelio.vercel.app`                 | Usuario |
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

| Ítem                | Valor                                                                       |
| ------------------- | --------------------------------------------------------------------------- |
| Imagen base         | `mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm` (Node 22)   |
| Features            | GitHub CLI                                                                  |
| Extensiones VS Code | Claude Code, ESLint, Prettier, Tailwind IntelliSense, Prisma, GitLens       |
| Formateo            | `formatOnSave` con Prettier + autofix de ESLint al guardar                  |
| Puertos             | 3000 (Next.js dev), 5555 (Prisma Studio)                                    |
| `postCreateCommand` | `.devcontainer/post-create.sh` → `npm ci` + Claude Code + `prisma generate` |

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

npm run db:generate   # regenera el cliente de Prisma (corre solo en postinstall)
npm run db:migrate    # prisma migrate dev — necesita DIRECT_URL
npm run db:studio     # Prisma Studio (puerto 5555) — necesita DIRECT_URL
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

**Regla del proyecto: no hay archivos `.env` en disco.** El contrato de
variables está versionado en [`.env.example`](../.env.example) — nombres y
procedencia, nunca valores. Los valores viven en:

- **GitHub → Settings → Secrets and variables → Codespaces** (desarrollo).
- **Vercel → Project → Settings → Environment Variables** (preview y producción).

### Las 5 variables

| Variable                               | De dónde sale                                   | Secreta |
| -------------------------------------- | ----------------------------------------------- | ------- |
| `DATABASE_URL`                         | Supabase → Connect → ORM → Prisma (puerto 6543) | Sí      |
| `DIRECT_URL`                           | Supabase → Connect → ORM → Prisma (puerto 5432) | Sí      |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase → Settings → API Keys                  | No      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API Keys                  | No      |
| `SUPABASE_SECRET_KEY`                  | Supabase → Settings → API Keys                  | **Sí**  |

Por qué son dos URLs de base distintas: ver `docs/arquitectura.md` §1b.

> ⚠️ `SUPABASE_SECRET_KEY` **bypasea todas las políticas de RLS**. Nunca
> prefijarla con `NEXT_PUBLIC_`, nunca usarla para servir el request de un
> tenant.

### Cargarlas en Codespaces

1. GitHub → tu perfil → **Settings** → **Secrets and variables** → **Codespaces**.
2. **New secret** por cada una de las 5.
3. En _Repository access_ de cada secret, seleccionar **`PropPelio-`**. Sin esto
   el secret existe pero no llega al Codespace.
4. Si ya tenías un Codespace abierto, hay que reiniciarlo para que las tome.

### Cargarlas en Vercel

Project → **Settings** → **Environment Variables**. Marcar los tres entornos
(Production, Preview, Development) salvo que quieras una base distinta por
entorno — hoy es la misma para los tres.

> El deploy inicial "hello world" **no necesita ninguna variable**: la página no
> importa `src/lib/env.ts`. Se pueden cargar después, antes de la Fase 1.

### Cómo se leen desde el código

Ningún módulo lee `process.env` directo. Todo pasa por
[`src/lib/env.ts`](../src/lib/env.ts):

```ts
import { serverEnv, publicEnv } from "@/lib/env";

const { DATABASE_URL } = serverEnv(); // sólo servidor
const { SUPABASE_URL } = publicEnv(); // puede ir al browser
```

Si falta una variable, tira un error que la nombra, al arrancar — en vez de
aparecer como `undefined` en medio de un query. Ver D-014.

---

## 6. Deploys

El repo está conectado a Vercel. **Producción: https://prop-pelio.vercel.app**

- Push a cualquier rama → **preview deployment** con URL propia. ✅ Verificado
  con el commit `d61d046`: status `success` de Vercel en el PR #1.
- Push a `main` → **deploy de producción**.

### Cómo quedó configurado

El framework se declara en **`vercel.json`** (`"framework": "nextjs"`), no en el
dashboard. Ver D-017: el repo se importó a Vercel cuando `main` todavía era sólo
un README, así que la autodetección lo configuró como sitio estático y el primer
push con código real falló con `No Output Directory named "public" found`.
Tenerlo en `vercel.json` hace que la config viaje con el código y no dependa de
un setting invisible desde el repo.

El pipeline es:

```
npm install  →  postinstall: prisma generate  →  next build
```

Ese `postinstall` es indispensable: el cliente de Prisma se genera a
`src/generated/prisma`, que está gitignoreado. Sin él, el build de Vercel se
cae al no encontrar el cliente.

### Variables de entorno en Vercel

El deploy inicial se hizo **sin ninguna variable cargada**, a propósito: la
página de Fase 0 no importa `src/lib/env.ts`. En cuanto haya código que sí las
use (Fase 1 en adelante), hay que cargarlas antes de deployar o el build falla
con el error de `env.ts` nombrando la variable que falta.

---

## 7. Problemas conocidos

### Un Codespace nuevo puede arrancar con el repo desactualizado

**Síntoma:** creás un Codespace, y el explorador muestra sólo `README.md` con
contenido viejo. El `postCreateCommand` no corre, no aparecen las extensiones, y
el proyecto no está.

**Cómo confirmarlo,** en la terminal del Codespace:

```bash
git log --oneline -3
```

Si muestra un commit viejo **y además lo marca como `origin/main`**, ahí está el
problema: el Codespace arrancó con las referencias remotas cacheadas, así que
`git status` lo reporta "en sync" y no avisa que está atrasado.

**Causa:** Codespaces puede crear el contenedor a partir de una imagen cacheada
de un estado anterior del repositorio. Es comportamiento de la plataforma, no
del `devcontainer.json`.

**Solución** (asegurate de no tener cambios sin commitear — `reset --hard` los
borra):

```bash
git fetch origin main
git reset --hard origin/main
```

Y después, **imprescindible**: `Ctrl+Shift+P` → **Codespaces: Rebuild
Container**. Traer los archivos no alcanza — el contenedor ya se construyó sin
leer `.devcontainer/`, así que Node 22, las extensiones y el `post-create.sh`
sólo se aplican al reconstruirlo.

### ✅ RESUELTO — `git push` devolvía 403 aunque la lectura funcionaba

**Síntoma:** `git push` devolvía `403 Forbidden` en `git-receive-pack`, y la API
de GitHub `403 Resource not accessible by integration`. Clonar y hacer fetch
funcionaban perfecto, lo cual despistaba.

**Causa real:** la GitHub App de Claude estaba **autorizada** pero no
**instalada**. Son dos cosas distintas y hacen falta las dos:

| Solapa en GitHub Settings → Applications | Qué otorga                            |
| ---------------------------------------- | ------------------------------------- |
| **Authorized GitHub Apps**               | Identidad — que la app sepa quién sos |
| **Installed GitHub Apps**                | Permisos reales sobre los repos       |

La app figuraba en _Authorized_ con la leyenda "Never used", y no aparecía en
_Installed_. La lectura funcionaba por otro motivo: **el repo era público**, y
un repo público se clona sin ningún permiso. Escribir era lo único que
necesitaba la instalación.

**Solución:** instalar la app desde https://github.com/apps/claude sobre la
cuenta, seleccionando el repositorio.

> ⚠️ **Orden importante:** instalar la app **antes** de pasar el repo a privado.
> Al revés se pierde también el acceso de lectura, que hasta ese momento venía
> de que el repo fuera público.

---

## 8. Historial de cambios de este documento

| Fecha      | Cambio                                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| 2026-07-27 | Creación del documento. Refleja el estado tras el scaffolding de Next.js.                                   |
| 2026-07-27 | Devcontainer, sección de estilo de código (Prettier + ESLint), pasos de Vercel y problemas conocidos.       |
| 2026-07-27 | Contrato de las 5 variables de entorno, cómo cargarlas en Codespaces y Vercel, y comandos de base de datos. |
| 2026-07-27 | Resuelto el 403 de `git push`: la GitHub App estaba autorizada pero no instalada.                           |
