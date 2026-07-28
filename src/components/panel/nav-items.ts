/**
 * Navegación del panel de un tenant.
 *
 * Dato puro, sin JSX: se recorre igual desde el sidebar de escritorio y desde
 * el menú mobile, así que vive separado de cualquier componente.
 *
 * Los `href` son RELATIVOS AL NAMESPACE PÚBLICO del tenant (`/admin`, no
 * `/tenants/<por>/<valor>/admin`). Es importante que sea así: el prefijo
 * `/tenants/...` es un detalle interno de cómo el middleware reescribe la URL
 * para encontrar el archivo de ruta correcto (ver src/middleware.ts). Si un
 * link apuntara a ese prefijo, el middleware lo tomaría como un pathname
 * normal y le agregaría el prefijo DE NUEVO, duplicándolo. El browser tiene
 * que ver siempre `tenant.dominio.com/admin`, nunca la ruta interna.
 *
 * `icon` es el NOMBRE del ícono (no el componente de lucide-react en sí):
 * este archivo lo importa un Server Component (el layout del panel), y un
 * componente de ícono de lucide-react es un objeto `forwardRef` — no un
 * objeto plano — así que no se puede pasar de un Server Component a un
 * Client Component (React tira "Only plain objects can be passed..."). El
 * componente real se resuelve del lado del cliente, en `SidebarNav`.
 */
export type NombreDeIcono =
  "LayoutDashboard" | "Building2" | "Inbox" | "Calculator" | "FileText" | "Users" | "Settings";

export type ItemDeNav = {
  href: string;
  label: string;
  icon: NombreDeIcono;
  /** Sólo visible para TENANT_ADMIN. Ausente = visible para cualquier rol de tenant. */
  soloAdmin?: boolean;
  /**
   * Sin página propia todavía. Se muestra deshabilitado en vez de enlazar a
   * una ruta que no existe — más honesto que un link que 404 al clickear.
   */
  proximamente?: boolean;
};

export const NAV_ITEMS: ItemDeNav[] = [
  { href: "/admin", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/admin/propiedades", label: "Propiedades", icon: "Building2" },
  { href: "/admin/consultas", label: "Consultas", icon: "Inbox", proximamente: true },
  { href: "/admin/tasaciones", label: "Tasaciones", icon: "Calculator", proximamente: true },
  {
    href: "/admin/documentacion",
    label: "Documentación",
    icon: "FileText",
    proximamente: true,
  },
  {
    href: "/admin/usuarios",
    label: "Usuarios",
    icon: "Users",
    soloAdmin: true,
    proximamente: true,
  },
  {
    href: "/admin/configuracion",
    label: "Marca y configuración",
    icon: "Settings",
    soloAdmin: true,
    proximamente: true,
  },
];

/**
 * Los items que corresponden a un rol dado.
 *
 * Acepta cualquier string a proposito, sin acotarse a los roles de tenant: el
 * unico caso especial es "es TENANT_ADMIN o no", y tratar cualquier otra cosa
 * (incluido SUPER_ADMIN, que en la practica nunca llega hasta aca porque no
 * pertenece a un tenant) como "no admin" es lo seguro. Evita un cast en el
 * layout que llama a esta funcion.
 */
export function navParaRol(rol: string): ItemDeNav[] {
  return NAV_ITEMS.filter((item) => !item.soloAdmin || rol === "TENANT_ADMIN");
}
