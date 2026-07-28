import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { buscarUsuarioPorAuthId, type UsuarioActual } from "@/lib/db/users";
import { getAuthUser } from "@/lib/supabase/server";
import { getTenantFromRequest, type TenantContext } from "@/lib/tenant/resolve";

export type { UsuarioActual };

/**
 * Sesion del usuario: quien es, que rol tiene y a que tenant pertenece.
 *
 * Junta las dos mitades del sistema de identidad:
 * - Supabase Auth sabe QUIEN se autentico (`auth.users`, un UUID).
 * - Nuestra tabla `users` sabe QUE PUEDE HACER (rol, tenant).
 *
 * El vinculo entre ambas es `User.authUserId`. Ver D-021.
 */

/**
 * Usuario autenticado, o `null` si no hay sesion.
 *
 * Cacheado por request: varios Server Components pueden pedirlo y se hace un
 * solo query. `cache()` de React memoiza por request, no globalmente — no hay
 * riesgo de servirle a alguien la sesion de otro.
 */
export const getCurrentUser = cache(async (): Promise<UsuarioActual | null> => {
  const authUser = await getAuthUser();

  if (!authUser) return null;

  return buscarUsuarioPorAuthId(authUser.id);
});

/**
 * Igual, pero manda al login si no hay sesion.
 *
 * Devuelve `UsuarioActual` sin el caso nulo, asi el resto del codigo no lo
 * arrastra.
 */
export async function requireUser(): Promise<UsuarioActual> {
  const usuario = await getCurrentUser();

  if (!usuario) {
    redirect("/login");
  }

  return usuario;
}

/**
 * Exige un usuario que pertenezca AL TENANT DEL REQUEST ACTUAL.
 *
 * Es el guard central del panel de cada inmobiliaria, y hace dos chequeos que
 * son distintos y ambos necesarios:
 *
 *   1. Que haya sesion.
 *   2. Que el `tenantId` del usuario coincida con el tenant que resolvio el
 *      host. Sin esto, un TENANT_ADMIN logueado en su panel podria escribir
 *      el subdominio de otra inmobiliaria y entrar con su propia sesion.
 *
 * Ante la falta de coincidencia responde 404 y no 403: un 403 confirmaria que
 * ese tenant existe.
 */
export async function requireTenantUser(): Promise<{
  usuario: UsuarioActual;
  tenant: TenantContext;
}> {
  const tenant = await getTenantFromRequest();

  if (!tenant) {
    notFound();
  }

  const usuario = await requireUser();

  // El SUPER_ADMIN no pertenece a ningun tenant, asi que tampoco entra al
  // panel de uno por esta puerta. Si mas adelante hace falta que pueda
  // "entrar como" un tenant para dar soporte, tiene que ser un flujo
  // explicito y auditable, no un permiso implicito.
  if (usuario.tenantId !== tenant.id) {
    notFound();
  }

  return { usuario, tenant };
}

/**
 * Exige rol SUPER_ADMIN.
 *
 * Responde 404 y no 403 ante un rol insuficiente: para alguien que no es
 * super-admin, el panel central directamente no existe.
 */
export async function requireSuperAdmin(): Promise<UsuarioActual> {
  const usuario = await requireUser();

  if (usuario.role !== "SUPER_ADMIN") {
    notFound();
  }

  return usuario;
}

/**
 * Exige rol TENANT_ADMIN dentro del tenant actual.
 *
 * Para acciones que un agente (`TENANT_USER`) no puede hacer: invitar
 * usuarios, cambiar la configuracion de marca, conectar un dominio propio.
 */
export async function requireTenantAdmin(): Promise<{
  usuario: UsuarioActual;
  tenant: TenantContext;
}> {
  const { usuario, tenant } = await requireTenantUser();

  if (usuario.role !== "TENANT_ADMIN") {
    notFound();
  }

  return { usuario, tenant };
}
