import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

import { publicEnv } from "@/lib/env";

/**
 * Refresco de la sesion en el middleware.
 *
 * Los tokens de Supabase Auth expiran. Si nadie los renueva, un usuario que
 * deja la pestaña abierta un rato aparece como deslogueado en el proximo
 * Server Component. El middleware es el unico lugar que corre antes de cada
 * request Y puede escribir cookies, asi que es donde toca renovarlos.
 *
 * La respuesta que se pasa como argumento se muta con las cookies nuevas: por
 * eso hay que reutilizarla, no crear otra despues de llamar a esta funcion.
 */
export async function refrescarSesion(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = publicEnv();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesNuevas) {
        for (const { name, value, options } of cookiesNuevas) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Esta llamada es la que dispara el refresco. No se usa el resultado aca:
  // solo interesa el efecto de escribir las cookies renovadas en la respuesta.
  await supabase.auth.getUser();

  return response;
}
