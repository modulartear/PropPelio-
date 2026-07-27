import "server-only";

import { prisma } from "@/lib/db/client";

/**
 * Acceso a la tabla `users` que NO puede estar scopeado a un tenant.
 *
 * Resolver quien es el usuario autenticado es, por definicion, previo a saber
 * a que tenant pertenece: sin ese dato no hay con que scopear. Es uno de los
 * pocos usos legitimos del cliente crudo, y por eso vive dentro de
 * `src/lib/db/`, donde la regla de ESLint lo permite.
 *
 * Una vez resuelto el usuario, todo lo demas pasa por `forTenant()`.
 */

export type UsuarioActual = {
  id: string;
  email: string;
  name: string | null;
  role: "SUPER_ADMIN" | "TENANT_ADMIN" | "TENANT_USER";
  /** NULL solo para SUPER_ADMIN, que no pertenece a ningun tenant. */
  tenantId: string | null;
};

/**
 * Busca el usuario del proyecto a partir del UUID de Supabase Auth.
 *
 * Devuelve `null` si el usuario existe en `auth.users` pero todavia no tiene
 * fila en `users`. Eso pasa entre que Supabase crea la cuenta y que nuestro
 * registro la vincula: hay una ventana real, y tratarla como "no autorizado"
 * es lo correcto.
 */
export async function buscarUsuarioPorAuthId(authUserId: string): Promise<UsuarioActual | null> {
  return prisma.user.findUnique({
    where: { authUserId },
    select: { id: true, email: true, name: true, role: true, tenantId: true },
  });
}

/** ¿Ese subdominio esta libre? Se consulta desde el registro self-service. */
export async function subdominioDisponible(subdomain: string): Promise<boolean> {
  const existente = await prisma.tenant.findUnique({
    where: { subdomain },
    select: { id: true },
  });

  return existente === null;
}

/**
 * Alta self-service: crea el Tenant y su primer usuario TENANT_ADMIN.
 *
 * Va en UNA transaccion a proposito. Si fallara despues de crear el tenant,
 * quedaria una inmobiliaria sin ningun usuario que pueda administrarla, y el
 * subdominio ocupado sin que nadie pueda usarlo.
 */
export async function crearTenantConAdmin(datos: {
  nombreTenant: string;
  subdomain: string;
  authUserId: string;
  email: string;
  nombreUsuario: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: datos.nombreTenant, subdomain: datos.subdomain },
      select: { id: true, name: true, subdomain: true },
    });

    await tx.user.create({
      data: {
        tenantId: tenant.id,
        authUserId: datos.authUserId,
        email: datos.email,
        name: datos.nombreUsuario,
        role: "TENANT_ADMIN",
      },
    });

    return tenant;
  });
}
