import "server-only";

import { createClient } from "@supabase/supabase-js";

import { publicEnv, serverEnv } from "@/lib/env";

/**
 * Cliente de Supabase para el SERVIDOR, con la secret key.
 *
 * ⚠️ Esta clave BYPASEA TODAS las politicas de RLS. Cualquier query hecho con
 * este cliente ve la base entera, incluidos los datos de todos los tenants.
 *
 * Usarlo solo para operaciones administrativas que genuinamente necesitan
 * saltear RLS: alta de tenants desde el super-admin, tareas de mantenimiento,
 * webhooks. NUNCA para servir un request de un tenant — ahi el filtro por
 * `tenantId` es lo unico que separa a un cliente de los datos de otro, y esta
 * clave lo anula.
 *
 * El import de "server-only" hace que el build falle si este modulo termina
 * alcanzado desde un Client Component, en vez de filtrar la clave al browser.
 */
export function createAdminSupabaseClient() {
  const { SUPABASE_SECRET_KEY } = serverEnv();
  const { SUPABASE_URL } = publicEnv();

  return createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      // Un cliente administrativo no tiene sesion de usuario que persistir ni
      // refrescar: se crea por request y se descarta.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
