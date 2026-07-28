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
  const resuelto = resolverHost(host, rootDomain());

  // Host que no puede pertenecer a ningun tenant (subdominio reservado,
  // anidado, o sin header Host). Se corta antes de tocar la base y antes de
  // gastar un refresco de sesion.
  if (resuelto.tipo === "invalido") {
    return new NextResponse(null, { status: 404 });
  }

  // La respuesta se arma ANTES de refrescar la sesion, porque `refrescarSesion`
  // escribe las cookies renovadas sobre ella. Crear otra despues perderia esas
  // cookies y el usuario quedaria deslogueado de a ratos, sin patron aparente.
  let response: NextResponse;

  if (resuelto.tipo === "raiz") {
    // Sitio de marketing y flujos de auth (login, registro): sin reescritura.
    response = NextResponse.next({ request });
  } else {
    const busqueda = busquedaDeTenant(resuelto);
    if (!busqueda) {
      return new NextResponse(null, { status: 404 });
    }

    const url = request.nextUrl.clone();
    url.pathname = `/tenants/${busqueda.por}/${encodeURIComponent(busqueda.valor)}${request.nextUrl.pathname}`;

    response = NextResponse.rewrite(url, { request });
  }

  return refrescarSesion(request, response);
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
