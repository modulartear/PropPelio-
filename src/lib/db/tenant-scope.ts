/**
 * Logica de scoping por tenant, aislada del cliente de Prisma.
 *
 * Vive en su propio archivo y sin dependencias para poder testearla sin base
 * de datos. Es el punto del sistema donde un bug significa una fuga de datos
 * entre inmobiliarias, asi que tiene que ser verificable de forma directa.
 *
 * Ver tenant-client.ts, que la conecta a Prisma via `$extends`.
 */

/**
 * Modelos que NO pertenecen a un tenant y por lo tanto no se filtran.
 *
 * La lista es de EXCLUSIONES a proposito, no de inclusiones: un modelo nuevo
 * queda filtrado por defecto. Si alguien agrega `Property` y se olvida de
 * tocar este archivo, sus queries se filtran igual. Al reves — una lista de
 * modelos a filtrar — un olvido seria una fuga silenciosa.
 *
 * Si un modelo excluido realmente no tiene columna `tenantId`, el query falla
 * ruidosamente con un error de Prisma. Es lo buscado: mejor un error visible
 * que un filtro que no se aplico.
 */
export const MODELOS_SIN_TENANT = new Set<string>([
  // El propio Tenant se identifica por `id`, no por `tenantId`.
  "Tenant",
]);

/** Operaciones cuyo `where` acepta filtros arbitrarios. */
const OPERACIONES_CON_WHERE = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
  "update",
  "delete",
]);

/**
 * `findUnique` solo acepta campos unicos en su `where`, asi que no se le puede
 * agregar `tenantId`. Se reescribe a la variante sin esa restriccion, que
 * devuelve lo mismo cuando el `where` original ya era unico.
 */
const REESCRITURAS: Record<string, string> = {
  findUnique: "findFirst",
  findUniqueOrThrow: "findFirstOrThrow",
};

export type ArgsDeQuery = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown> | Record<string, unknown>[];
  create?: Record<string, unknown>;
  [k: string]: unknown;
};

export type ResultadoDeScope = {
  /** Operacion a ejecutar. Distinta de la original si hubo reescritura. */
  operacion: string;
  /** Argumentos con el tenantId ya inyectado. */
  args: ArgsDeQuery;
  /** `true` si el modelo esta excluido y no se toco nada. */
  sinCambios: boolean;
};

/**
 * Inyecta `tenantId` en los argumentos de un query de Prisma.
 *
 * Funcion pura: no toca la base ni el cliente. Recibe la operacion y sus
 * argumentos, devuelve los argumentos corregidos.
 */
export function aplicarScopeDeTenant(
  model: string | undefined,
  operation: string,
  args: ArgsDeQuery | undefined,
  tenantId: string,
): ResultadoDeScope {
  if (model && MODELOS_SIN_TENANT.has(model)) {
    return { operacion: operation, args: args ?? {}, sinCambios: true };
  }

  const operacion = REESCRITURAS[operation] ?? operation;
  const siguientes: ArgsDeQuery = { ...(args ?? {}) };

  if (OPERACIONES_CON_WHERE.has(operacion)) {
    siguientes.where = { ...(siguientes.where ?? {}), tenantId };
  }

  if (operacion === "create") {
    siguientes.data = { ...((siguientes.data as Record<string, unknown>) ?? {}), tenantId };
  }

  if (operacion === "createMany" || operacion === "createManyAndReturn") {
    const data = siguientes.data;
    siguientes.data = Array.isArray(data)
      ? data.map((fila) => ({ ...fila, tenantId }))
      : { ...((data as Record<string, unknown>) ?? {}), tenantId };
  }

  if (operacion === "upsert") {
    siguientes.where = { ...(siguientes.where ?? {}), tenantId };
    siguientes.create = { ...(siguientes.create ?? {}), tenantId };
  }

  return { operacion, args: siguientes, sinCambios: false };
}

/** Nombre del delegado de Prisma para un modelo: `TenantModule` -> `tenantModule`. */
export function delegadoDe(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}
