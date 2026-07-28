"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";

import { registrarTenant, verificarSubdominio, type EstadoDeFormulario } from "@/lib/auth/acciones";
import { normalizarSubdominio, validarSubdominio } from "@/lib/tenant/subdominio";

const ESTADO_INICIAL: EstadoDeFormulario = {};

type Disponibilidad =
  | { estado: "vacio" }
  | { estado: "invalido"; motivo: string }
  | { estado: "consultando" }
  | { estado: "libre" }
  | { estado: "ocupado"; motivo: string };

function BotonDeEnvio({ bloqueado }: { bloqueado: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || bloqueado}
      className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
    >
      {pending ? "Creando…" : "Crear mi inmobiliaria"}
    </button>
  );
}

export function FormularioDeRegistro({ dominioRaiz }: { dominioRaiz: string }) {
  const [estado, accion] = useActionState(registrarTenant, ESTADO_INICIAL);
  const [subdominio, setSubdominio] = useState("");
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad>({ estado: "vacio" });

  // Consulta la disponibilidad mientras el usuario escribe, con un retardo para
  // no disparar un query por tecla. El servidor vuelve a validar al enviar:
  // entre esta consulta y el submit alguien pudo tomar el subdominio, y una
  // validacion del cliente nunca es una garantia.
  useEffect(() => {
    if (!subdominio) {
      setDisponibilidad({ estado: "vacio" });
      return;
    }

    const problema = validarSubdominio(subdominio);
    if (problema) {
      setDisponibilidad({ estado: "invalido", motivo: problema });
      return;
    }

    setDisponibilidad({ estado: "consultando" });

    let cancelado = false;
    const temporizador = setTimeout(async () => {
      const r = await verificarSubdominio(subdominio);
      if (cancelado) return;

      setDisponibilidad(
        r.disponible
          ? { estado: "libre" }
          : { estado: "ocupado", motivo: r.motivo ?? "No está disponible." },
      );
    }, 400);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [subdominio]);

  const mensajeDeSubdominio = estado.campos?.subdominio ?? mensajeDe(disponibilidad);
  const colorDelMensaje =
    disponibilidad.estado === "libre" && !estado.campos?.subdominio
      ? "text-green-700 dark:text-green-400"
      : "text-red-600 dark:text-red-400";

  return (
    <form action={accion} className="flex flex-col gap-4">
      <Campo
        etiqueta="Nombre de la inmobiliaria"
        nombre="nombreTenant"
        requerido
        error={estado.campos?.nombreTenant}
        onChange={(v) => {
          // Sugiere el subdominio a partir del nombre, pero solo hasta que el
          // usuario lo toque: a partir de ahi manda lo que el eligio.
          if (!subdominio || subdominio === normalizarSubdominio(v.slice(0, -1))) {
            setSubdominio(normalizarSubdominio(v));
          }
        }}
      />

      <div className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Tu dirección web</span>
        <div className="flex items-center rounded-lg border border-black/15 dark:border-white/20">
          <input
            name="subdominio"
            value={subdominio}
            onChange={(e) => setSubdominio(normalizarSubdominio(e.target.value))}
            required
            className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
            placeholder="mi-inmobiliaria"
          />
          <span className="shrink-0 px-3 text-black/50 dark:text-white/50">.{dominioRaiz}</span>
        </div>
        {mensajeDeSubdominio ? (
          <span className={`text-xs ${colorDelMensaje}`}>{mensajeDeSubdominio}</span>
        ) : (
          <span className="text-xs text-black/50 dark:text-white/50">
            No se puede cambiar después: va a estar en los links que repartas.
          </span>
        )}
      </div>

      <Campo etiqueta="Tu nombre" nombre="nombreUsuario" />
      <Campo etiqueta="Email" nombre="email" tipo="email" requerido error={estado.campos?.email} />
      <Campo
        etiqueta="Contraseña"
        nombre="password"
        tipo="password"
        requerido
        error={estado.campos?.password}
        ayuda="Mínimo 8 caracteres."
      />

      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {estado.error}
        </p>
      )}

      <BotonDeEnvio
        bloqueado={disponibilidad.estado === "ocupado" || disponibilidad.estado === "invalido"}
      />
    </form>
  );
}

function mensajeDe(d: Disponibilidad): string | null {
  switch (d.estado) {
    case "invalido":
    case "ocupado":
      return d.motivo;
    case "consultando":
      return null;
    case "libre":
      return "Disponible.";
    default:
      return null;
  }
}

function Campo({
  etiqueta,
  nombre,
  tipo = "text",
  requerido = false,
  error,
  ayuda,
  onChange,
}: {
  etiqueta: string;
  nombre: string;
  tipo?: string;
  requerido?: boolean;
  error?: string;
  ayuda?: string;
  onChange?: (valor: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{etiqueta}</span>
      <input
        type={tipo}
        name={nombre}
        required={requerido}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="rounded-lg border border-black/15 px-3 py-2 dark:border-white/20"
      />
      {error ? (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      ) : ayuda ? (
        <span className="text-xs text-black/50 dark:text-white/50">{ayuda}</span>
      ) : null}
    </label>
  );
}
