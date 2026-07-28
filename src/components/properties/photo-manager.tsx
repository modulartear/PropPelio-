"use client";

import { Trash2 } from "lucide-react";
import Image from "next/image";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

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
import { eliminarFoto, subirFotos, type EstadoDeFormulario } from "@/lib/properties/acciones";
import { MAX_FOTOS_POR_PROPIEDAD } from "@/lib/storage/property-photos";

const ESTADO_INICIAL: EstadoDeFormulario = {};

function BotonDeSubida() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "Subiendo…" : "Subir fotos"}
    </Button>
  );
}

export function PhotoManager({
  propertyId,
  fotos,
}: {
  propertyId: string;
  fotos: { id: string; url: string }[];
}) {
  const subir = subirFotos.bind(null, propertyId);
  const [estado, ejecutarSubida] = useActionState(subir, ESTADO_INICIAL);
  const lugarDisponible = fotos.length < MAX_FOTOS_POR_PROPIEDAD;

  return (
    <div className="flex flex-col gap-4">
      {fotos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {fotos.map((foto) => (
            <FotoConBorrado key={foto.id} id={foto.id} url={foto.url} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {fotos.length} / {MAX_FOTOS_POR_PROPIEDAD} fotos
      </p>

      {lugarDisponible ? (
        <form action={ejecutarSubida} className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="fotos"
            multiple
            accept="image/jpeg,image/png,image/webp"
            required
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <BotonDeSubida />
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          Llegaste al máximo de fotos para esta propiedad.
        </p>
      )}

      {estado.error && <p className="text-sm text-destructive">{estado.error}</p>}
    </div>
  );
}

function FotoConBorrado({ id, url }: { id: string; url: string }) {
  const borrar = eliminarFoto.bind(null, id);

  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border">
      <Image src={url} alt="" fill className="object-cover" sizes="(max-width: 640px) 50vw, 25vw" />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            aria-label="Borrar foto"
            className="absolute top-1.5 right-1.5 rounded-md bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Trash2 className="size-4" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar esta foto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina del almacenamiento. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {/* eliminarFoto es una Server Action sin useActionState: no
                necesita mostrar errores de validacion, solo ejecutarse. */}
            <form action={borrar}>
              <AlertDialogAction type="submit" variant="destructive">
                Borrar
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
