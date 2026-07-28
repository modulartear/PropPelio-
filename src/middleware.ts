import { NextResponse, type NextRequest } from "next/server";

import { rootDomain } from "@/lib/env";
import { refrescarSesion } from "@/lib/supabase/middleware";
import { busquedaDeTenant, resolverHost } from "@/lib/tenant/host";

/**
 * Resolucion de tenant por host.
 *
 * Lee el header `Host`, decide si el request va al sitio de marketing, a un
 * tenant por subdominio o a un tenant por dominio propio, y reescribe la URL
 * a la ruta interna correspondiente. El usuario nunca ve esta reescritura.
 *
 *   proppelio.com/precios              -> /precios                        (marketing)
 *   lopez.proppelio.com/               -> /tenants/subdomain/lopez/
 *   www.inmobiliariax.com/propiedades  -> /tenants/customDomain/inmobiliariax.com/propiedades
 *
 * NO consulta la base de datos, y no es un descuido: el middleware corre en el
 * EDGE RUNTIME, donde Prisma no funciona. Por eso reescribe con el host y el
 * `tenantId` se resuelve del lado del servidor, ya en Node, en
 * `src/lib/tenant/resolve.ts`. Ver D-019.
 */
export async function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const dominioRaiz = rootDomain();
  let resuelto = resolverHost(host, dominioRaiz);

  // Atajo SOLO de desarrollo: `?tenant=<subdominio>` sobre el dominio raiz
  // simula `<subdominio>.dominioRaiz` sin depender de que el navegador
  // resuelva un host inventado como `algo.localhost`. Hace falta porque el
  // reenvio de puertos de Codespaces no siempre tunelea bien esos hosts (ver
  // docs/setup.md) — sin esto, probar el panel de un tenant en un navegador
  // real desde un Codespace puede ser imposible. `hostSimulado` reemplaza el
  // header `Host` que ve el resto de la app (incluido `getTenantFromRequest()`
  // en Node), no solo la reescritura de acá: si no, esta pagina resolveria
  // bien la URL pero el resto del server seguiria viendo el dominio raiz.
  //
  // El valor tambien se guarda en una cookie: sin esto, cada click en un link
  // del menu (que apunta a `/admin/algo`, sin el query string) perderia el
  // tenant simulado y volveria a caer en el dominio raiz. La cookie hace que
  // el atajo sobreviva a la navegacion normal despues de usarlo una vez.
  let hostSimulado: string | null = null;
  let tenantParaCookie: string | null = null;
  if (resuelto.tipo === "raiz" && process.env.NODE_ENV === "development") {
    const tenantDeDesarrollo =
      request.nextUrl.searchParams.get("tenant") ?? request.cookies.get("dev-tenant")?.value;

    if (tenantDeDesarrollo) {
      hostSimulado = `${tenantDeDesarrollo}.${dominioRaiz}`;
      resuelto = resolverHost(hostSimulado, dominioRaiz);
      tenantParaCookie = tenantDeDesarrollo;
    }
  }

  // Host que no puede pertenecer a ningun tenant (subdominio reservado,
  // anidado, o sin header Host). Se corta antes de tocar la base y antes de
  // gastar un refresco de sesion.
  if (resuelto.tipo === "invalido") {
    return new NextResponse(null, { status: 404 });
  }

  const requestParaElResto = hostSimulado
    ? (() => {
        const headersSimulados = new Headers(request.headers);
        headersSimulados.set("host", hostSimulado);
        return { headers: headersSimulados };
      })()
    : request;

  // La respuesta se arma ANTES de refrescar la sesion, porque `refrescarSesion`
  // escribe las cookies renovadas sobre ella. Crear otra despues perderia esas
  // cookies y el usuario quedaria deslogueado de a ratos, sin patron aparente.
  let response: NextResponse;

  if (resuelto.tipo === "raiz") {
    // Sitio de marketing y flujos de auth (login, registro): sin reescritura.
    response = NextResponse.next({ request: requestParaElResto });
  } else {
    const busqueda = busquedaDeTenant(resuelto);
    if (!busqueda) {
      return new NextResponse(null, { status: 404 });
    }

    const url = request.nextUrl.clone();
    url.pathname = `/tenants/${busqueda.por}/${encodeURIComponent(busqueda.valor)}${request.nextUrl.pathname}`;

    response = NextResponse.rewrite(url, { request: requestParaElResto });
  }

  const respuestaFinal = await refrescarSesion(request, response);

  if (tenantParaCookie) {
    respuestaFinal.cookies.set("dev-tenant", tenantParaCookie, {
      path: "/",
      sameSite: "lax",
    });
  }

  return respuestaFinal;
}

export const config = {
  /**
   * Excluye lo que no tiene sentido resolver por tenant:
   * assets de Next, archivos estaticos, y los endpoints de imagen.
   *
   * `/api` SI pasa por el middleware: los endpoints publicos (formulario de
   * contacto, tasaciones) necesitan saber a que tenant pertenece el request.
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
