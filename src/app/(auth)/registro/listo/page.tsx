import type { Metadata } from "next";
import Link from "next/link";

import { rootDomain } from "@/lib/env";

export const metadata: Metadata = {
  title: "Cuenta creada · PropPelio",
};

/**
 * Confirmacion posterior al alta.
 *
 * Existe como pagina aparte y no como un mensaje dentro del formulario porque
 * el registro termina en un `redirect()`: asi recargar no reenvia el alta.
 */
export default async function PaginaDeRegistroListo({
  searchParams,
}: {
  searchParams: Promise<{ subdominio?: string }>;
}) {
  const { subdominio } = await searchParams;
  const dominio = rootDomain();
  const url = subdominio
    ? `${dominio.startsWith("localhost") ? "http" : "https"}://${subdominio}.${dominio}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Listo, tu cuenta está creada</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Te mandamos un email para confirmar tu dirección. Revisá la bandeja de entrada — y el
          spam, que ahí suele caer el primero.
        </p>
      </div>

      {url && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-black/10 p-4 text-sm dark:border-white/15">
          <span className="text-black/50 dark:text-white/50">Tu sitio</span>
          <code className="font-mono text-xs break-all">{url}</code>
        </div>
      )}

      <Link
        href="/login"
        className="rounded-lg bg-foreground px-4 py-2 text-center text-sm font-medium text-background"
      >
        Ir a ingresar
      </Link>
    </div>
  );
}
