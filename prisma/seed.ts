/**
 * Seed de datos de prueba.
 *
 * Crea tres tenants con subdominios distintos para validar la resolucion por
 * host. Uno de ellos tiene dominio propio y otro esta suspendido, para poder
 * probar esos dos caminos sin tocar la base a mano.
 *
 *   npm run db:seed
 *
 * Es IDEMPOTENTE: usa upsert por subdominio, asi que correrlo dos veces no
 * duplica nada ni falla. Podes correrlo cada vez que quieras volver al estado
 * conocido.
 *
 * Usa el cliente crudo a proposito: crear tenants es, por definicion, la
 * operacion que no puede estar scopeada a un tenant.
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.ts";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "Falta DATABASE_URL. En el Codespace llega como secret; si no la ves, " +
      "reconstrui el contenedor. Ver docs/setup.md.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

const TENANTS = [
  {
    subdomain: "tenant-a",
    name: "Inmobiliaria López",
    customDomain: null,
    status: "ACTIVE" as const,
    admin: { email: "admin@lopez.test", name: "Ana López" },
    modules: ["PROPERTIES", "LEADS"] as const,
  },
  {
    subdomain: "tenant-b",
    name: "Propiedades del Sur",
    // Sirve para probar el camino de dominio propio sin comprar un dominio:
    // alcanza con mandar el header Host a mano (ver docs/fase-1.md).
    customDomain: "propiedadesdelsur.test",
    status: "ACTIVE" as const,
    admin: { email: "admin@delsur.test", name: "Bruno Díaz" },
    modules: ["PROPERTIES", "LEADS", "APPRAISALS"] as const,
  },
  {
    subdomain: "tenant-c",
    name: "Suspendida SA",
    customDomain: null,
    // Un tenant suspendido NO debe resolver: su landing responde 404 aunque
    // el subdominio exista.
    status: "SUSPENDED" as const,
    admin: { email: "admin@suspendida.test", name: "Carla Ruiz" },
    modules: [] as const,
  },
];

async function main() {
  console.warn("==> Sembrando tenants de prueba...");

  for (const t of TENANTS) {
    const tenant = await prisma.tenant.upsert({
      where: { subdomain: t.subdomain },
      update: { name: t.name, customDomain: t.customDomain, status: t.status },
      create: {
        subdomain: t.subdomain,
        name: t.name,
        customDomain: t.customDomain,
        status: t.status,
      },
    });

    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: t.admin.email } },
      update: { name: t.admin.name, role: "TENANT_ADMIN" },
      create: {
        tenantId: tenant.id,
        email: t.admin.email,
        name: t.admin.name,
        role: "TENANT_ADMIN",
      },
    });

    // `module` como nombre de variable choca con una regla de Next
    // (no-assign-module-variable), de ahi `moduleKey`.
    for (const moduleKey of t.modules) {
      await prisma.tenantModule.upsert({
        where: { tenantId_module: { tenantId: tenant.id, module: moduleKey } },
        update: { enabled: true },
        create: { tenantId: tenant.id, module: moduleKey, enabled: true },
      });
    }

    const etiqueta = t.status === "ACTIVE" ? "" : ` [${t.status}]`;
    console.warn(`    ${t.subdomain.padEnd(10)} ${t.name}${etiqueta}`);
  }

  // El super-admin no pertenece a ningun tenant: tenantId queda en NULL.
  //
  // No se puede usar upsert aca: la clave unica es (tenantId, email), y
  // Postgres NO considera iguales dos filas con tenantId NULL — un indice
  // unico admite multiples NULL. Un upsert insertaria un super-admin nuevo en
  // cada corrida, rompiendo la idempotencia. Por eso: buscar y crear.
  const emailSuper = "super@proppelio.test";
  const superExistente = await prisma.user.findFirst({
    where: { email: emailSuper, tenantId: null },
    select: { id: true },
  });

  if (superExistente) {
    await prisma.user.update({
      where: { id: superExistente.id },
      data: { role: "SUPER_ADMIN", name: "Super Admin" },
    });
  } else {
    await prisma.user.create({
      data: { email: emailSuper, name: "Super Admin", role: "SUPER_ADMIN" },
    });
  }

  console.warn("\n==> Listo. Probalo con:");
  console.warn("    http://tenant-a.localhost:3000   -> Inmobiliaria López");
  console.warn("    http://tenant-b.localhost:3000   -> Propiedades del Sur");
  console.warn("    http://tenant-c.localhost:3000   -> 404 (suspendida)");
  console.warn("    http://localhost:3000            -> sitio de marketing");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
