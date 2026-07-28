"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireTenantUser } from "@/lib/auth/session";
import { forTenant } from "@/lib/db";
import { validarPropiedad } from "@/lib/properties/validacion";
import {
  BUCKET,
  hayLugarParaOtraFoto,
  MAX_FOTOS_POR_PROPIEDAD,
} from "@/lib/storage/property-photos";
import { borrarFotoDeProperty, subirFotoDeProperty } from "@/lib/storage/property-photos-server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Server Actions del CRUD de propiedades.
 *
 * Todas empiezan igual: `requireTenantUser()` resuelve la sesion Y el tenant
 * del host a la vez (ver Fase 2). A partir de ahi, `forTenant(tenant.id)`
 * hace que cada query quede filtrado por tenantId sin que haya que
 * acordarse — y sin poder ver ni tocar propiedades de otro tenant aunque
 * alguien mande un id ajeno a mano.
 */

export type EstadoDeFormulario = {
  error?: string;
  campos?: Record<string, string>;
};

function rutaDeLaLista(): string {
  return "/admin/propiedades";
}

function rutaDeLaPropiedad(id: string): string {
  return `/admin/propiedades/${id}`;
}

export async function crearPropiedad(
  _estadoPrevio: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const { tenant } = await requireTenantUser();

  const resultado = validarPropiedad(formData);
  if ("errores" in resultado) {
    return { campos: resultado.errores };
  }

  const db = forTenant(tenant.id);
  // tenantId va explicito ademas de por la extension de forTenant(): Prisma
  // exige el campo en el tipo de `create()` porque no conoce, en tiempo de
  // tipos, que la extension lo va a inyectar en runtime. Es el mismo valor
  // en los dos lugares — redundante pero no un riesgo, forTenant() lo
  // sobrescribe igual si llegara a diferir.
  const propiedad = await db.property.create({
    data: { ...resultado.valores, tenantId: tenant.id },
  });

  revalidatePath(rutaDeLaLista());
  redirect(rutaDeLaPropiedad(propiedad.id));
}

export async function actualizarPropiedad(
  id: string,
  _estadoPrevio: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const { tenant } = await requireTenantUser();

  const resultado = validarPropiedad(formData);
  if ("errores" in resultado) {
    return { campos: resultado.errores };
  }

  const db = forTenant(tenant.id);

  // updateMany y no update: `update` exige un `where` por campo unico (solo
  // `id` en este modelo), y ahi el scope de tenant no se puede inyectar sin
  // reescribir la operacion — igual que found con findUnique en
  // tenant-scope.ts. `updateMany` acepta cualquier where, incluido el
  // tenantId que forTenant() agrega solo. Si `id` fuera de otro tenant, el
  // where no matchea ninguna fila y count da 0 — no hay excepcion que
  // delate que la fila existe en otro lado.
  const { count } = await db.property.updateMany({
    where: { id },
    data: resultado.valores,
  });

  if (count === 0) {
    return { error: "No se encontró la propiedad." };
  }

  revalidatePath(rutaDeLaLista());
  revalidatePath(rutaDeLaPropiedad(id));
  redirect(rutaDeLaPropiedad(id));
}

export async function eliminarPropiedad(id: string): Promise<void> {
  const { tenant } = await requireTenantUser();
  const db = forTenant(tenant.id);

  // Las fotos hay que borrarlas de Storage A MANO: el ON DELETE CASCADE de
  // Postgres borra las filas de property_photos, pero Storage es un sistema
  // aparte que Postgres no conoce. Sin este paso, los archivos quedarian
  // huerfanos en el bucket para siempre.
  const fotos = await db.propertyPhoto.findMany({
    where: { propertyId: id },
    select: { path: true },
  });

  await db.property.deleteMany({ where: { id } });

  if (fotos.length > 0) {
    const supabase = await createServerSupabaseClient();
    await supabase.storage.from(BUCKET).remove(fotos.map((f) => f.path));
  }

  revalidatePath(rutaDeLaLista());
  redirect(rutaDeLaLista());
}

/**
 * Sube una o mas fotos a una propiedad.
 *
 * Recibe todos los archivos del campo `fotos` (input `multiple`). Sube los
 * que entren en el limite de {@link MAX_FOTOS_POR_PROPIEDAD} y avisa si
 * alguno quedo afuera — no rechaza la subida entera por unos pocos de mas.
 */
export async function subirFotos(
  propertyId: string,
  _estadoPrevio: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const { tenant } = await requireTenantUser();
  const db = forTenant(tenant.id);

  const propiedad = await db.property.findFirst({
    where: { id: propertyId },
    select: { id: true, _count: { select: { photos: true } } },
  });

  if (!propiedad) {
    return { error: "No se encontró la propiedad." };
  }

  const archivos = formData
    .getAll("fotos")
    .filter((v): v is File => v instanceof File && v.size > 0);

  if (archivos.length === 0) {
    return { error: "Elegí al menos una foto." };
  }

  let cantidadActual = propiedad._count.photos;
  const errores: string[] = [];
  let subidas = 0;

  const ultimaFoto = await db.propertyPhoto.findFirst({
    where: { propertyId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  let siguienteOrden = (ultimaFoto?.order ?? -1) + 1;

  for (const archivo of archivos) {
    if (!hayLugarParaOtraFoto(cantidadActual)) {
      errores.push(`Se alcanzó el máximo de ${MAX_FOTOS_POR_PROPIEDAD} fotos.`);
      break;
    }

    const resultado = await subirFotoDeProperty(tenant.id, propertyId, archivo);

    if ("error" in resultado) {
      errores.push(`${archivo.name}: ${resultado.error}`);
      continue;
    }

    await db.propertyPhoto.create({
      data: { propertyId, path: resultado.path, order: siguienteOrden, tenantId: tenant.id },
    });

    siguienteOrden += 1;
    cantidadActual += 1;
    subidas += 1;
  }

  revalidatePath(rutaDeLaPropiedad(propertyId));

  if (errores.length > 0) {
    return { error: `${subidas} foto(s) subida(s). ${errores.join(" ")}` };
  }

  return {};
}

export async function eliminarFoto(photoId: string): Promise<void> {
  const { tenant } = await requireTenantUser();
  const db = forTenant(tenant.id);

  const foto = await db.propertyPhoto.findFirst({
    where: { id: photoId },
    select: { id: true, path: true, propertyId: true },
  });

  if (!foto) return;

  await db.propertyPhoto.deleteMany({ where: { id: photoId } });
  await borrarFotoDeProperty(foto.path);

  revalidatePath(rutaDeLaPropiedad(foto.propertyId));
}
