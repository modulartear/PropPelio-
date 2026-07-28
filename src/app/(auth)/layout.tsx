import Link from "next/link";

/**
 * Layout de las pantallas de autenticacion.
 *
 * Viven en el DOMINIO RAIZ, no en el subdominio de cada inmobiliaria: el
 * registro crea el tenant que todavia no existe, y el login es comun a todos.
 * El middleware no reescribe estas rutas porque el host es la raiz.
 */
export default function LayoutDeAuth({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 p-6 font-sans">
      <Link href="/" className="text-2xl font-semibold tracking-tight">
        PropPelio
      </Link>

      <div className="w-full max-w-sm rounded-xl border border-black/10 p-6 dark:border-white/15">
        {children}
      </div>
    </div>
  );
}
