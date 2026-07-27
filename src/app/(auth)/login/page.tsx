import type { Metadata } from "next";
import Link from "next/link";

import { FormularioDeLogin } from "./formulario";

export const metadata: Metadata = {
  title: "Ingresar · PropPelio",
};

export default function PaginaDeLogin() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Ingresar</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Accedé al panel de tu inmobiliaria.
        </p>
      </div>

      <FormularioDeLogin />

      <p className="text-center text-sm text-black/60 dark:text-white/60">
        ¿No tenés cuenta?{" "}
        <Link href="/registro" className="underline underline-offset-4">
          Registrá tu inmobiliaria
        </Link>
      </p>
    </div>
  );
}
