import type { Metadata } from "next";

import { PropertyForm } from "@/components/properties/property-form";
import { requireTenantUser } from "@/lib/auth/session";
import { crearPropiedad } from "@/lib/properties/acciones";

export const metadata: Metadata = {
  title: "Nueva propiedad",
};

export default async function NuevaPropiedad() {
  // Solo para exigir sesion+tenant antes de mostrar el formulario. La
  // Server Action vuelve a resolverlos por su cuenta: nunca confia en que
  // el estado del componente siga siendo valido al momento del submit.
  await requireTenantUser();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Nueva propiedad</h1>
        <p className="text-sm text-muted-foreground">
          Las fotos se cargan después de crear la propiedad.
        </p>
      </div>

      <PropertyForm accion={crearPropiedad} textoBoton="Crear propiedad" />
    </div>
  );
}
