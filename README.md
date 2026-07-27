# PropPelio

SaaS multi-tenant para inmobiliarias: panel administrativo estilo Tokko Broker más
landing pública personalizable por cliente con un builder visual tipo Elementor.

**Estado: Fase 0 (setup y fundamentos) — en curso.** Todavía no hay lógica de negocio.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Prisma · Supabase (Postgres + Auth + Storage) · Vercel

## Entorno

100% cloud. El entorno de desarrollo es **GitHub Codespaces** — no se corre nada local.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
```

## Documentación

| Documento                                      | Contenido                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| [`docs/setup.md`](docs/setup.md)               | Cómo levantar el entorno, secrets necesarios, estado del checklist |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Stack, modelo multi-tenant, estructura de carpetas                 |
| [`docs/decisiones.md`](docs/decisiones.md)     | Registro de decisiones técnicas y su justificación                 |
