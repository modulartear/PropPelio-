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

type ClientePrisma = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as { prisma: ClientePrisma | undefined };

let instancia: ClientePrisma | undefined;

function obtenerCliente(): ClientePrisma {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  instancia ??= createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = instancia;
  }

  return instancia;
}

/**
 * El cliente se instancia en el PRIMER USO, no al importar el modulo.
 *
 * Con instanciacion al importar, `next build` fallaba: al recolectar los datos
 * de las paginas evalua los modulos, y crear el cliente exige DATABASE_URL.
 * Eso obligaria a tener credenciales de base para poder compilar — algo que un
 * build no deberia necesitar, y que romperia cualquier CI sin secrets.
 *
 * El Proxy mantiene la ergonomia (`prisma.tenant.findFirst()`) difiriendo la
 * construccion hasta que alguien accede a una propiedad de verdad. Las
 * funciones se bindean al cliente real para no perder el `this`.
 */
export const prisma = new Proxy({} as ClientePrisma, {
  get(_destino, propiedad) {
    const cliente = obtenerCliente();
    const valor = cliente[propiedad as keyof ClientePrisma];
    return typeof valor === "function" ? valor.bind(cliente) : valor;
  },
});

/**
 * ⚠️ ESTE CLIENTE NO FILTRA POR TENANT. Ve la base entera.
 *
 * Para cualquier dato que pertenezca a un tenant, usar `forTenant(tenantId)`
 * de `@/lib/db` — devuelve un cliente que inyecta el filtro solo.
 *
 * Este export directo queda reservado a operaciones que legitimamente cruzan
 * tenants: resolver un tenant por host, el panel de super-admin (Fase 5),
 * seeds y migraciones. Una regla de ESLint bloquea su import fuera de
 * `src/lib/db/**` para que usarlo sea una decision consciente y no un olvido.
 */
