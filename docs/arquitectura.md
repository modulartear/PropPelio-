# Arquitectura — PropPelio

SaaS multi-tenant para inmobiliarias: panel administrativo estilo Tokko Broker
+ landing pública personalizable por cliente con un builder visual tipo Elementor.

> Este documento describe el diseño de referencia del proyecto completo, pero
> **marca explícitamente qué está implementado y qué no**. En Fase 0 casi nada
> lo está: sólo existe el proyecto base.

---

## 1. Stack

| Capa | Tecnología | Estado |
|---|---|---|
| Framework | Next.js 15.5.22 (App Router) | ✅ Instalado |
| Lenguaje | TypeScript 5 | ✅ Instalado |
| UI runtime | React 19.1.0 | ✅ Instalado |
| Estilos | Tailwind CSS v4 | ✅ Instalado |
| Componentes | shadcn/ui | ❌ No instalado (no es tarea de Fase 0) |
| Base de datos | Postgres (Supabase) | ❌ Proyecto no creado |
| ORM | Prisma | ❌ No instalado |
| Auth | Supabase Auth | ❌ No configurado |
| Storage | Supabase Storage | ❌ No configurado |
| Hosting / CI | Vercel | ❌ No conectado |
| Entorno dev | GitHub Codespaces | ⏳ Devcontainer pendiente |

Ver `docs/decisiones.md` para el porqué de cada versión fijada.

---

## 2. Modelo multi-tenant (diseño previsto — Fase 1)

**Una sola base de datos Postgres, separación lógica por `tenantId`.** No hay
schema ni base por tenant.

Dos capas de aislamiento, independientes entre sí:

1. **Capa de aplicación (Prisma):** todo query de negocio pasa por un wrapper
   que fuerza el filtro `tenantId`. El objetivo de diseño es que sea
   *imposible olvidarse el filtro por error*, no sólo que esté por convención.
2. **Capa de base de datos (RLS de Supabase):** políticas de Row Level Security
   que filtran por el `tenantId` del usuario autenticado. Es la red de
   contención si la capa 1 falla.

### Resolución del tenant

El `middleware.ts` lee el header `Host` y decide:

- `cliente.dominio.com` → subdominio → tenant por `subdomain`.
- `www.inmobiliariax.com` → dominio propio del cliente → tenant por `customDomain`.
- `dominio.com` (raíz) → sitio de marketing del SaaS, sin tenant.

Resuelto el tenant, hace *rewrite* a una ruta interna con el `tenantId`.

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

**Estado real hoy:** sólo existe `/src/app` con el `layout.tsx` y `page.tsx` por
defecto del scaffolding. Las carpetas se van creando fase por fase, cuando hay
código real que poner adentro.

---

## 4. Roles

| Rol | Alcance |
|---|---|
| `SUPER_ADMIN` | DiseArte. Gestiona tenants, planes, módulos y plantillas. |
| `TENANT_ADMIN` | Dueño de la inmobiliaria. Gestiona su tenant y sus usuarios. |
| `TENANT_USER` | Agente. Permisos acotados dentro de su tenant. |

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
