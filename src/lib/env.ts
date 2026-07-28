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
    /**
     * Transaction pooler de Supabase (6543), con el rol `app_user`.
     * SUJETO A RLS: no ve nada sin un tenant seteado en la transaccion.
     */
    DATABASE_URL: required("DATABASE_URL", process.env.DATABASE_URL),
    /**
     * Igual pero con el rol `postgres`, que BYPASEA RLS.
     *
     * Solo para las operaciones que ocurren ANTES de que exista un tenant:
     * resolver el host, resolver al usuario autenticado, y el alta
     * self-service. Su uso esta confinado a src/lib/db/tenants.ts y users.ts.
     */
    DATABASE_ADMIN_URL: required("DATABASE_ADMIN_URL", process.env.DATABASE_ADMIN_URL),
    /** Session pooler de Supabase (5432). Solo migraciones y CLI de Prisma. */
    DIRECT_URL: required("DIRECT_URL", process.env.DIRECT_URL),
    /** Bypasea RLS por completo. Jamas exponer al cliente. */
    SUPABASE_SECRET_KEY: required("SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY),
  };
}

/**
 * Dominio raiz del SaaS. Todo lo que sea `<algo>.<este dominio>` es un tenant.
 *
 * Tiene default en vez de ser obligatoria porque el dominio propio todavia no
 * esta comprado (ver D-018), y sin default no habria forma de correr el
 * proyecto. En desarrollo los tenants viven en `tenant-a.localhost:3000`.
 *
 * En Vercel hay que setearla al dominio real (o a la URL de Vercel mientras
 * tanto), o el sitio entero se interpreta como dominios propios de clientes.
 *
 * Se lee sin `required()` a proposito: el middleware corre en el edge runtime
 * y no deberia tirar excepciones por configuracion faltante en cada request.
 */
export function rootDomain(): string {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() || "localhost:3000";
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

/**
 * Clave de Google Maps/Places/Geocoding. Separada de {@link publicEnv} a
 * proposito, mismo motivo por el que existen `serverEnv`/`publicEnv`
 * separadas: solo las paginas que de verdad usan el mapa deben poder romper
 * por esta variable faltante, no cualquier cosa que solo necesite Supabase.
 *
 * Publica por diseño: la usan las APIs de JS de Google que corren en el
 * browser. Su seguridad no depende de mantenerla en secreto sino de las
 * restricciones que se le configuran en Google Cloud Console — referrer HTTP
 * (solo los dominios del proyecto) + restriccion por API (solo Maps
 * JavaScript, Places, Geocoding). Sin esas restricciones, cualquiera que la
 * vea en el bundle podria usarla desde otro sitio y consumir la
 * cuota/facturacion.
 */
export function googleMapsEnv() {
  return {
    GOOGLE_MAPS_API_KEY: required(
      "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    ),
  } as const;
}
