import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases de Tailwind resolviendo conflictos.
 *
 * `clsx` arma la lista (soporta condicionales); `twMerge` descarta las clases
 * de Tailwind que se pisan entre si, quedandose con la ultima. Sin twMerge,
 * `cn("p-2", condicion && "p-4")` dejaria las dos clases en el DOM y el
 * resultado dependeria del orden de las reglas en el CSS generado, no de la
 * intencion del codigo.
 *
 * Componente estandar de shadcn/ui — este archivo es el que usan todos los
 * componentes de src/components/ui.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
