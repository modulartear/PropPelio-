/**
 * Reglas de las fotos de propiedades: limites, validacion y construccion de
 * paths. Funciones puras, sin dependencias — se testean sin Supabase.
 *
 * El bucket `property-photos` es publico para LECTURA (son fotos de
 * marketing, no archivos privados) pero restringido para escritura via RLS
 * de Storage. Ver la migracion `*_propiedades` y D-030.
 */

export const BUCKET = "property-photos";

/** 5MB. Tambien se aplica del lado de Storage (`file_size_limit` del bucket). */
export const MAX_BYTES_POR_FOTO = 5 * 1024 * 1024;

/**
 * 20 fotos por propiedad. A diferencia del tamaño, esto NO lo puede aplicar
 * Storage — es una regla de negocio que valida el Server Action antes de subir.
 */
export const MAX_FOTOS_POR_PROPIEDAD = 20;

const EXTENSION_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MIME_PERMITIDOS = Object.keys(EXTENSION_POR_MIME);

export type ArchivoAValidar = { size: number; type: string };

/**
 * Motivo por el que un archivo no se puede subir, o `null` si esta bien.
 *
 * Se valida en el cliente (feedback inmediato) y se REVALIDA acá mismo del
 * lado del servidor antes de subir — la validacion del cliente nunca es una
 * garantia, es solo UX.
 */
export function validarArchivo(archivo: ArchivoAValidar): string | null {
  if (!MIME_PERMITIDOS.includes(archivo.type)) {
    return "Formato no soportado. Usá JPG, PNG o WEBP.";
  }

  if (archivo.size > MAX_BYTES_POR_FOTO) {
    return `El archivo pesa más de ${MAX_BYTES_POR_FOTO / 1024 / 1024}MB.`;
  }

  if (archivo.size === 0) {
    return "El archivo está vacío.";
  }

  return null;
}

/** ¿Se puede agregar una foto mas dado cuantas tiene ya la propiedad? */
export function hayLugarParaOtraFoto(fotosActuales: number): boolean {
  return fotosActuales < MAX_FOTOS_POR_PROPIEDAD;
}

/**
 * Path dentro del bucket para una foto nueva.
 *
 * NO usa el nombre de archivo original: solo la extension, derivada del mime
 * (no del nombre) para que no se pueda falsificar. El nombre del archivo del
 * usuario puede traer espacios, caracteres raros, o intentos de path
 * traversal ("../../etc") — evitarlo de raiz es mas simple y mas seguro que
 * sanitizarlo.
 *
 * `<tenantId>/<propertyId>/<id-random>.<ext>` — el primer segmento es contra
 * lo que comparan las politicas de RLS del bucket.
 */
export function pathDeFoto(tenantId: string, propertyId: string, mimeType: string): string {
  const ext = EXTENSION_POR_MIME[mimeType];

  if (!ext) {
    throw new Error(`Mime type no soportado: ${mimeType}. Llamar validarArchivo() antes.`);
  }

  const id = crypto.randomUUID();
  return `${tenantId}/${propertyId}/${id}.${ext}`;
}

/**
 * URL publica de una foto a partir de su path.
 *
 * Se guarda el path en la base y no la URL (ver comentario en el schema):
 * esta funcion es la unica que sabe como convertir uno en otra, asi que un
 * cambio de dominio de Supabase se arregla en un solo lugar.
 */
export function urlPublicaDeFoto(supabaseUrl: string, path: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}
