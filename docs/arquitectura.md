# Arquitectura — PropPelio

SaaS multi-tenant para inmobiliarias: panel administrativo estilo Tokko Broker más
landing pública personalizable por cliente con un builder visual tipo Elementor.

> Este documento describe el diseño de referencia del proyecto completo, pero
> **marca explícitamente qué está implementado y qué no**. En Fase 0 casi nada
> lo está: sólo existe el proyecto base.

---

## 1. Stack

| Capa          | Tecnología                   | Estado                                  |
| ------------- | ---------------------------- | --------------------------------------- |
| Framework     | Next.js 15.5.22 (App Router) | ✅ Instalado                            |
| Lenguaje      | TypeScript 5                 | ✅ Instalado                            |
| UI runtime    | React 19.1.0                 | ✅ Instalado                            |
| Estilos       | Tailwind CSS v4              | ✅ Instalado                            |
| Componentes   | shadcn/ui                    | ❌ No instalado (no es tarea de Fase 0) |
| Base de datos | Postgres (Supabase)          | ✅ Conectado y verificado (sa-east-1)   |
| ORM           | Prisma 7.9.0                 | ✅ Configurado (sin modelos todavía)    |
| Auth          | Supabase Auth                | ⏳ Cliente listo, sin usar (Fase 2)     |
| Storage       | Supabase Storage             | ⏳ Cliente listo, sin usar (Fase 3)     |
| Hosting / CI  | Vercel                       | ✅ Conectado y deployando               |
| Entorno dev   | GitHub Codespaces            | ✅ Devcontainer verificado              |

Ver `docs/decisiones.md` para el porqué de cada versión fijada.

---

## 1b. Conexión a Postgres — por qué hay dos URLs

Supabase expone la misma base por **dos poolers distintos**, y usamos los dos
porque tienen usos incompatibles entre sí.

| Variable       | Pooler      | Puerto | Quién la usa                          |
| -------------- | ----------- | ------ | ------------------------------------- |
| `DATABASE_URL` | Transaction | `6543` | La app en runtime (`src/lib/db.ts`)   |
| `DIRECT_URL`   | Session     | `5432` | El CLI de Prisma (`prisma.config.ts`) |

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
- `src/lib/db.ts` → driver adapter `PrismaPg` → **`DATABASE_URL`** (runtime).

`prisma/schema.prisma` **no declara ninguna URL**. Es a propósito.

---

## 1c. Archivos de la capa de datos

| Archivo                      | Rol                                                                    |
| ---------------------------- | ---------------------------------------------------------------------- |
| `prisma/schema.prisma`       | Modelos. En Fase 0 está vacío de modelos: sólo generator + datasource. |
| `prisma.config.ts`           | Config del CLI. Apunta a `DIRECT_URL`.                                 |
| `src/lib/env.ts`             | Único punto de lectura de env vars. Falla temprano y dice cuál falta.  |
| `src/lib/db.ts`              | Cliente Prisma singleton con el adapter `PrismaPg`.                    |
| `src/lib/supabase/client.ts` | Cliente de Supabase para el browser (publishable key).                 |
| `src/lib/supabase/server.ts` | Cliente administrativo (secret key). **Bypasea RLS.**                  |
| `src/generated/prisma/`      | Cliente generado. **Gitignoreado** — se regenera con `postinstall`.    |

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

1. **Capa de aplicación (Prisma):** todo query de negocio pasa por un wrapper
   que fuerza el filtro `tenantId`. El objetivo de diseño es que sea
   _imposible olvidarse el filtro por error_, no sólo que esté por convención.
2. **Capa de base de datos (RLS de Supabase):** políticas de Row Level Security
   que filtran por el `tenantId` del usuario autenticado. Es la red de
   contención si la capa 1 falla.

### Resolución del tenant

El `middleware.ts` lee el header `Host` y decide:

- `cliente.dominio.com` → subdominio → tenant por `subdomain`.
- `www.inmobiliariax.com` → dominio propio del cliente → tenant por `customDomain`.
- `dominio.com` (raíz) → sitio de marketing del SaaS, sin tenant.

Resuelto el tenant, hace _rewrite_ a una ruta interna con el `tenantId`.

> ❌ Nada de esto está implementado todavía. Es el objetivo de la Fase 1.

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
  /app                    → layout.tsx + page.tsx (hello world de Fase 0)
  /lib
    env.ts                → lectura tipada de variables de entorno
    db.ts                 → cliente Prisma con adapter PrismaPg
    /supabase
      client.ts           → cliente browser (publishable key)
      server.ts           → cliente admin (secret key, bypasea RLS)
  /generated/prisma       → cliente generado, gitignoreado
/prisma
  schema.prisma           → sin modelos todavía
prisma.config.ts
```

El resto de las carpetas se van creando fase por fase, cuando hay código real
que poner adentro. Nota: el plan sugiere `/lib/db` como carpeta; por ahora es
un solo archivo `db.ts`, y pasa a carpeta en la Fase 1 cuando entren los
wrappers con filtro por `tenantId`.

---

## 4. Roles

| Rol            | Alcance                                                      |
| -------------- | ------------------------------------------------------------ |
| `SUPER_ADMIN`  | DiseArte. Gestiona tenants, planes, módulos y plantillas.    |
| `TENANT_ADMIN` | Dueño de la inmobiliaria. Gestiona su tenant y sus usuarios. |
| `TENANT_USER`  | Agente. Permisos acotados dentro de su tenant.               |

> ❌ No implementado. Fase 2.

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
