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

## D-016 — Se descartan las skills que instala `prisma init`

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Claude
- **Contexto:** `prisma init` (v7) instala ~90 archivos de documentación para
  asistentes de código en `.claude/skills/`, `.agents/skills/` y
  `.windsurf/skills/`, más un `skills-lock.json`. Los de `.claude/` y
  `.windsurf/` son **symlinks** a `.agents/`.
- **Decisión:** Borrarlos todos y gitignorearlos.
- **Motivo:** No los pidió nadie, `.windsurf` y `.agents` son de herramientas
  que el proyecto no usa, y vendorizar 90 archivos de documentación de Prisma
  al repo agrega ruido a cada diff. Son regenerables.
- **Bug que esto corrigió:** al borrar `.agents/` quedaron 9 symlinks rotos en
  `.claude/skills/`, que llegaron a commitearse. Se sacaron del índice y se
  gitignoreó el patrón para que no vuelvan a entrar en el próximo `npm install`.
- **Si en algún momento se las quiere:** hay que versionar `.agents/skills/`
  como archivos reales, no los symlinks.

## D-017 — El framework de Vercel se declara en `vercel.json`, no en el dashboard

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Claude
- **Contexto:** El primer deploy de producción salió "verde" pero no estaba
  sirviendo la app: el repo se importó a Vercel cuando `main` tenía **sólo un
  `README.md`**, sin `package.json`. Vercel autodetecta el framework en el
  momento del import, no vio un proyecto de Next.js, y configuró el preset como
  **Other** — que sirve archivos estáticos desde `public/`.
- **Síntoma:** el primer push con código real falló con
  `No Output Directory named "public" found after the Build completed`. La
  carpeta `public/` quedó vacía al borrar los SVG del template de
  `create-next-app`, y git no versiona directorios vacíos.
- **Decisión:** declarar `"framework": "nextjs"` en un `vercel.json`
  versionado, en vez de corregir el preset a mano en el dashboard.
- **Motivo:** un setting del dashboard es invisible desde el repo, no queda en
  la historia de git y se pierde si el proyecto se recrea. `vercel.json` tiene
  precedencia sobre la configuración del dashboard, viaja con el código y
  documenta la intención. Un clone nuevo importado a otra cuenta de Vercel
  buildea bien sin que nadie tenga que acordarse de tocar nada.
- **Lección general:** conectar Vercel a un repo **antes** de que tenga código
  hace que la autodetección se fije mal. Si se vuelve a hacer, conviene
  importar el repo recién cuando la rama de producción ya tenga el proyecto.

## D-018 — El dominio propio se posterga; la Fase 0 cierra sin ese punto

- **Fecha:** 2026-07-27
- **Fase:** 0
- **Decidió:** Usuario (consultado)
- **Contexto:** La tarea 10 del plan pide configurar el dominio raíz y el
  wildcard `*.dominio.com` en Vercel. Al cerrar la fase todavía no hay dominio
  comprado.
- **Decisión:** Cerrar la Fase 0 con ese punto explícitamente pendiente, en vez
  de frenar el proyecto.
- **Por qué no bloquea:** la Fase 1 (resolución de tenant por subdominio) no
  necesita un dominio real. Su propio criterio de cierre está escrito contra
  `tenant-a.localhost:3000` / `tenant-b.localhost:3000`, y el middleware lee el
  header `Host` sin importar de qué dominio venga. Mientras tanto se trabaja
  sobre la URL de Vercel.
- **Cuándo retomarlo:** al comprar el dominio, o a más tardar en la **Fase 6**
  (dominios personalizados), que es donde se integra la API de dominios de
  Vercel y el wildcard pasa a ser imprescindible.
- **Qué habrá que hacer entonces:**
  1. Agregar el dominio raíz en Vercel → Project → Settings → Domains.
  2. Agregar `*.dominio.com` como wildcard (Vercel pide verificación por DNS
     con un registro `TXT`).
  3. En el registrador: `A` / `CNAME` del raíz apuntando a Vercel, y un `CNAME`
     `*` para el wildcard.
  4. El SSL del wildcard lo provisiona Vercel automáticamente tras verificar.

## D-019 — El middleware resuelve el HOST, no el `tenantId`

- **Fecha:** 2026-07-27
- **Fase:** 1
- **Decidió:** Claude (forzado por el runtime)
- **Contexto:** El plan dice que el middleware haga _rewrite_ a
  `/tenants/[tenantId]/...`. Eso exige un query a la base para traducir el host
  a un id.
- **Problema:** el middleware de Next corre en el **edge runtime**, donde
  Prisma no funciona.
- **Decisión:** el middleware reescribe con el **host** —
  `/tenants/<por>/<valor>/...` — y el `tenantId` se resuelve del lado del
  servidor, ya en Node, en `src/lib/tenant/resolve.ts`.
- **Alternativa descartada:** `experimental.nodeMiddleware` de Next 15. No se
  pone una bandera experimental en la base de un proyecto de tres meses.
- **Consecuencia positiva:** el middleware no toca la base en ningún request.
  Los subdominios reservados y los hosts inválidos se rechazan con 404 sin
  gastar una conexión.

## D-020 — La búsqueda del tenant viaja en dos segmentos de URL

- **Fecha:** 2026-07-27
- **Fase:** 1
- **Decidió:** Claude
- **Decisión:** El middleware reescribe a `/tenants/<por>/<valor>` (por ejemplo
  `/tenants/subdomain/tenant-a`) en vez de a un solo segmento con separador.
- **Motivo:** un segmento único obligaría a un separador (`s:tenant-a`), y con
  él a encodear y desencodear. Cada encoding es una oportunidad de error en el
  camino crítico del aislamiento entre tenants.
- **Salvaguarda:** el segmento `por` viene de la URL y alguien puede pedir esa
  ruta a mano, así que se valida contra los dos valores permitidos antes de
  usarlo como nombre de campo en el query.

## D-021 — `User` de Fase 1 es el `profiles` de Fase 2

- **Fecha:** 2026-07-27
- **Fase:** 1
- **Decidió:** Claude (consultado y avisado)
- **Contexto:** El plan pide `User` en la Fase 1 y una tabla `profiles`
  vinculada a `auth.users` de Supabase en la Fase 2. Son la misma entidad.
- **Decisión:** una sola tabla `users`, con `authUserId` nullable que en la
  Fase 2 se completa con el UUID de Supabase Auth.
- **Motivo:** dos tablas para lo mismo obligaría a migrar datos entre ellas al
  llegar a la Fase 2, con el riesgo que eso implica sobre usuarios ya creados.
- **Detalle:** el email es único **dentro** de cada tenant, no globalmente: la
  misma persona puede ser agente en dos inmobiliarias con el mismo mail.

## D-022 — El cliente de Prisma se instancia en el primer uso, no al importar

- **Fecha:** 2026-07-27
- **Fase:** 1
- **Decidió:** Claude (obligado por un fallo real)
- **Contexto:** Con la instanciación al importar el módulo, `next build` fallaba
  con `Falta la variable de entorno DATABASE_URL`: al recolectar los datos de
  las páginas, Next evalúa los módulos, y crear el cliente exige la URL.
- **Decisión:** `prisma` es un `Proxy` que construye el cliente real en el
  primer acceso a una propiedad.
- **Motivo:** compilar no debería requerir credenciales de base de datos. Sin
  esto, cualquier CI sin secrets no puede buildear, y un deploy de Vercel al que
  todavía no se le cargaron las variables falla en build en vez de en runtime.
- **Detalle:** el Proxy bindea las funciones al cliente real para no perder el
  `this`.

## D-023 — `tsx` para correr el seed y futuros scripts

- **Fecha:** 2026-07-27
- **Fase:** 1
- **Decidió:** Claude (consultado sin respuesta; queda abierto a revisión)
- **Contexto:** El seed está en TypeScript e importa el cliente generado de
  Prisma, que usa imports sin extensión. El runner nativo de Node
  (`--experimental-strip-types`) no puede resolverlos: falla con
  `ERR_MODULE_NOT_FOUND` en `src/generated/prisma/enums`.
- **Decisión:** `tsx` como devDependency. `npm run db:seed`.
- **Motivo:** es lo que documenta Prisma para seeds. Las alternativas eran peores:
  seed en SQL plano pierde el tipado y hay que mantenerlo a mano contra el
  schema; compilar con `tsc` requiere un tsconfig aparte, un paso de build y
  limpieza posterior.
- **Costo / reversibilidad:** Baja. Es una devDependency, no entra al bundle.
- **Nota:** los **tests** no usan `tsx` — corren con el runner nativo de Node,
  sin dependencias, porque no importan el cliente generado.

## D-025 — RLS efectiva también sobre Prisma, con rol dedicado

- **Fecha:** 2026-07-27
- **Fase:** 2
- **Decidió:** Usuario (consultado — opción A de tres)
- **Contexto:** El plan pide RLS como _"capa de seguridad adicional a los
  filtros de Prisma"_. Al implementarlo aparecieron dos obstáculos que el plan
  no anticipa:
  1. **El rol `postgres` de Supabase es dueño de las tablas y ignora sus
     propias políticas**, incluso con `FORCE ROW LEVEL SECURITY`. Escritas de
     la forma habitual, las políticas no habrían protegido **ni un solo query
     de Prisma** — el camino por donde pasa el 100% de los datos del panel.
  2. **Resolver el host y resolver al usuario ocurren antes de que exista
     contexto de tenant.** Con RLS forzado sobre esas tablas, nada podría
     loguearse.
- **Decisión:** rol de Postgres `app_user`, sin `BYPASSRLS` y sin ser dueño de
  nada, más **dos connection strings**:

  | Variable             | Rol        | RLS        | Uso                                                      |
  | -------------------- | ---------- | ---------- | -------------------------------------------------------- |
  | `DATABASE_URL`       | `app_user` | **aplica** | `forTenant()` — todos los datos de negocio               |
  | `DATABASE_ADMIN_URL` | `postgres` | bypasea    | Sólo resolver host, resolver usuario y alta self-service |

  El uso del segundo está confinado a `src/lib/db/tenants.ts` y `users.ts`, que
  ya eran los únicos archivos con acceso sin filtro.

- **Cómo se transmite el tenant:** `set_config('app.tenant_id', <id>, true)` al
  abrir cada transacción. El `true` la hace **local a la transacción**, y eso es
  lo esencial con el transaction pooler: sin él, la conexión vuelve al pool con
  el tenant del request anterior pegado, y el siguiente request que la tome ve
  datos ajenos. Sería exactamente el bug que todo esto busca evitar.
- **Costo asumido:** cada operación de Prisma pasa a ser una transacción con una
  sentencia extra. Es un round-trip más por query. Se aceptó a cambio de que la
  segunda capa cubra el camino principal de datos y no sólo Auth y Storage.
- **`tenants` recibe trato distinto:** `SELECT` libre (resolver un host es la
  operación que _establece_ el tenant; si estuviera restringida ningún request
  podría arrancar), `UPDATE` sólo sobre el propio, y sin política de `INSERT`
  ni `DELETE` para `app_user` — sin política, la operación se rechaza.
- **Contraseña del rol:** la migración crea `app_user` **sin contraseña**, a
  propósito. Una contraseña en un archivo versionado es una contraseña
  filtrada. Se asigna a mano una vez desde el SQL Editor de Supabase.
- **Deuda que esto genera:** cada tabla nueva con `tenantId` necesita su propia
  política. Los `GRANT` se heredan por `ALTER DEFAULT PRIVILEGES`, las
  políticas **no**. Una tabla con RLS habilitado y sin políticas rechaza todo;
  una tabla sin RLS habilitado queda completamente abierta. Queda como
  recordatorio al final de la migración y como ítem para la auditoría de la
  Fase 8.

## D-026 — `@supabase/ssr` y sesión en cookies

- **Fecha:** 2026-07-27
- **Fase:** 2
- **Decidió:** Claude (previsto en D-015)
- **Decisión:** `@supabase/ssr` para las sesiones, con tres clientes:
  `browser.ts`, `server.ts` (sesión del usuario) y `admin.ts` (secret key).
- **Motivo:** guarda la sesión en **cookies** en vez de localStorage, que es lo
  único que permite que el servidor la vea. Con localStorage, un Server
  Component no puede saber quién está logueado.
- **Detalle de seguridad:** el cliente de servidor usa `getUser()` y **no**
  `getSession()`. Los datos de `getSession()` salen de la cookie y podrían estar
  manipulados; `getUser()` los valida contra el servidor de Supabase.
- **Detalle del middleware:** la respuesta se arma **antes** de refrescar la
  sesión, porque el refresco escribe las cookies renovadas sobre ella. Crear
  otra después las perdería, y el síntoma sería un usuario que se desloguea de
  a ratos sin patrón aparente.

## D-027 — Los guards responden 404, nunca 403

- **Fecha:** 2026-07-27
- **Fase:** 2
- **Decidió:** Claude
- **Decisión:** `requireTenantUser()`, `requireSuperAdmin()` y
  `requireTenantAdmin()` responden **404** ante permisos insuficientes.
- **Motivo:** un 403 confirma que el recurso existe. Para quien no es
  super-admin, el panel central directamente no existe; para quien no pertenece
  a un tenant, ese tenant no existe.
- **Decisión relacionada:** el `SUPER_ADMIN` **no** entra al panel de un tenant.
  Si más adelante hace falta "entrar como" un cliente para dar soporte, tiene
  que ser un flujo explícito y auditable, no un permiso implícito que nadie
  recuerda que existe.
