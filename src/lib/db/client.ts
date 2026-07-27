import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/lib/env";

/**
 * Clientes de Prisma para el runtime de la app.
 *
 * Hay DOS, con roles de Postgres distintos, y la diferencia es de seguridad:
 *
 *   `prisma`      -> rol `app_user`. SUJETO A RLS. No devuelve ninguna fila si
 *                    la transaccion no seteo `app.tenant_id`. Es el que usa
 *                    `forTenant()`, o sea el 99% de la aplicacion.
 *
 *   `prismaAdmin` -> rol `postgres`. BYPASEA RLS. Solo para lo que ocurre
 *                    ANTES de que exista un tenant: resolver el host, resolver
 *                    al usuario autenticado, y el alta self-service.
 *
 * Los dos van por el TRANSACTION POOLER (6543). Las migraciones no pasan por
 * aca: usan DIRECT_URL via prisma.config.ts.
 *
 * Prisma 7 exige un driver adapter — ya no existe la opcion `datasourceUrl`.
 *
 * El singleton en `globalThis` evita que el hot reload de `next dev` abra una
 * conexion nueva en cada recarga de modulo hasta agotar el pool de Supabase.
 */

function crearCliente(connectionString: string) {
  const adapter = new PrismaPg({
    connectionString,
    // El transaction pooler (pgbouncer) no soporta sentencias preparadas.
    // El `?pgbouncer=true` de la connection string lo declara del lado de
    // Prisma; el limite de conexiones lo administra el pooler.
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function createPrismaClient() {
  return crearCliente(serverEnv().DATABASE_URL);
}

function createPrismaAdminClient() {
  return crearCliente(serverEnv().DATABASE_ADMIN_URL);
}

type ClientePrisma = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as {
  prisma: ClientePrisma | undefined;
  prismaAdmin: ClientePrisma | undefined;
};

let instancia: ClientePrisma | undefined;
let instanciaAdmin: ClientePrisma | undefined;

function obtenerCliente(): ClientePrisma {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  instancia ??= createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = instancia;
  }

  return instancia;
}

function obtenerClienteAdmin(): ClientePrisma {
  if (globalForPrisma.prismaAdmin) return globalForPrisma.prismaAdmin;

  instanciaAdmin ??= createPrismaAdminClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prismaAdmin = instanciaAdmin;
  }

  return instanciaAdmin;
}

function clienteLazy(obtener: () => ClientePrisma): ClientePrisma {
  return new Proxy({} as ClientePrisma, {
    get(_destino, propiedad) {
      const cliente = obtener();
      const valor = cliente[propiedad as keyof ClientePrisma];
      return typeof valor === "function" ? valor.bind(cliente) : valor;
    },
  });
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
export const prisma = clienteLazy(obtenerCliente);

/**
 * ⚠️ BYPASEA RLS. Ve la base entera, todos los tenants.
 *
 * Existe porque hay tres operaciones que ocurren ANTES de que exista un
 * tenant, y por lo tanto no pueden estar sujetas a un filtro por tenant:
 *
 *   - resolver un host a un tenant (es la operacion que ESTABLECE el tenant),
 *   - resolver al usuario autenticado a partir de su UUID de Supabase,
 *   - el alta self-service, que crea el tenant que todavia no existe.
 *
 * Su uso esta confinado a src/lib/db/tenants.ts y src/lib/db/users.ts. Si
 * aparece en cualquier otro archivo, es un bug de seguridad.
 */
export const prismaAdmin = clienteLazy(obtenerClienteAdmin);

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
