"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { iniciarSesion, type EstadoDeFormulario } from "@/lib/auth/acciones";

const ESTADO_INICIAL: EstadoDeFormulario = {};

function BotonDeEnvio() {
  // useFormStatus lee el estado del form padre. Va en un componente aparte
  // porque solo funciona dentro de un hijo del <form>, no en el mismo nivel.
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
    >
      {pending ? "Ingresando…" : "Ingresar"}
    </button>
  );
}

export function FormularioDeLogin() {
  const [estado, accion] = useActionState(iniciarSesion, ESTADO_INICIAL);

  return (
    <form action={accion} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="rounded-lg border border-black/15 px-3 py-2 dark:border-white/20"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Contraseña</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-lg border border-black/15 px-3 py-2 dark:border-white/20"
        />
      </label>

      {estado.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {estado.error}
        </p>
      )}

      <BotonDeEnvio />
    </form>
  );
}
