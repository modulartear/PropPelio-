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
 * Esto es la capa 1 de aislamiento entre tenants. La capa 2 (RLS en Postgres)
 * entra en la Fase 2, cuando exista un usuario autenticado contra el cual
 * escribir las politicas. Ver docs/arquitectura.md §2.
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

          if (scope.sinCambios) {
            return query(args);
          }

          // Si hubo reescritura de operacion (findUnique -> findFirst),
          // `query()` seguiria ejecutando la original. Hay que delegar en la
          // nueva sobre el cliente CRUDO: los args ya llevan el filtro, y
          // pasar por el extendido causaria recursion infinita.
          if (scope.operacion !== operation && model) {
            const delegado = (
              prisma as unknown as Record<string, Record<string, (a: ArgsDeQuery) => unknown>>
            )[delegadoDe(model)];
            return delegado[scope.operacion](scope.args);
          }

          return query(scope.args);
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
 * LIMITACION CONOCIDA
 *
 * El filtro se aplica al modelo raiz del query, no a las relaciones anidadas
 * de un `include` o `select`. Un `include: { propiedades: true }` trae las
 * propiedades relacionadas sin volver a filtrar por tenant.
 *
 * En la practica no abre una fuga: se llega a esas filas a traves de una raiz
 * que si esta filtrada, y las relaciones son por clave foranea dentro del
 * mismo tenant. Pero es la razon por la que RLS (Fase 2) importa como segunda
 * capa, y por la que la auditoria de la Fase 8 tiene que probar este caso.
 */
