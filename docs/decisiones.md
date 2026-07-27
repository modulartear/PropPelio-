# Registro de decisiones técnicas

Bitácora de toda decisión que **no** estaba explícita en el plan de proyecto
(`plan-proyecto-saas-inmobiliario.md`) y hubo que resolver durante la
implementación. Formato: una entrada por decisión, en orden cronológico.

Cada entrada indica **quién decidió**: las que dicen "Usuario" fueron
consultadas explícitamente antes de ejecutar; las que dicen "Claude" son
consecuencias mecánicas de una decisión previa, sin margen real de elección.

---

## D-001 — Versión de Next.js: 15.5.22 (no `@latest`)

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Usuario (consultado)
- **Contexto:** El plan dice `npx create-next-app@latest`. Al momento de
  ejecutarlo, `latest` resolvía a **Next 16.2.12**.
- **Decisión:** Fijar **Next.js 15.5.22**.
- **Motivo:** Es la rama madura. El ecosistema que el proyecto va a necesitar
  en fases posteriores (shadcn/ui, helpers SSR de Supabase, Prisma y sobre todo
  las librerías del builder visual de la Fase 4 — Puck / craft.js / dnd-kit)
  está probado contra 15.x. En un proyecto de ~3 meses, el riesgo de
  incompatibilidades de terceros pesa más que estar en la última versión.
- **Costo / reversibilidad:** Media. Migrar 15 → 16 más adelante es un upgrade
  acotado, pero conviene hacerlo antes de la Fase 4, no después.

## D-002 — Gestor de paquetes: npm

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Usuario (consultado)
- **Contexto:** El plan no especifica gestor de paquetes; el `npx` del
  documento sugiere npm pero no lo fija.
- **Decisión:** **npm** para todo el proyecto. Se commitea `package-lock.json`.
- **Motivo:** Viene en el contenedor sin instalar nada extra, y tanto Vercel
  como Codespaces lo autodetectan sin configuración adicional. pnpm habría
  exigido agregarlo al devcontainer y setear el install command en Vercel, a
  cambio de un beneficio (velocidad/disco) irrelevante a esta escala.
- **Costo / reversibilidad:** Baja. Cambiar a pnpm más adelante es borrar el
  lockfile y regenerar.

## D-003 — Tailwind CSS v4 (consecuencia de D-001)

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Claude (consecuencia mecánica, sin margen de elección)
- **Contexto:** `create-next-app` 15.5.22 con `--tailwind` instala
  **Tailwind v4** vía `@tailwindcss/postcss`.
- **Decisión:** Quedarse con el default: Tailwind v4.
- **Implicancia a tener presente:** v4 **no usa `tailwind.config.ts`**. La
  configuración de tema (colores, fuentes) se hace con `@theme` dentro de
  `src/app/globals.css`. Esto es relevante para la Fase 3 ("configuración de
  marca" por tenant) y la Fase 4 (builder): el theming por tenant va a tener
  que resolverse con **CSS custom properties en runtime**, no con config de
  build. shadcn/ui soporta Tailwind v4.
- **Costo / reversibilidad:** Alta si se quisiera bajar a v3 — implica
  reescribir la config y revisar utilidades. No se prevé hacerlo.

## D-004 — Nombre del paquete npm: `proppelio`

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Claude (forzado por restricción técnica)
- **Contexto:** `create-next-app` deriva el nombre del paquete del nombre del
  directorio, y el repo se llama `PropPelio-` — npm no acepta mayúsculas en el
  campo `name`.
- **Decisión:** El campo `name` de `package.json` es `proppelio` (minúsculas).
  El scaffolding se generó en un directorio temporal con ese nombre y se copió
  a la raíz del repo.
- **Impacto:** Ninguno funcional. El paquete es privado (`"private": true`),
  nunca se publica a npm.

## D-005 — Documentación viva en `/docs`

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Usuario (regla de trabajo del proyecto)
- **Decisión:** `/docs` se actualiza **en el mismo commit o inmediatamente
  después** de la tarea que documenta, no al cerrar la fase. Los documentos
  describen lo que **efectivamente se hizo**, y marcan explícitamente como
  PENDIENTE lo que falta — nunca describen el estado deseado como si fuera real.
- **Archivos:**
  - `docs/setup.md` — cómo levantar el entorno, qué secrets hacen falta, estado del checklist.
  - `docs/decisiones.md` — este archivo.
  - `docs/arquitectura.md` — stack, estructura de carpetas y modelo multi-tenant.

## D-006 — Devcontainer: imagen `typescript-node:1-22-bookworm` + Node 22

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Claude (el plan pide "fijar Node version" pero no dice cuál)
- **Decisión:** Imagen oficial `mcr.microsoft.com/devcontainers/typescript-node:1-22-bookworm`.
- **Motivo:** Node 22 es LTS activa y es lo que ya corre el entorno donde se
  hizo el scaffolding, así que dev y CI coinciden. Next 15 pide `>=18.18`, con
  lo cual 22 está holgado. Se usa la imagen oficial en vez de una base + feature
  de Node porque trae el toolchain de TypeScript ya armado y buildea más rápido.
- **Alternativa descartada:** `image: debian` + feature `node:1`. Más lento de
  construir sin ninguna ventaja acá.
- **Costo / reversibilidad:** Baja. Cambiar el tag de la imagen y recrear el Codespace.

## D-007 — Setup del Codespace en un script aparte, no inline

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Claude
- **Decisión:** El `postCreateCommand` llama a `.devcontainer/post-create.sh` en
  vez de encadenar comandos en un string del JSON.
- **Motivo:** El setup ya tiene varios pasos (dependencias, Claude Code global,
  mensaje de bienvenida) y va a crecer cuando entre Prisma (`prisma generate`).
  Un script tiene `set -euo pipefail`, es legible, versionable y se puede correr
  a mano para depurar. Un string JSON encadenado con `&&` no.
- **Costo / reversibilidad:** Nula.

