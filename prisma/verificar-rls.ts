/**
 * Verificacion de que el RLS realmente aisla entre tenants.
 *
 *   npm run db:verify-rls
 *
 * No alcanza con que las politicas existan: hay que comprobar que el rol de la
 * aplicacion no puede leer datos ajenos ni escribirlos. Este script lo intenta
 * a proposito y falla si alguno de esos intentos tiene exito.
 *
 * Se conecta con DATABASE_URL, o sea con el rol `app_user`, igual que la app.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.ts";

const DATABASE_URL = process.env.DATABASE_URL;
const DATABASE_ADMIN_URL = process.env.DATABASE_ADMIN_URL;

if (!DATABASE_URL || !DATABASE_ADMIN_URL) {
  throw new Error("Faltan DATABASE_URL y/o DATABASE_ADMIN_URL. Ver docs/setup.md.");
}

const app = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_ADMIN_URL }) });

let fallos = 0;

function comprobar(nombre: string, ok: boolean, detalle = "") {
  console.warn(`${ok ? "  ✓" : "  ✗"} ${nombre}${ok ? "" : `   <<< ${detalle}`}`);
  if (!ok) fallos++;
}

/** Corre una funcion con `app.tenant_id` seteado, igual que hace la app. */
async function comoTenant<T>(tenantId: string, fn: (tx: unknown) => Promise<T>): Promise<T> {
  return app.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    return fn(tx);
  });
}

type Tx = {
  user: { count: (a?: unknown) => Promise<number>; create: (a: unknown) => Promise<unknown> };
};

async function main() {
  console.warn("\n=== Verificacion de RLS ===\n");

  // Se necesitan dos tenants con usuarios. Los crea el seed.
  const tenants = await admin.tenant.findMany({
    orderBy: { subdomain: "asc" },
    select: { id: true, subdomain: true },
  });

  if (tenants.length < 2) {
    throw new Error("Hacen falta al menos 2 tenants. Corre `npm run db:seed` primero.");
  }

  const [a, b] = tenants;
  const totalReal = await admin.user.count();

  console.warn(`Tenants: ${a.subdomain} (${a.id})  |  ${b.subdomain} (${b.id})`);
  console.warn(`Usuarios en la base (visto por el rol admin): ${totalReal}\n`);

  // --- 1. Sin contexto de tenant, no se ve nada ---
  console.warn("1. Sin `app.tenant_id` seteado:");
  const sinContexto = await app.user.count();
  comprobar(
    "no devuelve ningun usuario (falla cerrado)",
    sinContexto === 0,
    `devolvio ${sinContexto} de ${totalReal}`,
  );

  // --- 2. Con contexto, solo se ven los propios ---
  console.warn("\n2. Con `app.tenant_id` seteado:");
  const deA = await comoTenant(a.id, (tx) => (tx as Tx).user.count());
  const deAReal = await admin.user.count({ where: { tenantId: a.id } });
  comprobar(
    `${a.subdomain} ve exactamente sus usuarios`,
    deA === deAReal,
    `vio ${deA}, tiene ${deAReal}`,
  );
  comprobar(`${a.subdomain} NO ve la base entera`, deA < totalReal, `vio ${deA} de ${totalReal}`);

  // --- 3. Pedir explicitamente los de otro tenant no devuelve nada ---
  console.warn("\n3. Pidiendo explicitamente datos de otro tenant:");
  const ajenos = await comoTenant(a.id, (tx) =>
    (tx as Tx).user.count({ where: { tenantId: b.id } }),
  );
  comprobar(
    "un where con el tenantId ajeno devuelve 0",
    ajenos === 0,
    `devolvio ${ajenos} filas de ${b.subdomain}`,
  );

  // --- 4. No se puede ESCRIBIR en otro tenant ---
  console.warn("\n4. Intentando escribir en otro tenant:");
  let bloqueado = false;
  try {
    await comoTenant(a.id, (tx) =>
      (tx as Tx).user.create({
        data: {
          tenantId: b.id,
          email: `intruso-${Date.now()}@test.local`,
          role: "TENANT_USER",
        },
      }),
    );
  } catch {
    bloqueado = true;
  }
  comprobar("WITH CHECK rechaza el insert en un tenant ajeno", bloqueado, "el insert paso");

  // --- 5. El rol no puede desactivar su propia proteccion ---
  console.warn("\n5. Intentando desactivar RLS desde el rol de la app:");
  let sinPermiso = false;
  try {
    await app.$executeRawUnsafe('ALTER TABLE "users" DISABLE ROW LEVEL SECURITY');
  } catch {
    sinPermiso = true;
  }
  comprobar("no puede desactivar RLS (no es dueño de la tabla)", sinPermiso, "pudo desactivarlo");

  console.warn(
    fallos === 0
      ? "\n✅ RLS aisla correctamente.\n"
      : `\n❌ ${fallos} comprobacion(es) fallaron. El aislamiento NO esta garantizado.\n`,
  );
}

main()
  .then(async () => {
    await app.$disconnect();
    await admin.$disconnect();
    process.exit(fallos === 0 ? 0 : 1);
  })
  .catch(async (error) => {
    console.error(error);
    await app.$disconnect();
    await admin.$disconnect();
    process.exit(1);
  });
