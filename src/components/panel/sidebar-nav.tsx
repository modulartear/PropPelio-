"use client";

import {
  Building2,
  Calculator,
  FileText,
  Inbox,
  LayoutDashboard,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { ItemDeNav, NombreDeIcono } from "./nav-items";

/**
 * Mapa de nombre de ícono -> componente. Vive acá y no en nav-items.ts
 * porque este archivo SÍ es un Client Component: puede importar los
 * componentes de lucide-react sin problema, a diferencia del layout
 * (Server Component) que arma la lista de items. Ver el comentario en
 * nav-items.ts.
 */
const ICONOS: Record<NombreDeIcono, LucideIcon> = {
  LayoutDashboard,
  Building2,
  Inbox,
  Calculator,
  FileText,
  Users,
  Settings,
};

/**
 * Lista de navegación. La reusan el sidebar de escritorio y el Sheet mobile.
 *
 * `usePathname()` refleja la URL que ve el navegador (`/admin`, `/admin/...`),
 * NO la ruta interna reescrita por el middleware — coincide exactamente con
 * los `href` de NAV_ITEMS por eso mismo. Ver el comentario en nav-items.ts.
 */
export function SidebarNav({ items, onNavigate }: { items: ItemDeNav[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const activo = pathname === item.href;
        const Icono = ICONOS[item.icon];

        if (item.proximamente) {
          return (
            <span
              key={item.href}
              className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/50"
              title="Próximamente"
            >
              <Icono className="size-4" />
              {item.label}
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              activo
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icono className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
