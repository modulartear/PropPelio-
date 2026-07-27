// Import relativo y con extension, no con el alias `@/`: este modulo se testea
// con el runner nativo de Node, que no conoce los alias de tsconfig. El
// bundler de Next resuelve ambas formas, asi que no se pierde nada.
import { SUBDOMINIOS_RESERVADOS } from "./host.ts";

/**
 * Normalizacion y validacion del subdominio que elige cada inmobiliaria.
 *
 * Funcion pura y sin dependencias de servidor: la usa la Server Action del
 * registro y tambien se puede usar en el cliente para dar feedback inmediato
 * sin ida y vuelta.
 *
 * Un subdominio invalido no es solo un problema estetico: pasa a ser parte de
 * una URL publica y de un certificado SSL, y no se puede cambiar sin romper
 * los links que el cliente ya repartio.
 */

export const LARGO_MINIMO = 3;
export const LARGO_MAXIMO = 63; // Limite de una etiqueta DNS.

/**
 * Deja el texto en la forma en que se va a guardar: minusculas, sin espacios
 * ni acentos, con guiones en lugar de separadores.
 *
 * Se aplica MIENTRAS el usuario escribe, asi ve exactamente lo que va a quedar
 * en su URL en vez de descubrirlo despues de enviar el formulario.
 */
export function normalizarSubdominio(valor: string): string {
  return (
    valor
      .trim()
      .toLowerCase()
      // Separa los acentos de sus letras y los descarta: "López" -> "lopez".
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      // Todo lo que no sea letra, numero o guion pasa a ser guion.
      .replace(/[^a-z0-9-]+/g, "-")
      // Guiones repetidos y guiones en los extremos.
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

/**
 * Devuelve el motivo por el que un subdominio no sirve, o `null` si esta bien.
 *
 * Devuelve el motivo y no un booleano a proposito: poder decirle al usuario
 * QUE esta mal es la diferencia entre un formulario usable y uno que solo
 * dice que no.
 */
export function validarSubdominio(subdominio: string): string | null {
  if (!subdominio) {
    return "Elegí un subdominio.";
  }

  if (subdominio.length < LARGO_MINIMO) {
    return `Mínimo ${LARGO_MINIMO} caracteres.`;
  }

  if (subdominio.length > LARGO_MAXIMO) {
    return `Máximo ${LARGO_MAXIMO} caracteres.`;
  }

  // Ya lo garantiza normalizarSubdominio(), pero esta funcion tiene que
  // sostenerse sola: puede recibir un valor que no paso por ahi.
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdominio)) {
    return "Sólo letras, números y guiones. No puede empezar ni terminar con guión.";
  }

  if (SUBDOMINIOS_RESERVADOS.has(subdominio)) {
    return "Ese nombre está reservado por la plataforma.";
  }

  return null;
}
