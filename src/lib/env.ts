/**
 * Acceso tipado a las variables de entorno.
 *
 * Toda variable se lee UNICAMENTE desde aca. El objetivo es que falte una
 * variable falle al arrancar, con un mensaje que diga cual, en vez de explotar
 * mas tarde con un `undefined` en medio de un query.
 *
 * El proyecto no usa archivos .env en disco: los valores llegan como
 * Codespaces secrets en desarrollo y como Environment Variables de Vercel en
 * preview/produccion. Ver docs/setup.md.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Falta la variable de entorno ${name}. ` +
        `En desarrollo se configura como Codespaces secret; en Vercel, como Environment Variable. ` +
        `Ver docs/setup.md.`,
    );
  }
  return value;
}

/**
 * Variables del servidor. Nunca deben llegar al browser.
 *
 * Es una funcion y no un objeto de modulo a proposito: si fuera un objeto
 * evaluado al importar, cualquier import accidental desde un Client Component
 * romperia el build en vez de fallar solo cuando se usa de verdad.
 */
export function serverEnv() {
  return {
    /** Transaction pooler de Supabase (6543). Runtime de la app. */
    DATABASE_URL: required("DATABASE_URL", process.env.DATABASE_URL),
    /** Session pooler de Supabase (5432). Solo migraciones y CLI de Prisma. */
    DIRECT_URL: required("DIRECT_URL", process.env.DIRECT_URL),
    /** Bypasea RLS por completo. Jamas exponer al cliente. */
    SUPABASE_SECRET_KEY: required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
  };
}

/**
 * Variables publicas. Viajan en el bundle del browser por diseño.
 *
 * Tambien es funcion, y por un motivo concreto: si fuera un objeto de modulo,
 * importar cualquier cosa de este archivo obligaria a tener definidas TODAS
 * las variables. `src/lib/db.ts` solo necesita las de servidor y romperia sin
 * razon por falta de una NEXT_PUBLIC_.
 *
 * `process.env.NEXT_PUBLIC_*` aparece escrito literal a proposito: Next lo
 * reemplaza por su valor en build time haciendo sustitucion de texto, asi que
 * no funciona con indexado dinamico. Adentro de una funcion sigue andando.
 */
export function publicEnv() {
  return {
    SUPABASE_URL: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_PUBLISHABLE_KEY: required(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  } as const;
}
