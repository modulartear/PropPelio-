import { createClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env";

/**
 * Cliente de Supabase para el BROWSER.
 *
 * Usa la publishable key, que es publica por diseño: viaja en el bundle y no
 * da mas permisos que los que otorgue el RLS de Postgres. La seguridad real la
 * pone RLS, no el secreto de esta clave.
 *
 * Sirve para Auth y Storage desde Client Components. Los datos de negocio se
 * leen por Prisma del lado del servidor, no por aca.
 */
export function createBrowserSupabaseClient() {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = publicEnv();

  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}

/**
 * NOTA PARA LA FASE 2
 *
 * Para sesiones persistidas en cookies entre Server Components, middleware y
 * browser hace falta `@supabase/ssr`, no este cliente. Se instala en la Fase 2
 * (autenticacion), que es donde aparece ese requerimiento. En Fase 0 solo
 * dejamos configurado el acceso basico a Auth y Storage.
 */
