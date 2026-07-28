"use client";

import { LogOut } from "lucide-react";

import { cerrarSesion } from "@/lib/auth/acciones";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ETIQUETA_DE_ROL: Record<string, string> = {
  TENANT_ADMIN: "Administrador",
  TENANT_USER: "Agente",
};

function iniciales(nombre: string | null, email: string): string {
  if (nombre) {
    const partes = nombre.trim().split(/\s+/);
    return (partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "");
  }
  return email.slice(0, 2);
}

export function MenuDeUsuario({
  nombre,
  email,
  rol,
}: {
  nombre: string | null;
  email: string;
  rol: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">
              {iniciales(nombre, email).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-1 font-normal">
          <span className="truncate text-sm font-medium">{nombre ?? email}</span>
          <span className="truncate text-xs text-muted-foreground">{email}</span>
          <Badge variant="secondary" className="mt-1 w-fit">
            {ETIQUETA_DE_ROL[rol] ?? rol}
          </Badge>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* cerrarSesion es una Server Action: se puede invocar directo desde
            un handler de cliente, sin envolverla en un <form>. Next maneja el
            redirect() que hace internamente. */}
        <DropdownMenuItem variant="destructive" onSelect={() => cerrarSesion()}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
