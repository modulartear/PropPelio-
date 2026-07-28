import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/env";

/**
 * Cliente de Supabase para el SERVIDOR, con la sesion del usuario.
 *
 * Lee la sesion de las cookies, asi que actua EN NOMBRE del usuario logueado y
 * queda sujeto a las politicas de RLS. Es lo contrario del cliente de
 * `admin.ts`, que usa la secret key y las bypasea.
 *
 * Sirve en Server Components, Server Actions y Route Handlers.
 */
export async function createServerSupabaseClient() {
  // `cookies()` va PRIMERO, antes de leer las variables de entorno, y el orden
  // es funcional: es la llamada que le dice a Next que la ruta es dinamica.
  // Si `publicEnv()` fuera antes y tirara error por una variable faltante,
  // Next nunca veria el `cookies()`, intentaria prerenderizar la pagina en el
  // build, y fallaria el build entero en vez de fallar en runtime. Un build no
  // deberia necesitar credenciales.
  const almacenDeCookies = await cookies();
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = publicEnv();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return almacenDeCookies.getAll();
      },
      setAll(cookiesNuevas) {
        try {
          for (const { name, value, options } of cookiesNuevas) {
            almacenDeCookies.set(name, value, options);
          }
        } catch {
          // Los Server Components no pueden escribir cookies: solo el
          // middleware, las Server Actions y los Route Handlers pueden.
          // Se ignora a proposito — el middleware ya refresco la sesion antes
          // de llegar aca, asi que no se pierde nada.
        }
      },
    },
  });
}

/**
 * Devuelve el usuario autenticado de Supabase, o `null`.
 *
 * Usa `getUser()` y NO `getSession()`. La diferencia es de seguridad: los
 * datos de `getSession()` salen de la cookie y podrian estar manipulados,
 * mientras que `getUser()` los valida contra el servidor de Supabase. En el
 * servidor hay que usar siempre `getUser()`.
 */
export async function getAuthUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
