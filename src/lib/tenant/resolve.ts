import "server-only";

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";

import { buscarTenantActivo, type CampoDeHost, type TenantContext } from "@/lib/db/tenants";
import { rootDomain } from "@/lib/env";
import { busquedaDeTenant, resolverHost } from "@/lib/tenant/host";

export type { TenantContext };

/**
 * Resolucion del tenant del lado del servidor.
 *
 * El middleware ya clasifico el host, pero no pudo tocar la base porque corre
 * en el edge runtime. Aca, ya en Node, se traduce ese host al registro real.
 */

/**
 * Busca un tenant y cachea el resultado POR REQUEST.
 *
 * `cache()` de React memoiza por request, no globalmente: varios Server
 * Components pueden pedir el tenant y se hace un solo query, sin riesgo de
 * servirle a una inmobiliaria datos cacheados de otra.
 */
const buscarCacheado = cache(
  async (por: CampoDeHost, valor: string): Promise<TenantContext | null> =>
    buscarTenantActivo(por, valor),
);

/**
 * Resuelve el tenant del request actual a partir del header `Host`.
 *
 * Reutilizable desde Server Components y Server Actions — es el
 * `getTenantFromRequest()` que pide el plan.
 *
 * Devuelve `null` cuando el request va al sitio de marketing (dominio raiz) o
 * cuando el host no corresponde a ningun tenant activo. Quien llama decide si
 * eso es un 404: para paginas de tenant, usar `requireTenant()`.
 */
export async function getTenantFromRequest(): Promise<TenantContext | null> {
  const listaDeHeaders = await headers();
  const busqueda = busquedaDeTenant(resolverHost(listaDeHeaders.get("host"), rootDomain()));

  if (!busqueda) return null;

  return buscarCacheado(busqueda.por, busqueda.valor);
}

/**
 * Igual que `getTenantFromRequest()`, pero corta con 404 si no hay tenant.
 *
 * Es la forma correcta de obtenerlo en cualquier pagina o accion que solo
 * tenga sentido dentro de un tenant. Devuelve `TenantContext` y no
 * `TenantContext | null`, asi el resto del codigo no arrastra el caso nulo.
 *
 * Responde 404 y no 500 a proposito: pedir un tenant que no existe es una URL
 * equivocada, no un error del servidor. Y no distingue "no existe" de
 * "existe pero esta suspendido" — decir cual de las dos es filtraria que
 * subdominios estan tomados.
 */
export async function requireTenant(): Promise<TenantContext> {
  const tenant = await getTenantFromRequest();

  if (!tenant) {
    notFound();
  }

  return tenant;
}

/**
 * Resuelve el tenant a partir de los segmentos que escribio el middleware en
 * la URL reescrita (`/tenants/<por>/<valor>/...`).
 *
 * Sirve para las paginas bajo `/tenants/[por]/[valor]`, que reciben esos
 * valores como params y no necesitan volver a leer el header.
 *
 * ⚠️ `por` viene de la URL. Aunque en condiciones normales lo escribe el
 * middleware, alguien puede pedir esa ruta a mano: por eso se valida contra
 * los dos valores permitidos antes de usarlo como nombre de campo.
 */
export async function tenantDesdeSegmentos(por: string, valor: string): Promise<TenantContext> {
  if (por !== "subdomain" && por !== "customDomain") {
    notFound();
  }

  const tenant = await buscarCacheado(por, decodeURIComponent(valor));

  if (!tenant) {
    notFound();
  }

  return tenant;
}
