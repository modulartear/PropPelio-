import type { Metadata } from "next";

import { tenantDesdeSegmentos } from "@/lib/tenant/resolve";

/**
 * Landing publica generica de un tenant.
 *
 * Fase 1: solo valida que la resolucion por host funciona de punta a punta.
 * En la Fase 4 la reemplaza el render del arbol de bloques que arme el tenant
 * con el builder visual.
 *
 * A esta ruta no se llega escribiendola: el middleware reescribe hasta aca
 * desde `lopez.proppelio.com/`. El usuario nunca ve `/tenants/...` en la barra
 * de direcciones.
 */

type Props = {
  params: Promise<{ por: string; valor: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { por, valor } = await params;
  const tenant = await tenantDesdeSegmentos(por, valor);

  return {
    title: tenant.name,
    description: `Sitio de ${tenant.name}.`,
  };
}

export default async function LandingDeTenant({ params }: Props) {
  const { por, valor } = await params;
  const tenant = await tenantDesdeSegmentos(por, valor);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 font-sans">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="rounded-full border border-black/10 px-3 py-1 font-mono text-xs tracking-wide text-black/50 dark:border-white/15 dark:text-white/50">
          Fase 1 · Núcleo multi-tenant
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Bienvenido a {tenant.name}
        </h1>
        <p className="max-w-md text-sm text-balance text-black/60 dark:text-white/60">
          Esta landing todavía es genérica. En la Fase 4 la reemplaza la que arme cada inmobiliaria
          con el constructor visual.
        </p>
      </div>

      <dl className="w-full max-w-md divide-y divide-black/5 rounded-lg border border-black/10 text-sm dark:divide-white/10 dark:border-white/15">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-black/50 dark:text-white/50">Tenant</dt>
          <dd className="font-mono text-xs">{tenant.id}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-black/50 dark:text-white/50">Subdominio</dt>
          <dd className="font-mono text-xs">{tenant.subdomain}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-black/50 dark:text-white/50">Dominio propio</dt>
          <dd className="font-mono text-xs">{tenant.customDomain ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <dt className="text-black/50 dark:text-white/50">Resuelto por</dt>
          <dd className="font-mono text-xs">{por}</dd>
        </div>
      </dl>
    </main>
  );
}
