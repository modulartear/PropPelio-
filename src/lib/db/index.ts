/**
 * Punto de entrada de la capa de acceso a datos.
 *
 * Para datos de un tenant:
 *
 *   import { forTenant } from "@/lib/db";
 *   const db = forTenant(tenant.id);
 *
 * El cliente crudo (`@/lib/db/client`) NO se reexporta desde aca a proposito:
 * importarlo tiene que costar un import explicito y distinto, porque ve la
 * base entera. Una regla de ESLint lo bloquea fuera de `src/lib/db/**`.
 */
export { forTenant, type TenantClient } from "@/lib/db/tenant-client";
