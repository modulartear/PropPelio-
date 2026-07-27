import { rootDomain } from "@/lib/env";

/**
 * Sitio de marketing de PropPelio — el dominio raiz.
 *
 * A esta pagina se llega SOLO desde el dominio raiz: el middleware reescribe
 * cualquier subdominio o dominio propio hacia `/tenants/...` antes de llegar
 * aca. Ver src/middleware.ts.
 *
 * Sigue siendo una pagina de estado: en su lugar va la landing de venta del
 * SaaS, que no es parte de la Fase 1.
 */

const ESTADO: ReadonlyArray<readonly [string, string]> = [
  ["Modelo de datos (Tenant, User, TenantModule)", "listo"],
  ["Aislamiento forzado por tenantId", "listo"],
  ["Resolución de tenant por host", "listo"],
  ["Landing genérica de tenant", "listo"],
  ["Autenticación y roles", "fase 2"],
  ["Panel administrativo", "fase 3"],
];

export default function SitioDeMarketing() {
  const dominio = rootDomain();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 font-sans">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="rounded-full border border-black/10 px-3 py-1 font-mono text-xs tracking-wide text-black/50 dark:border-white/15 dark:text-white/50">
          Fase 1 · Núcleo multi-tenant
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">PropPelio</h1>
        <p className="max-w-md text-sm text-balance text-black/60 dark:text-white/60">
          SaaS multi-tenant para inmobiliarias. Estás viendo el dominio raíz{" "}
          <code className="font-mono text-xs">{dominio}</code>; cada inmobiliaria vive en su propio
          subdominio.
        </p>
      </div>

      <ul className="w-full max-w-md divide-y divide-black/5 rounded-lg border border-black/10 text-sm dark:divide-white/10 dark:border-white/15">
        {ESTADO.map(([label, estado]) => (
          <li key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <span className={estado === "listo" ? "" : "text-black/40 dark:text-white/40"}>
              {label}
            </span>
            <span className="font-mono text-xs text-black/40 dark:text-white/40">{estado}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
