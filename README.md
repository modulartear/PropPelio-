# PropPelio

SaaS multi-tenant para inmobiliarias: panel administrativo estilo Tokko Broker más
landing pública personalizable por cliente con un builder visual tipo Elementor.

**Estado: Fase 3.1 (esqueleto del panel admin).** Multi-tenant con auth y RLS (Fases 1-2) más el layout del panel administrativo con shadcn/ui. Los módulos de negocio (propiedades, leads, tasaciones) llegan en las próximas sub-etapas.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Prisma · Supabase (Postgres + Auth + Storage) · Vercel

## Entorno

100% cloud. El entorno de desarrollo es **GitHub Codespaces** — no se corre nada local.

```bash
npm install
npm run dev       # http://localhost:3000
npm run build
npm run lint
npm test          # tests, sin dependencias externas
npm run db:deploy # aplica migraciones
npm run db:seed   # tenants de prueba
```

## Documentación

| Documento                                      | Contenido                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| [`docs/setup.md`](docs/setup.md)               | Cómo levantar el entorno, secrets necesarios, estado del checklist |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Stack, modelo multi-tenant, estructura de carpetas                 |
| [`docs/decisiones.md`](docs/decisiones.md)     | Registro de decisiones técnicas y su justificación                 |
