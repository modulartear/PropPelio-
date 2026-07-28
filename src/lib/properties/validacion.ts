/**
 * Validacion del formulario de propiedades. Funcion pura: recibe un
 * `FormData` (Node lo tiene global, no hace falta ningun polyfill para
 * testearla) y devuelve valores tipados o errores por campo.
 *
 * Los arrays de abajo duplican a mano los valores de los enums de
 * `schema.prisma`, y los tipos se derivan DE ESTOS ARRAYS (no de un import
 * del cliente generado de Prisma). Dos motivos:
 *   1. Este archivo se testea con el runner nativo de Node, que no puede
 *      cargar el cliente generado (usa imports sin extension).
 *   2. La regla de ESLint que bloquea instanciar Prisma a mano tambien
 *      bloquea importar CUALQUIER cosa de generated/prisma, tipos incluidos
 *      — y esta bien que sea asi de estricta.
 * Si el schema cambia, estos arrays se actualizan a mano.
 */

export const PROPERTY_TYPES = ["HOUSE", "APARTMENT", "LAND", "COMMERCIAL", "OFFICE"] as const;
export const OPERATION_TYPES = ["SALE", "RENT"] as const;
export const PROPERTY_STATUSES = ["AVAILABLE", "RESERVED", "SOLD"] as const;
export const CURRENCIES = ["ARS", "USD"] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type OperationType = (typeof OPERATION_TYPES)[number];
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];
export type Currency = (typeof CURRENCIES)[number];

export type ValoresDePropiedad = {
  title: string;
  description: string | null;
  propertyType: PropertyType;
  operationType: OperationType;
  status: PropertyStatus;
  price: number | null;
  currency: Currency;
  addressStreet: string;
  addressCity: string;
  addressProvince: string;
  addressZip: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  totalArea: number | null;
  coveredArea: number | null;
  garageSpaces: number | null;
};

export type ErroresDePropiedad = Partial<Record<keyof ValoresDePropiedad, string>>;

function texto(fd: FormData, campo: string): string {
  return String(fd.get(campo) ?? "").trim();
}

function textoOpcional(fd: FormData, campo: string): string | null {
  const v = texto(fd, campo);
  return v || null;
}

/**
 * Numero opcional. Devuelve `undefined` cuando el texto no es un numero
 * valido (para reportar error), y `null` cuando el campo vino vacio (valor
 * legitimo: la propiedad no tiene ese dato).
 */
function numeroOpcional(fd: FormData, campo: string): number | null | undefined {
  const v = texto(fd, campo);
  if (!v) return null;

  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function validarPropiedad(
  fd: FormData,
): { valores: ValoresDePropiedad } | { errores: ErroresDePropiedad } {
  const errores: ErroresDePropiedad = {};

  const title = texto(fd, "title");
  if (!title) errores.title = "Poné un título.";
  if (title.length > 200) errores.title = "Máximo 200 caracteres.";

  const propertyType = texto(fd, "propertyType") as PropertyType;
  if (!PROPERTY_TYPES.includes(propertyType)) errores.propertyType = "Elegí un tipo de propiedad.";

  const operationType = texto(fd, "operationType") as OperationType;
  if (!OPERATION_TYPES.includes(operationType)) errores.operationType = "Elegí venta o alquiler.";

  const statusTexto = texto(fd, "status") || "AVAILABLE";
  const status = statusTexto as PropertyStatus;
  if (!PROPERTY_STATUSES.includes(status)) errores.status = "Estado inválido.";

  const currencyTexto = texto(fd, "currency") || "ARS";
  const currency = currencyTexto as Currency;
  if (!CURRENCIES.includes(currency)) errores.currency = "Moneda inválida.";

  const price = numeroOpcional(fd, "price");
  if (price === undefined) errores.price = "El precio tiene que ser un número.";
  else if (price !== null && price < 0) errores.price = "El precio no puede ser negativo.";

  const addressStreet = texto(fd, "addressStreet");
  if (!addressStreet) errores.addressStreet = "Falta la calle y altura.";

  const addressCity = texto(fd, "addressCity");
  if (!addressCity) errores.addressCity = "Falta la ciudad.";

  const addressProvince = texto(fd, "addressProvince");
  if (!addressProvince) errores.addressProvince = "Falta la provincia.";

  const camposEnteros = ["bedrooms", "bathrooms", "garageSpaces"] as const;
  const enteros: Record<(typeof camposEnteros)[number], number | null> = {
    bedrooms: null,
    bathrooms: null,
    garageSpaces: null,
  };
  for (const campo of camposEnteros) {
    const n = numeroOpcional(fd, campo);
    if (n === undefined) errores[campo] = "Tiene que ser un número.";
    else if (n !== null && (!Number.isInteger(n) || n < 0))
      errores[campo] = "Tiene que ser un entero positivo.";
    else enteros[campo] = n;
  }

  const camposArea = ["totalArea", "coveredArea"] as const;
  const areas: Record<(typeof camposArea)[number], number | null> = {
    totalArea: null,
    coveredArea: null,
  };
  for (const campo of camposArea) {
    const n = numeroOpcional(fd, campo);
    if (n === undefined) errores[campo] = "Tiene que ser un número.";
    else if (n !== null && n < 0) errores[campo] = "No puede ser negativo.";
    else areas[campo] = n;
  }

  if (Object.keys(errores).length > 0) {
    return { errores };
  }

  return {
    valores: {
      title,
      description: textoOpcional(fd, "description"),
      propertyType,
      operationType,
      status,
      price: price as number | null,
      currency,
      addressStreet,
      addressCity,
      addressProvince,
      addressZip: textoOpcional(fd, "addressZip"),
      bedrooms: enteros.bedrooms,
      bathrooms: enteros.bathrooms,
      totalArea: areas.totalArea,
      coveredArea: areas.coveredArea,
      garageSpaces: enteros.garageSpaces,
    },
  };
}
