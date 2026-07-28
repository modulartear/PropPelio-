"use client";

import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";

/**
 * Cliente de Supabase para el BROWSER (Client Components).
 *
 * Usa la publishable key, que es publica por diseño: viaja en el bundle y no
 * otorga permisos por si misma. Lo que se puede leer o escribir lo decide el
 * RLS de Postgres, no el secreto de esta clave.
 *
 * Viene de `@supabase/ssr` y no de `@supabase/supabase-js` directo, y la
 * diferencia importa: esta version guarda la sesion en COOKIES en vez de
 * localStorage. Es lo unico que permite que el servidor tambien la vea — con
 * localStorage, un Server Component no puede saber quien esta logueado.
 */
export function createBrowserSupabaseClient() {
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = publicEnv();

  return createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
}
