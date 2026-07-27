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

## D-008 — Prettier con `eslint-config-prettier` + `prettier-plugin-tailwindcss`

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Usuario (consultado)
- **Contexto:** El plan pide "Prettier + ESLint con reglas del equipo" pero no
  lista paquetes. Prettier solo no alcanza en este stack.
- **Decisión:** Instalar `prettier`, `eslint-config-prettier` y
  `prettier-plugin-tailwindcss` como devDependencies.
- **Motivo:**
  - `eslint-config-prettier` apaga las reglas de formato de ESLint que chocan
    con Prettier. Sin esto las dos herramientas se contradicen y el archivo
    alterna entre dos formatos en cada guardado. Va **último** en el array de
    `eslint.config.mjs` — el orden es funcional, no estético.
  - `prettier-plugin-tailwindcss` ordena las clases de Tailwind en el orden
    oficial. En la Fase 4 (builder) va a haber decenas de componentes de bloque
    con listas largas de clases; sin esto los diffs se llenan de reordenamientos
    manuales que tapan los cambios reales.
- **Nota de Tailwind v4:** el plugin necesita `tailwindStylesheet` apuntando a
  `./src/app/globals.css`, porque en v4 no existe `tailwind.config.ts` de donde
  leer el tema. Si en algún momento se mueve `globals.css`, hay que actualizar
  esa ruta o el ordenamiento de clases deja de funcionar en silencio.
- **Costo / reversibilidad:** Baja.

## D-009 — Sin hook de pre-commit en Fase 0

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Usuario (consultado)
- **Decisión:** No instalar husky ni lint-staged por ahora.
- **Motivo:** El plan no lo pide en Fase 0 y el `formatOnSave` del devcontainer
  ya cubre el caso habitual, que es editar dentro del Codespace. Se puede sumar
  en la Fase 8 (hardening) si aparece código sin formatear en el repo.
- **Riesgo asumido:** un commit hecho fuera del devcontainer puede entrar sin
  formatear. Mitigación disponible: `npm run format:check` en CI.

## D-010 — `.gitignore`: se versiona `.env.example`, nunca un `.env` real

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Claude (consecuencia de la regla "sin `.env` en disco" del plan)
- **Contexto:** El `.gitignore` de `create-next-app` trae `.env*`, que también
  ignora `.env.example`.
- **Decisión:** Agregar la excepción `!.env.example`. Ese archivo documenta el
  **contrato** de variables (nombres y descripción), nunca valores.
- **Motivo:** Sin el `.env.example` versionado, el contrato de variables no
  queda en ningún lado y hay que reconstruirlo leyendo el código.

## D-011 — Región de Supabase: `sa-east-1` (São Paulo)

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Usuario
- **Contexto:** El proyecto se creó primero en `us-east-1` y se recreó en
  `sa-east-1` mientras la base todavía estaba vacía.
- **Motivo:** ~90ms menos de latencia por query desde Argentina. El panel del
  tenant hace varias queries por request, así que la diferencia se acumula.
- **Costo / reversibilidad:** Alta a partir de ahora. Supabase no permite
  cambiar la región de un proyecto: hay que crear otro y migrar los datos. Se
  hizo en la única ventana en que era gratis (base vacía).
- **Efecto lateral:** cambió el project ref. No está hardcodeado en ningún lado
  del repo — vive sólo dentro de los valores de las env vars.

## D-012 — Prisma 7.9.0 y sus consecuencias

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Usuario (consultado)
- **Decisión:** Prisma 7.9.0, no la rama 6.x.
- **Motivo:** Arrancando de cero no se paga costo de migración, y el modelo de
  driver adapters encaja mejor con el pooler de Supabase. No aplica acá el
  criterio conservador de D-001: Prisma no arrastra el ecosistema de terceros
  que sí tenía Next.
- **Tres consecuencias mecánicas de esta elección** (no fueron decisiones
  aparte, son requisitos de v7):
  1. **`@prisma/adapter-pg` es obligatorio.** Prisma 7 eliminó la opción
     `datasourceUrl`: sin un driver adapter el cliente no se puede instanciar.
  2. **El generador es `prisma-client`, no `prisma-client-js`**, y exige
     `output` explícito. Se genera a `src/generated/prisma`, que está
     gitignoreado. De ahí el `postinstall: prisma generate` — sin él, un clone
     limpio o un build de Vercel no tienen cliente.
  3. **`directUrl` ya no existe en el schema.** La URL de migraciones se define
     en `prisma.config.ts`. Ver `docs/arquitectura.md` §1b.
- **Costo / reversibilidad:** Media. Bajar a 6.x implicaría rehacer la config,
  el generador y el cliente.

## D-013 — API keys: publishable / secret (no anon / service_role)

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Usuario (consultado)
- **Contexto:** El dashboard ofrece los dos pares.
- **Decisión:** Usar las nuevas: `sb_publishable_...` y `sb_secret_...`.
- **Motivo:** Las JWT legacy (`anon` / `service_role`) están anunciadas como
  deprecadas; arrancar acá evita una migración a mitad de proyecto. Además las
  nuevas se rotan y revocan individualmente.
- **Costo asumido:** casi toda la documentación y las respuestas que se
  encuentran googleando usan los nombres viejos. Al leer un tutorial, `anon`
  se lee como _publishable_ y `service_role` como _secret_.
- **Variables resultantes:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y
  `SUPABASE_SECRET_KEY`.
- **Costo / reversibilidad:** Baja. Es renombrar dos variables.

## D-014 — Toda variable de entorno se lee desde `src/lib/env.ts`

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Claude
- **Decisión:** Ningún módulo lee `process.env` directo. Todo pasa por
  `serverEnv()` o `publicEnv()`, que tiran un error nombrando la variable que
  falta.
- **Motivo:** Sin esto, una variable faltante aparece como `undefined` en medio
  de un query y el error que se ve no tiene relación con la causa. Además
  concentra en un archivo la separación entre lo que puede llegar al browser y
  lo que no.
- **Por qué son funciones y no objetos de módulo:** un objeto se evalúa al
  importar, así que importar cualquier cosa del archivo obligaría a tener
  definidas _todas_ las variables. `src/lib/db.ts` sólo necesita las de
  servidor y rompía sin razón por falta de una `NEXT_PUBLIC_`. Verificado con
  una prueba.
- **Nota:** `process.env.NEXT_PUBLIC_*` está escrito literal a propósito — Next
  lo sustituye por texto en build time y no funciona con indexado dinámico.

## D-015 — `@supabase/ssr` NO se instala en Fase 0

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Claude
- **Contexto:** Para sesiones de Supabase Auth persistidas en cookies entre
  Server Components, middleware y browser, el paquete correcto es
  `@supabase/ssr`, no `@supabase/supabase-js` solo.
- **Decisión:** En Fase 0 se instala únicamente `@supabase/supabase-js`, que es
  lo que pide el plan. `@supabase/ssr` entra en la **Fase 2** (autenticación),
  que es donde aparece ese requerimiento.
- **Motivo:** No adelantar trabajo de fases posteriores. Instalarlo ahora
  significaría dejar clientes de sesión sin usar y sin poder probar.
