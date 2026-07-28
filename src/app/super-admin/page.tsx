import type { Metadata } from "next";

import { requireSuperAdmin } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Super admin · PropPelio",
};

/**
 * Panel central de la plataforma.
 *
 * Fase 2: solo existe para que el guard de rol sea verificable. El panel real
 * —gestion de tenants, planes y modulos— es la Fase 5.
 *
 * `requireSuperAdmin()` responde 404 a cualquier otro rol. No 403: para quien
 * no es super-admin, esta ruta directamente no existe. Ver D-027.
 */
export default async function PanelDeSuperAdmin() {
  const usuario = await requireSuperAdmin();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 p-6 font-sans">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Panel central</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Sólo accesible con rol <code className="font-mono text-xs">SUPER_ADMIN</code>. La gestión
          de tenants, planes y módulos llega en la Fase 5.
        </p>
      </div>

      <dl className="divide-y divide-black/5 rounded-lg border border-black/10 text-sm dark:divide-white/10 dark:border-white/15">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-black/50 dark:text-white/50">Sesión</dt>
          <dd className="font-mono text-xs break-all">{usuario.email}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-black/50 dark:text-white/50">Rol</dt>
          <dd className="font-mono text-xs">{usuario.role}</dd>
        </div>
      </dl>
    </main>
  );
}
