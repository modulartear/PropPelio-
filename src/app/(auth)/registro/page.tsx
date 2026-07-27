import type { Metadata } from "next";
import Link from "next/link";

import { rootDomain } from "@/lib/env";

import { FormularioDeRegistro } from "./formulario";

export const metadata: Metadata = {
  title: "Registrá tu inmobiliaria · PropPelio",
};

export default function PaginaDeRegistro() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Registrá tu inmobiliaria</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Creá tu cuenta y elegí la dirección web de tu sitio.
        </p>
      </div>

      <FormularioDeRegistro dominioRaiz={rootDomain()} />

      <p className="text-center text-sm text-black/60 dark:text-white/60">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="underline underline-offset-4">
          Ingresar
        </Link>
      </p>
    </div>
  );
}
