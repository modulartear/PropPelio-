import type { Metadata } from "next";

import { cerrarSesion } from "@/lib/auth/acciones";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Panel · PropPelio",
};

/**
 * Panel del usuario logueado, en el dominio raiz.
 *
 * Fase 2: solo confirma que la sesion y los roles funcionan. El panel real de
 * cada inmobiliaria — con propiedades, leads y tasaciones — es la Fase 3, y
 * vive en el subdominio del tenant, no aca.
 *
 * `requireUser()` manda al login si no hay sesion, asi que a partir de la
 * primera linea el usuario existe.
 */
export default async function Panel() {
  const usuario = await requireUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-6 font-sans">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola{usuario.name ? `, ${usuario.name}` : ""}
        </h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Sesión iniciada. El panel de gestión llega en la Fase 3.
        </p>
      </div>

      <dl className="divide-y divide-black/5 rounded-lg border border-black/10 text-sm dark:divide-white/10 dark:border-white/15">
        <Fila termino="Email" valor={usuario.email} />
        <Fila termino="Rol" valor={usuario.role} />
        <Fila termino="Tenant" valor={usuario.tenantId ?? "— (super admin)"} />
      </dl>

      <form action={cerrarSesion}>
        <button
          type="submit"
          className="w-full rounded-lg border border-black/15 px-4 py-2 text-sm font-medium dark:border-white/20"
        >
          Cerrar sesión
        </button>
      </form>
    </main>
  );
}

function Fila({ termino, valor }: { termino: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-black/50 dark:text-white/50">{termino}</dt>
      <dd className="font-mono text-xs break-all">{valor}</dd>
    </div>
  );
}
