"use server";

import { redirect } from "next/navigation";

import { buscarTenantPorId } from "@/lib/db/tenants";
import { buscarUsuarioPorAuthId, crearTenantConAdmin, subdominioDisponible } from "@/lib/db/users";
import { rootDomain } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizarSubdominio, validarSubdominio } from "@/lib/tenant/subdominio";

/**
 * Server Actions de autenticacion.
 *
 * Corren en el servidor, asi que la contraseña nunca pasa por codigo del
 * cliente ni queda en el bundle.
 */

export type EstadoDeFormulario = {
  error?: string;
  /** Errores por campo, para mostrarlos al lado del input que corresponde. */
  campos?: Record<string, string>;
};

/**
 * Los errores de login son deliberadamente vagos.
 *
 * "Email o contraseña incorrectos" no distingue entre un email que no existe y
 * una contraseña equivocada. Distinguirlos convertiria el formulario en un
 * detector de cuentas registradas.
 */
const ERROR_CREDENCIALES = "Email o contraseña incorrectos.";

export async function iniciarSesion(
  _estadoPrevio: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completá email y contraseña." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: ERROR_CREDENCIALES };
  }

  redirect(await destinoPostLogin(data.user.id));
}

/**
 * A donde mandar a alguien recien logueado.
 *
 * El login vive en el dominio raiz — es comun a todos los tenants (ver el
 * comentario de src/app/(auth)/layout.tsx) — pero el panel de cada uno vive
 * en SU subdominio. Por eso el destino de un TENANT_ADMIN/TENANT_USER es una
 * URL ABSOLUTA cruzando de origen, no una ruta relativa.
 *
 * `/panel` es el fallback: la pagina generica de Fase 2 que solo confirma que
 * la sesion funciona. Se usa unicamente en casos que no deberian pasar en la
 * practica (perfil sin fila en `users` todavia, o un tenant borrado con el
 * usuario vivo) — nunca en el camino feliz.
 */
async function destinoPostLogin(authUserId: string): Promise<string> {
  const perfil = await buscarUsuarioPorAuthId(authUserId);

  if (!perfil) return "/panel";
  if (perfil.role === "SUPER_ADMIN") return "/super-admin";
  if (!perfil.tenantId) return "/panel";

  const tenant = await buscarTenantPorId(perfil.tenantId);
  if (!tenant) return "/panel";

  const dominio = rootDomain();
  return `${protocoloDe(dominio)}://${tenant.subdomain}.${dominio}/admin`;
}

export async function cerrarSesion() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Consulta si un subdominio esta disponible.
 *
 * La usa el formulario de registro mientras el usuario escribe. Devuelve el
 * motivo cuando no esta libre, para poder explicarlo en vez de solo negarlo.
 */
export async function verificarSubdominio(
  valor: string,
): Promise<{ disponible: boolean; motivo?: string }> {
  const subdominio = normalizarSubdominio(valor);
  const problema = validarSubdominio(subdominio);

  if (problema) {
    return { disponible: false, motivo: problema };
  }

  const libre = await subdominioDisponible(subdominio);

  return libre ? { disponible: true } : { disponible: false, motivo: "Ya está en uso." };
}

/**
 * Alta self-service de una inmobiliaria.
 *
 * Crea la cuenta en Supabase Auth y, si sale bien, el Tenant con su primer
 * TENANT_ADMIN. El orden importa: sin `authUserId` no se puede vincular el
 * usuario, asi que la cuenta de Auth va primero.
 */
export async function registrarTenant(
  _estadoPrevio: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const nombreTenant = String(formData.get("nombreTenant") ?? "").trim();
  const nombreUsuario = String(formData.get("nombreUsuario") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const subdominio = normalizarSubdominio(String(formData.get("subdominio") ?? ""));

  const campos: Record<string, string> = {};

  if (!nombreTenant) campos.nombreTenant = "Poné el nombre de tu inmobiliaria.";
  if (!email) campos.email = "Falta el email.";
  if (password.length < 8) campos.password = "Mínimo 8 caracteres.";

  const problemaSubdominio = validarSubdominio(subdominio);
  if (problemaSubdominio) campos.subdominio = problemaSubdominio;

  if (Object.keys(campos).length > 0) {
    return { campos };
  }

  // Se revalida en el servidor aunque el formulario ya haya consultado mientras
  // el usuario escribia: entre esa consulta y el submit alguien pudo tomarlo, y
  // la validacion del cliente nunca es una garantia.
  if (!(await subdominioDisponible(subdominio))) {
    return { campos: { subdominio: "Ya está en uso." } };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${protocoloDe(rootDomain())}://${rootDomain()}/login`,
    },
  });

  if (error || !data.user) {
    // El mensaje de Supabase para "email ya registrado" tambien delataria
    // cuentas existentes, asi que no se propaga tal cual.
    return { error: "No pudimos crear la cuenta. Revisá el email e intentá de nuevo." };
  }

  try {
    await crearTenantConAdmin({
      nombreTenant,
      subdomain: subdominio,
      authUserId: data.user.id,
      email,
      nombreUsuario: nombreUsuario || null,
    });
  } catch {
    // La cuenta de Auth quedo creada pero el tenant no. El usuario puede
    // reintentar con el mismo email; `authUserId` es unico, asi que un segundo
    // intento exitoso lo vincula igual.
    return {
      error: "Creamos tu cuenta pero falló el alta de la inmobiliaria. Escribinos para resolverlo.",
    };
  }

  redirect(`/registro/listo?subdominio=${encodeURIComponent(subdominio)}`);
}

/** En desarrollo el dominio raiz es localhost, que no tiene HTTPS. */
function protocoloDe(dominio: string): string {
  return dominio.startsWith("localhost") ? "http" : "https";
}
