import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PhotoManager } from "@/components/properties/photo-manager";
import { PropertyForm } from "@/components/properties/property-form";
import { requireTenantUser } from "@/lib/auth/session";
import { forTenant } from "@/lib/db";
import { publicEnv } from "@/lib/env";
import { actualizarPropiedad, eliminarPropiedad } from "@/lib/properties/acciones";
import type { ValoresDePropiedad } from "@/lib/properties/validacion";
import { urlPublicaDeFoto } from "@/lib/storage/property-photos";

export const metadata: Metadata = {
  title: "Editar propiedad",
};

export default async function DetalleDePropiedad({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenant } = await requireTenantUser();
  const db = forTenant(tenant.id);

  // findFirst y no findUnique: el scope de tenant que agrega forTenant() se
  // inyecta en el `where`, y un `where` de mas de un campo no es valido para
  // findUnique salvo que sea un @@unique compuesto. Si el id es de otro
  // tenant, esto no encuentra nada — mismo resultado que si no existiera.
  const propiedad = await db.property.findFirst({
    where: { id },
    include: { photos: { orderBy: { order: "asc" } } },
  });

  if (!propiedad) {
    notFound();
  }

  const valoresIniciales: Partial<ValoresDePropiedad> = {
    title: propiedad.title,
    description: propiedad.description,
    propertyType: propiedad.propertyType,
    operationType: propiedad.operationType,
    status: propiedad.status,
    price: propiedad.price === null ? null : Number(propiedad.price),
    currency: propiedad.currency,
    addressStreet: propiedad.addressStreet,
    addressCity: propiedad.addressCity,
    addressProvince: propiedad.addressProvince,
    addressZip: propiedad.addressZip,
    bedrooms: propiedad.bedrooms,
    bathrooms: propiedad.bathrooms,
    totalArea: propiedad.totalArea,
    coveredArea: propiedad.coveredArea,
    garageSpaces: propiedad.garageSpaces,
  };

  const { SUPABASE_URL } = publicEnv();
  const fotos = propiedad.photos.map((foto) => ({
    id: foto.id,
    url: urlPublicaDeFoto(SUPABASE_URL, foto.path),
  }));

  const borrarPropiedad = eliminarPropiedad.bind(null, id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{propiedad.title}</h1>
          <p className="text-sm text-muted-foreground">Editá los datos o gestioná las fotos.</p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Borrar propiedad</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Borrar esta propiedad?</AlertDialogTitle>
              <AlertDialogDescription>
                Se borra la propiedad y todas sus fotos. No se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <form action={borrarPropiedad}>
                <AlertDialogAction type="submit" variant="destructive">
                  Borrar
                </AlertDialogAction>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Fotos</h2>
        <PhotoManager propertyId={propiedad.id} fotos={fotos} />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Datos de la propiedad</h2>
        <PropertyForm
          accion={actualizarPropiedad.bind(null, id)}
          valoresIniciales={valoresIniciales}
          textoBoton="Guardar cambios"
        />
      </section>
    </div>
  );
}
