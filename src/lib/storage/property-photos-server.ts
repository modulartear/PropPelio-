import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BUCKET, pathDeFoto, validarArchivo } from "./property-photos";

/**
 * Operaciones de Storage para fotos de propiedades.
 *
 * Usan `createServerSupabaseClient()` — la sesion REAL del usuario logueado
 * — y no el cliente admin. Es a proposito: las politicas de RLS del bucket
 * (ver la migracion `*_propiedades`) comparan `auth.uid()` contra el tenant
 * del usuario autenticado. Si esto usara el cliente admin, bypasearia esas
 * politicas igual que `prismaAdmin` bypasea las de Postgres — mismo error de
 * seguridad, mismo principio que D-025.
 */

export async function subirFotoDeProperty(
  tenantId: string,
  propertyId: string,
  archivo: File,
): Promise<{ path: string } | { error: string }> {
  const motivoDeRechazo = validarArchivo(archivo);
  if (motivoDeRechazo) {
    return { error: motivoDeRechazo };
  }

  const path = pathDeFoto(tenantId, propertyId, archivo.type);
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.storage.from(BUCKET).upload(path, archivo, {
    contentType: archivo.type,
    upsert: false,
  });

  if (error) {
    return { error: "No se pudo subir la foto. Intentá de nuevo." };
  }

  return { path };
}

export async function borrarFotoDeProperty(path: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    return { error: "No se pudo borrar la foto del almacenamiento." };
  }

  return {};
}
