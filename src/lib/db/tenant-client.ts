import "server-only";

import { prisma } from "@/lib/db/client";
import { aplicarScopeDeTenant, delegadoDe, type ArgsDeQuery } from "@/lib/db/tenant-scope";

/**
 * Cliente de Prisma scopeado a un tenant.
 *
 * `forTenant(id).user.findMany()` se comporta como
 * `prisma.user.findMany({ where: { tenantId: id } })`, pero sin que quien
 * escribe el query tenga que acordarse del filtro — y sin que pueda omitirlo.
 *
 * Activa LAS DOS capas de aislamiento a la vez:
 *
 *   Capa 1 — inyecta `where: { tenantId }` en los argumentos del query.
 *   Capa 2 — corre dentro de una transaccion que declara `app.tenant_id`, que
 *            es contra lo que comparan las politicas de RLS en Postgres.
 *
 * Son independientes a proposito. Si un bug futuro dejara pasar un query sin
 * filtro, la capa 2 hace que Postgres igual no devuelva filas ajenas.
 *
 * COSTO: cada operacion es una transaccion con una sentencia extra. Es el
 * precio de que RLS aplique tambien al camino de Prisma, que se conecta con un
 * rol que —a diferencia de `postgres`— no puede ignorar las politicas. Ver
 * D-025 y la migracion *_rls_aislamiento_por_tenant.
 *
 * La logica de inyeccion vive en tenant-scope.ts, sin dependencias, para poder
 * testearla sin base de datos.
 */
function crearClienteDeTenant(tenantId: string) {
  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({
          model,
          operation,
          args,
          query,
        }: {
          model?: string;
          operation: string;
          args: ArgsDeQuery;
          query: (args: ArgsDeQuery) => Promise<unknown>;
        }) {
          const scope = aplicarScopeDeTenant(model, operation, args, tenantId);

          // Toda operacion corre dentro de una transaccion que declara el
          // tenant actual, porque de eso dependen las politicas de RLS.
          //
          // El tercer argumento `true` de set_config hace la variable LOCAL a
          // la transaccion. Es esencial con el transaction pooler: sin eso, la
          // conexion vuelve al pool con el tenant del request anterior pegado,
          // y el siguiente request que la tome ve datos ajenos. Ese seria el
          // bug exacto que todo esto busca evitar.
          //
          // No se ejecuta `query()` adentro de la transaccion: `query` esta
          // atado al cliente de afuera y usaria OTRA conexion, donde el
          // set_config no existe. Hay que redespachar sobre `tx`.
          return prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;

            const nombreDelegado = model ? delegadoDe(model) : null;

            if (!nombreDelegado) {
              return query(scope.sinCambios ? args : scope.args);
            }

            const delegado = (
              tx as unknown as Record<string, Record<string, (a: ArgsDeQuery) => unknown>>
            )[nombreDelegado];

            return delegado[scope.operacion](scope.sinCambios ? args : scope.args);
          });
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof crearClienteDeTenant>;

/**
 * Cache de clientes por tenant.
 *
 * Cada `$extends` construye un proxy nuevo; rehacerlo en cada request seria
 * gasto puro. Los clientes extendidos comparten el pool de conexiones del
 * cliente base, asi que cachearlos no abre conexiones extra.
 */
const cache = new Map<string, TenantClient>();

/**
 * Devuelve el cliente de Prisma scopeado a `tenantId`.
 *
 * @example
 * const db = forTenant(tenant.id);
 * const agentes = await db.user.findMany({ where: { role: "TENANT_USER" } });
 * // -> where: { role: "TENANT_USER", tenantId: tenant.id }
 */
export function forTenant(tenantId: string): TenantClient {
  if (!tenantId) {
    throw new Error("forTenant() recibio un tenantId vacio. Es un bug: nunca debe pasar.");
  }

  const existente = cache.get(tenantId);
  if (existente) return existente;

  const cliente = crearClienteDeTenant(tenantId);
  cache.set(tenantId, cliente);
  return cliente;
}

/**
 * LIMITACIONES CONOCIDAS
 *
 * 1. La capa 1 filtra el modelo raiz del query, no las relaciones anidadas de
 *    un `include` o `select`. Un `include: { propiedades: true }` trae las
 *    relacionadas sin volver a inyectar el filtro.
 *
 *    Con RLS activo esto ya no es una fuga: la capa 2 se aplica a nivel de
 *    fila, tambien a las relaciones, porque la transaccion entera corre con el
 *    tenant declarado. Es exactamente el caso que motiva tener dos capas.
 *
 * 2. No se puede llamar a `$transaction()` sobre un cliente de tenant: cada
 *    operacion ya abre la suya, y Prisma no soporta transacciones anidadas.
 *    Para varias operaciones en una sola transaccion hay que agregar un helper
 *    que setee `app.tenant_id` una vez y reciba el `tx`. Todavia no hizo falta;
 *    cuando aparezca la primera operacion multi-paso (Fase 3), va aca.
 */
