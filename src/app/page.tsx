/**
 * Pagina "hello world" de la Fase 0.
 *
 * Su unico proposito es verificar que el pipeline de deploy funciona: push a
 * una rama -> preview deployment en Vercel con URL propia. No tiene logica de
 * negocio y va a ser reemplazada en la Fase 1, cuando el middleware empiece a
 * resolver el tenant a partir del host.
 */

const CHECKLIST: ReadonlyArray<readonly [string, boolean]> = [
  ["Next.js 15 · App Router · TypeScript", true],
  ["Tailwind CSS v4", true],
  ["Prettier + ESLint", true],
  ["Devcontainer (Codespaces)", true],
  ["Prisma → Supabase", false],
  ["Supabase Auth + Storage", false],
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 font-sans">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="rounded-full border border-black/10 px-3 py-1 font-mono text-xs tracking-wide text-black/50 dark:border-white/15 dark:text-white/50">
          Fase 0 · Setup y fundamentos
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">PropPelio</h1>
        <p className="max-w-md text-sm text-balance text-black/60 dark:text-white/60">
          SaaS multi-tenant para inmobiliarias. Todavía no hay lógica de negocio: esta página sólo
          confirma que el deploy funciona.
        </p>
      </div>

      <ul className="w-full max-w-md divide-y divide-black/5 rounded-lg border border-black/10 text-sm dark:divide-white/10 dark:border-white/15">
        {CHECKLIST.map(([label, done]) => (
          <li key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <span className={done ? "" : "text-black/40 dark:text-white/40"}>{label}</span>
            <span className="font-mono text-xs text-black/40 dark:text-white/40">
              {done ? "listo" : "pendiente"}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
