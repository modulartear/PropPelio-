# Arquitectura — PropPelio

SaaS multi-tenant para inmobiliarias: panel administrativo estilo Tokko Broker más
landing pública personalizable por cliente con un builder visual tipo Elementor.

> Este documento describe el diseño de referencia del proyecto completo, pero
> **marca explícitamente qué está implementado y qué no**. Al momento de esta
> edición: proyecto base, núcleo multi-tenant, autenticación con RLS, y el
> esqueleto del panel administrativo (Fase 3.1). Sin módulos de negocio
> todavía (propiedades, leads, tasaciones).

---

## 1. Stack

| Capa          | Tecnología                   | Estado                                |
| ------------- | ---------------------------- | ------------------------------------- |
| Framework     | Next.js 15.5.22 (App Router) | ✅ Instalado                          |
| Lenguaje      | TypeScript 5                 | ✅ Instalado                          |
| UI runtime    | React 19.1.0                 | ✅ Instalado                          |
| Estilos       | Tailwind CSS v4              | ✅ Instalado                          |
| Componentes   | shadcn/ui                    | ✅ Instalado a mano (D-028)           |
| Base de datos | Postgres (Supabase)          | ✅ Conectado y verificado (sa-east-1) |
| ORM           | Prisma 7.9.0                 | ✅ Migración aplicada a Supabase      |
| Auth          | Supabase Auth                | ✅ Login, registro y roles            |
| Storage       | Supabase Storage             | ⏳ Cliente listo, sin usar (Fase 3)   |
| Hosting / CI  | Vercel                       | ✅ Conectado y deployando             |
| Entorno dev   | GitHub Codespaces            | ✅ Devcontainer verificado            |

Ver `docs/decisiones.md` para el porqué de cada versión fijada.

---

## 1b. Conexión a Postgres — por qué hay dos URLs

Supabase expone la misma base por **dos poolers distintos**, y usamos los dos
porque tienen usos incompatibles entre sí.

| Variable       | Pooler      | Puerto | Quién la usa                               |
| -------------- | ----------- | ------ | ------------------------------------------ |
| `DATABASE_URL` | Transaction | `6543` | La app en runtime (`src/lib/db/client.ts`) |
| `DIRECT_URL`   | Session     | `5432` | El CLI de Prisma (`prisma.config.ts`)      |

**Por qué no alcanza con una sola:**

- El **transaction pooler** devuelve la conexión al pool después de cada
  sentencia. Es lo correcto para funciones serverless, que abren muchas
  conexiones cortas. Pero no soporta sentencias preparadas — de ahí el
  `?pgbouncer=true` obligatorio en la URL — ni transacciones largas.
- Las **migraciones** hacen justamente eso: transacciones largas, locks y
  sentencias preparadas. Por el transaction pooler fallan de formas poco
  obvias. Por eso van por el **session pooler**, que mantiene la conexión
  asignada durante toda la sesión.

> ⚠️ La tercera opción del dashboard, **"Direct connection"**
> (`db.<ref>.supabase.co:5432`), **es IPv6-only** salvo que se pague el add-on
> de IPv4. Ni Codespaces ni las funciones de Vercel garantizan salida por IPv6.
> No usarla: falla con timeouts que no explican la causa.

### Dónde vive cada URL (Prisma 7)

Prisma 7 eliminó el campo `directUrl` del schema. Ahora:

- `prisma.config.ts` → `datasource.url` → **`DIRECT_URL`** (CLI y migraciones).
- `src/lib/db/client.ts` → driver adapter `PrismaPg` → **`DATABASE_URL`** (runtime).

`prisma/schema.prisma` **no declara ninguna URL**. Es a propósito.

---

## 1c. Archivos de la capa de datos

| Archivo                       | Rol                                                                   |
| ----------------------------- | --------------------------------------------------------------------- |
| `prisma/schema.prisma`        | Modelos: `Tenant`, `User`, `TenantModule`.                            |
| `prisma.config.ts`            | Config del CLI. Apunta a `DIRECT_URL`.                                |
| `src/lib/env.ts`              | Único punto de lectura de env vars. Falla temprano y dice cuál falta. |
| `src/lib/db/client.ts`        | Cliente Prisma crudo, instanciado en el primer uso. **Sin filtro.**   |
| `src/lib/db/tenant-scope.ts`  | Inyección del `tenantId`. Función pura, testeada.                     |
| `src/lib/db/tenant-client.ts` | `forTenant(id)` — cliente scopeado a un tenant.                       |
| `src/lib/db/tenants.ts`       | Único acceso sin filtro fuera del scope: resolver el host.            |
| `src/lib/supabase/client.ts`  | Cliente de Supabase para el browser (publishable key).                |
| `src/lib/supabase/server.ts`  | Cliente administrativo (secret key). **Bypasea RLS.**                 |
| `src/generated/prisma/`       | Cliente generado. **Gitignoreado** — se regenera con `postinstall`.   |

### Sobre `src/lib/supabase/server.ts`

Ese cliente usa la **secret key**, que **bypasea todas las políticas de RLS**:
ve la base entera, todos los tenants. Está reservado a operaciones
administrativas genuinas (alta de tenants desde el super-admin, webhooks,
mantenimiento). **Nunca** debe usarse para servir el request de un tenant: ahí
el aislamiento depende del filtro por `tenantId` y de RLS, y esta clave anula
la segunda capa.

El archivo importa `server-only`, que hace fallar el build si el módulo termina
alcanzado desde un Client Component — en vez de filtrar la clave al browser.

---

## 2. Modelo multi-tenant (diseño previsto — Fase 1)

**Una sola base de datos Postgres, separación lógica por `tenantId`.** No hay
schema ni base por tenant.

Dos capas de aislamiento, independientes entre sí:

1. **Capa de aplicación (Prisma):** ✅ implementada. `forTenant(tenantId)`
   devuelve un cliente que inyecta el filtro en todo query. Una regla de ESLint
   bloquea importar el cliente crudo fuera de `src/lib/db/**`, así saltear la
   capa es un error de lint y no una fuga que se descubre en producción.
2. **Capa de base de datos (RLS de Supabase):** ✅ implementada en la Fase 2.
   Rol `app_user` sin `BYPASSRLS`, políticas que comparan contra
   `app.tenant_id`, y una segunda conexión (`DATABASE_ADMIN_URL`) confinada a
   las operaciones previas al tenant. Verificada con `npm run db:verify-rls`.
   Ver D-025 y [`docs/fase-2-auth.md`](fase-2-auth.md).

### Resolución del tenant

El `middleware.ts` lee el header `Host` y decide:

- `cliente.dominio.com` → subdominio → tenant por `subdomain`.
- `www.inmobiliariax.com` → dominio propio del cliente → tenant por `customDomain`.
- `dominio.com` (raíz) → sitio de marketing del SaaS, sin tenant.

Resuelto el tenant, hace _rewrite_ a una ruta interna con el `tenantId`.

> ✅ Implementado en la Fase 1. El detalle del recorrido de un request, las
> garantías de la capa de aislamiento y cómo verificarlo están en
> [`docs/fase-1-multitenant.md`](fase-1-multitenant.md).
>
> Una precisión sobre el diagrama: el middleware resuelve el **host**, no el
> `tenantId` — corre en el edge runtime, donde Prisma no funciona. Reescribe a
> `/tenants/<por>/<valor>/...` y el `tenantId` se resuelve del lado del
> servidor. Ver D-019.

---

## 3. Estructura de carpetas (objetivo)

```
/src
  /app
    /(marketing)          → landing del SaaS (venta del producto)
    /(tenant)/[domain]    → resuelto por middleware, cada tenant
      /admin              → panel administrativo del tenant
      /(public)           → landing pública renderizada por el builder
    /super-admin          → panel central (sólo SUPER_ADMIN)
    /api
  /lib
    /tenant               → helpers de resolución y contexto de tenant
    /db                   → cliente Prisma + wrappers con filtro tenantId
    /builder              → lógica del editor de bloques
  /components
    /blocks               → bloques del landing builder (hero, catálogo, etc.)
    /ui                   → shadcn/ui
/prisma
  schema.prisma
/docs
```

**Estado real hoy:**

```
/src
  middleware.ts           → resolución de tenant por host (edge)
  /app
    page.tsx              → sitio de marketing (dominio raíz)
    /tenants/[por]/[valor] → landing genérica del tenant
  /lib
    env.ts                → lectura tipada de variables de entorno
    /db
      client.ts           → cliente Prisma crudo (lazy). SIN filtro
      tenant-scope.ts     → inyección del tenantId. Función pura, testeada
      tenant-client.ts    → forTenant(): cliente scopeado
      tenants.ts          → único acceso sin filtro, para resolver el host
      index.ts            → punto de entrada de la capa
    /tenant
      host.ts             → clasificación del host. Función pura, testeada
      resolve.ts          → getTenantFromRequest(), requireTenant()
    /supabase
      client.ts           → cliente browser (publishable key)
      server.ts           → cliente admin (secret key, bypasea RLS)
  /generated/prisma       → cliente generado, gitignoreado
/prisma
  schema.prisma           → Tenant, User, TenantModule
  seed.ts                 → tenants de prueba
  /migrations
prisma.config.ts
```

Las carpetas que faltan (`/components`, `/lib/builder`, `/super-admin`) se van
creando fase por fase, cuando hay código real que poner adentro.

---

## 4. Roles

| Rol            | Alcance                                                      |
| -------------- | ------------------------------------------------------------ |
| `SUPER_ADMIN`  | DiseArte. Gestiona tenants, planes, módulos y plantillas.    |
| `TENANT_ADMIN` | Dueño de la inmobiliaria. Gestiona su tenant y sus usuarios. |
| `TENANT_USER`  | Agente. Permisos acotados dentro de su tenant.               |

> ✅ Modelados en el schema (enum `UserRole`). La **autorización** por rol es de
> la Fase 2 — hoy los roles existen como dato, sin nada que los haga cumplir.

---

## 5. Notas de arquitectura abiertas

- **Theming por tenant + Tailwind v4:** Tailwind v4 no tiene `tailwind.config.ts`;
  el tema se define con `@theme` en CSS, que es build-time. Como cada tenant
  define sus propios colores en runtime (Fase 3, "configuración de marca"), el
  theming va a tener que apoyarse en **CSS custom properties inyectadas por
  tenant**, no en configuración de build. Definir esto antes de empezar la Fase 3.
- **Backups:** la Fase 8 del plan menciona "backups automáticos de Neon", pero
  el proyecto usa **Supabase**, no Neon. Al llegar a esa fase, leerlo como
  backups de Supabase (PITR según el plan contratado).
