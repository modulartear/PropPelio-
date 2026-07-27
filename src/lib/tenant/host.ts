/**
 * Interpretacion del header `Host`.
 *
 * Funcion pura y sin dependencias: corre igual en el middleware (edge runtime)
 * que en Server Components (Node), y se puede testear sin levantar nada.
 *
 * Es la puerta de entrada de todo el multi-tenant: de aca sale a que
 * inmobiliaria pertenece un request.
 */

/**
 * Subdominios que no se pueden asignar a un tenant porque estan reservados
 * para la plataforma. Se rechazan al registrarse (Fase 2) y tambien al
 * resolver, por si alguno se colo antes de que existiera la validacion.
 */
export const SUBDOMINIOS_RESERVADOS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "auth",
  "cdn",
  "mail",
  "static",
  "assets",
  "status",
  "docs",
  "blog",
  "help",
  "support",
]);

export type HostResuelto =
  /** El dominio raiz del SaaS: sitio de marketing, sin tenant. */
  | { tipo: "raiz" }
  /** `<subdominio>.dominio.com` */
  | { tipo: "subdominio"; subdominio: string }
  /** Dominio propio de un cliente. */
  | { tipo: "dominio-custom"; dominio: string }
  /** Host que no puede pertenecer a ningun tenant. */
  | { tipo: "invalido"; motivo: string };

/**
 * Normaliza un host: minusculas, sin `www.`, sin espacios.
 *
 * El puerto NO se quita: en desarrollo el dominio raiz es `localhost:3000` y
 * los tenants viven en `tenant-a.localhost:3000`, asi que forma parte de la
 * identidad del host.
 */
export function normalizarHost(host: string): string {
  const limpio = host.trim().toLowerCase();
  return limpio.startsWith("www.") ? limpio.slice(4) : limpio;
}

/**
 * Decide a que tenant corresponde un host.
 *
 * @param host       Header `Host` crudo del request.
 * @param dominioRaiz Dominio del SaaS. En dev, `localhost:3000`.
 *
 * @example
 * resolverHost("tenant-a.localhost:3000", "localhost:3000")
 * // -> { tipo: "subdominio", subdominio: "tenant-a" }
 */
export function resolverHost(host: string | null | undefined, dominioRaiz: string): HostResuelto {
  if (!host) {
    return { tipo: "invalido", motivo: "el request no trae header Host" };
  }

  const h = normalizarHost(host);
  const raiz = normalizarHost(dominioRaiz);

  if (h === raiz) {
    return { tipo: "raiz" };
  }

  if (h.endsWith(`.${raiz}`)) {
    const subdominio = h.slice(0, -(raiz.length + 1));

    if (!subdominio) {
      return { tipo: "invalido", motivo: "subdominio vacio" };
    }

    // `a.b.dominio.com` no es un tenant: los subdominios son de un solo nivel.
    if (subdominio.includes(".")) {
      return { tipo: "invalido", motivo: `subdominio anidado: ${subdominio}` };
    }

    if (SUBDOMINIOS_RESERVADOS.has(subdominio)) {
      return { tipo: "invalido", motivo: `subdominio reservado: ${subdominio}` };
    }

    return { tipo: "subdominio", subdominio };
  }

  // Cualquier otra cosa es un dominio propio de cliente. Que exista o no se
  // resuelve contra la base; aca solo se clasifica.
  return { tipo: "dominio-custom", dominio: h };
}

/** Campo de `Tenant` contra el que se busca, y su valor. */
export type BusquedaDeTenant = {
  por: "subdomain" | "customDomain";
  valor: string;
};

/**
 * Traduce un host resuelto a la busqueda que hay que hacer en la base.
 *
 * El middleware la serializa en dos segmentos de URL (`/tenants/<por>/<valor>`)
 * en vez de en uno solo con separador: un segmento con `:` o `/` obligaria a
 * encodear y a desencodear, y cada encoding es una oportunidad de error en el
 * camino critico del aislamiento entre tenants.
 */
export function busquedaDeTenant(resuelto: HostResuelto): BusquedaDeTenant | null {
  switch (resuelto.tipo) {
    case "subdominio":
      return { por: "subdomain", valor: resuelto.subdominio };
    case "dominio-custom":
      return { por: "customDomain", valor: resuelto.dominio };
    default:
      return null;
  }
}

/** Valida el segmento `por` que llega desde la URL reescrita. */
export function esCampoDeBusqueda(valor: string): valor is BusquedaDeTenant["por"] {
  return valor === "subdomain" || valor === "customDomain";
}
