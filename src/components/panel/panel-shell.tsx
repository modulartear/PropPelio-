"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ItemDeNav } from "./nav-items";
import { SidebarNav } from "./sidebar-nav";
import { MenuDeUsuario } from "./user-menu";

/**
 * Estructura visual del panel: sidebar fijo en escritorio, Sheet deslizable en
 * mobile, header con el nombre del tenant y el menú del usuario.
 *
 * Recibe `tenant` y `usuario` ya resueltos por el layout (Server Component) —
 * este componente sólo es responsable de la interacción (abrir/cerrar el
 * menú mobile, dropdown), no de la autorización.
 */
export function PanelShell({
  tenantNombre,
  usuarioNombre,
  usuarioEmail,
  usuarioRol,
  items,
  children,
}: {
  tenantNombre: string;
  usuarioNombre: string | null;
  usuarioEmail: string;
  usuarioRol: string;
  items: ItemDeNav[];
  children: React.ReactNode;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar de escritorio */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar p-4 text-sidebar-foreground md:flex">
        <span className="px-3 py-2 text-sm font-semibold">{tenantNombre}</span>
        <SidebarNav items={items} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header, en las dos resoluciones */}
        <header className="flex h-14 items-center justify-between gap-4 border-b px-4">
          <div className="flex items-center gap-2">
            {/* Trigger del menu mobile: Sheet controlado a mano (no con
                SheetTrigger) para poder cerrarlo al navegar, via onNavigate. */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMenuAbierto(true)}
              aria-label="Abrir menú"
            >
              <Menu className="size-5" />
            </Button>
            <span className="text-sm font-semibold md:hidden">{tenantNombre}</span>
          </div>

          <MenuDeUsuario nombre={usuarioNombre} email={usuarioEmail} rol={usuarioRol} />
        </header>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
        <SheetContent side="left" className="w-72 p-4">
          <SheetHeader className="p-0">
            <SheetTitle>{tenantNombre}</SheetTitle>
          </SheetHeader>
          <SidebarNav items={items} onNavigate={() => setMenuAbierto(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
