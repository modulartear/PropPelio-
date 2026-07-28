import { PanelShell } from "@/components/panel/panel-shell";
import { navParaRol } from "@/components/panel/nav-items";
import { requireTenantUser } from "@/lib/auth/session";

/**
 * Layout del panel administrativo de un tenant.
 *
 * Vive bajo `/tenants/[por]/[valor]/admin` porque es ahi donde el middleware
 * reescribe un request a `<subdominio>.dominio.com/admin` — pero ningun link
 * de la UI debe usar ese prefijo interno. Ver nav-items.ts.
 *
 * `requireTenantUser()` es la unica autorizacion que hace falta aca:
 *   - Sin sesion -> redirige a /login.
 *   - Con sesion pero de OTRO tenant -> 404 (no 403: no delata que el tenant
 *     exista). Es el chequeo central de la Fase 2 aplicado a la primera
 *     pantalla real del panel.
 *
 * No revalida el `por`/`valor` de los params contra el tenant devuelto: son
 * la MISMA fuente (el header Host), asi que ya coinciden por construccion.
 */
export default async function LayoutDelPanel({ children }: { children: React.ReactNode }) {
  const { usuario, tenant } = await requireTenantUser();

  return (
    <PanelShell
      tenantNombre={tenant.name}
      usuarioNombre={usuario.name}
      usuarioEmail={usuario.email}
      usuarioRol={usuario.role}
      items={navParaRol(usuario.role)}
    >
      {children}
    </PanelShell>
  );
}
