import "server-only";

import { prismaAdmin } from "@/lib/db/client";

/**
 * Acceso a la tabla `tenants`.
 *
 * Es uno de los pocos lugares que usan el cliente CRUDO de forma legitima:
 * buscar a que inmobiliaria pertenece un host es, por definicion, la operacion
 * que todavia no puede estar scopeada a una inmobiliaria. Vive dentro de
 * `src/lib/db/` porque es ahi donde la regla de ESLint permite ese import, y
 * asi todo el acceso sin filtro queda concentrado en un solo directorio
 * facil de auditar.
 */

/** Lo minimo que necesita la app para operar en nombre de un tenant. */
export type TenantContext = {
  id: string;
  name: string;
  subdomain: string;
  customDomain: string | null;
};

/** Campo de `Tenant` contra el que se puede resolver un host. */
export type CampoDeHost = "subdomain" | "customDomain";

/**
 * Busca un tenant ACTIVO por subdominio o por dominio propio.
 *
 * Devuelve `null` si no existe o si esta suspendido: un tenant suspendido deja
 * de responder en su landing y su panel, pero sus datos se conservan.
 */
export async function buscarTenantActivo(
  por: CampoDeHost,
  valor: string,
): Promise<TenantContext | null> {
  return prismaAdmin.tenant.findFirst({
    where: {
      [por]: valor,
      status: "ACTIVE",
    },
    select: { id: true, name: true, subdomain: true, customDomain: true },
  });
}
