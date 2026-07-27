import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/lib/env";

/**
 * Cliente de Prisma para el runtime de la app.
 *
 * Se conecta por el TRANSACTION POOLER de Supabase (DATABASE_URL, puerto 6543).
 * Las migraciones NO pasan por aca: usan DIRECT_URL via prisma.config.ts.
 *
 * Prisma 7 exige un driver adapter — ya no existe la opcion `datasourceUrl`.
 * Para Postgres el oficial es `@prisma/adapter-pg`.
 *
 * El singleton en `globalThis` evita que el hot reload de `next dev` abra una
 * conexion nueva en cada recarga de modulo hasta agotar el pool de Supabase.
 * En produccion no hace falta, porque el modulo se evalua una sola vez.
 */

function createPrismaClient() {
  const { DATABASE_URL } = serverEnv();

  const adapter = new PrismaPg({
    connectionString: DATABASE_URL,
    // El transaction pooler (pgbouncer) no soporta sentencias preparadas.
    // El `?pgbouncer=true` de la connection string lo declara del lado de
    // Prisma; el limite de conexiones lo administra el pooler.
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * NOTA PARA LA FASE 1
 *
 * Este cliente es el acceso CRUDO a la base y no filtra por tenant. En la
 * Fase 1 se agrega encima un wrapper que fuerza el filtro `tenantId` en todo
 * query de negocio, y a partir de ahi este export deberia usarse solo desde
 * esa capa — no directamente desde Server Components o Server Actions.
 */
