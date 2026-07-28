# Fase 3 — Panel admin del tenant (estilo Tokko Broker)

La fase más grande del plan (2-3 semanas, siete módulos). Se divide en
sub-etapas cerrables por separado — ver la tabla de estado.

## Estado por sub-etapa

| Sub-etapa | Contenido                                                       | Estado                   |
| --------- | --------------------------------------------------------------- | ------------------------ |
| **3.1**   | Esqueleto del panel: layout, navegación, guard, dashboard vacío | ✅ Este documento        |
| **3.2**   | CRUD de propiedades + fotos en Storage                          | ⏳ Parcial — ver abajo   |
| **3.3**   | Leads y tasaciones                                              | ⏳ Pendiente             |
| **3.4**   | Usuarios internos del tenant + configuración de marca           | ⏳ Pendiente             |
| —         | Documentación (módulo 5 del plan)                               | ⏳ Postergado — ver nota |

> El módulo de Documentación del plan se dejó para el final o para después de
> la Fase 3: es el único que no alimenta ninguna otra fase, y el más fácil de
> recortar si el tiempo aprieta (el propio plan lo sugiere para el builder,
> Fase 4, con el mismo criterio).

---

## 3.1 — Esqueleto del panel

### shadcn/ui

Instalado a mano: `ui.shadcn.com` está bloqueado por la política de red de
este entorno, así que `npx shadcn init` no puede correr. Los componentes se
bajaron **del código fuente oficial** vía `raw.githubusercontent.com` (sí
alcanzable), no reescritos de memoria. Detalle completo en D-028.

Componentes disponibles hoy en `src/components/ui/`: `button`, `sheet`,
`dropdown-menu`, `avatar`, `separator`, `card`, `badge`, `skeleton`, `tooltip`.
Se suman más con `npx shadcn add <componente>` si el CLI llega a funcionar en
el entorno de quien lo corra (por ejemplo, en el Codespace sin este bloqueo de
red) — `components.json` ya está configurado para eso.

### Dónde vive el panel

```
src/app/tenants/[por]/[valor]/admin/
  layout.tsx   → guard + shell visual
  page.tsx     → dashboard
```

Está bajo el mismo prefijo `/tenants/[por]/[valor]/` que la landing pública
del tenant (Fase 1), porque es ahí donde el middleware reescribe un request de
`<subdominio>.dominio.com/admin`. Ver `docs/fase-1-multitenant.md`.

### ⚠️ Los links usan el namespace público, nunca el interno

Todo `href` de la navegación es `/admin`, `/admin/propiedades`, etc. — **nunca**
`/tenants/<por>/<valor>/admin`. Es una trampa fácil de pisar: el prefijo
`/tenants/...` es un detalle de implementación del middleware para encontrar
el archivo de ruta correcto. Si un link apuntara ahí, el middleware lo tomaría
como un pathname normal y le **agregaría el prefijo de nuevo**, duplicándolo.

`usePathname()` en los componentes de navegación confirma esto: en Next, con
middleware que hace `rewrite` (no `redirect`), devuelve la URL que ve el
navegador — la pública — no el destino interno. Por eso los `href` de
`nav-items.ts` y las comparaciones de "activo" en `sidebar-nav.tsx` usan
exactamente el mismo namespace, sin que haya que traducir entre uno y otro.

Está cubierto por un test: `nav-items.test.ts` falla si algún `href` empezara
con `/tenants/`.

### Autorización

Una sola línea en el layout:

```ts
const { usuario, tenant } = await requireTenantUser();
```

Ya hace lo que hace falta (ver `docs/fase-2-auth.md`): redirige a `/login` sin
sesión, y responde 404 si la sesión es de otro tenant. El dashboard no repite
ninguna de las dos comprobaciones.

### Navegación por rol

`navParaRol()` en `nav-items.ts` es una función pura y testeada: filtra los
items marcados `soloAdmin` (Usuarios, Configuración) para todo lo que no sea
`TENANT_ADMIN`. Los módulos sin página propia todavía (todos menos el
Dashboard) se muestran **deshabilitados**, no como links que 404 al clickear —
más honesto sobre el estado real del panel que fingir que ya existen.

### Dark mode

Sigue atado a `prefers-color-scheme`, no a una clase `.dark`. Ver D-029: el
`@custom-variant dark` que trae el template de shadcn habría apagado en
silencio el dark mode que ya usan las páginas de fases anteriores.

---

## 3.2 — CRUD de propiedades

### Modelo de datos

`Property` y `PropertyPhoto` en `prisma/schema.prisma`, migración
`20260728082948_propiedades`. Aislamiento por tenant con el mismo patrón de
RLS que D-025 (`ALTER TABLE ... FORCE ROW LEVEL SECURITY` + política atada a
`app_user`/`tenant_actual()`).

`PropertyPhoto.tenantId` está denormalizado desde `Property.tenantId` a
propósito: `forTenant()` inyecta el filtro de tenant en todo modelo que no
esté en su lista de exclusiones, y sin esa columna `PropertyPhoto` quedaría
afuera de esa protección.

`latitude`/`longitude` existen en el modelo pero están sin usar — quedan
reservados para 3.2b (geocoding, bloqueada por la API key de Google Maps).

Ver D-030 para el aislamiento de Storage y qué significa el estado `SOLD`.

### Fotos: Supabase Storage

Bucket `property-photos`, creado por SQL en la misma migración (no es un
secreto, a diferencia de la contraseña de `app_user`). Público para lectura,
protegido por RLS de Storage para escritura — políticas comparan el primer
segmento del path contra el tenant del usuario autenticado. Límites: 5MB por
foto, 20 fotos por propiedad (elegidos por el usuario del proyecto al
arrancar esta sub-etapa).

El path de cada foto (`<tenantId>/<propertyId>/<uuid>.<ext>`) nunca usa el
nombre de archivo original — evita caracteres raros e intentos de path
traversal de raíz. Se guarda el **path**, no la URL pública: la URL se
deriva con `urlPublicaDeFoto()` en el momento de mostrarla, así un cambio de
dominio de Supabase no exige migrar datos.

Borrar una propiedad borra primero sus fotos de Storage a mano, antes de
borrar la fila: el `ON DELETE CASCADE` de Postgres borra `property_photos`,
pero no toca el bucket — son sistemas distintos.

### Server Actions

`src/lib/properties/acciones.ts`: `crearPropiedad`, `actualizarPropiedad`,
`eliminarPropiedad`, `subirFotos`, `eliminarFoto`. Todas empiezan con
`requireTenantUser()` y usan `forTenant(tenant.id)` — nunca el cliente crudo.

`actualizarPropiedad`/`eliminarPropiedad`/`eliminarFoto` usan
`updateMany`/`deleteMany` en vez de `update`/`delete`: un `where` de un solo
campo único (`id`) no admite que la extensión de tenant le agregue
`tenantId` sin reescribir la operación — mismo motivo por el que
`tenant-scope.ts` reescribe `findUnique` como `findFirst`. Con `updateMany`,
un `id` de otro tenant no matchea ninguna fila (`count === 0`) en vez de
lanzar una excepción que delate que la fila existe en otro tenant.

### Formulario: `<select>` nativo, no el componente de shadcn

`PropertyForm` (`src/components/properties/property-form.tsx`) usa
elementos `<select>` HTML nativos para los cuatro campos de clasificación
(tipo, operación, estado, moneda), no el `Select` de shadcn/Radix. Es el
primer formulario del proyecto con campos de selección enviados por Server
Action, y no hay forma de probarlo en un navegador real desde este entorno
(ver limitaciones de Codespaces en `docs/setup.md`). Un `<select>` nativo
participa en el `FormData` sin ninguna duda posible; el componente de Radix
queda disponible para cuando haga falta algo más rico y se pueda probar en
vivo.

### Rutas

```
/admin/propiedades           → listado
/admin/propiedades/nueva     → alta
/admin/propiedades/[id]      → edición + gestión de fotos + borrado
```

---

## Verificación

Automatizable sin credenciales:

```bash
npm test       # incluye nav-items.test.ts, validacion.test.ts, property-photos.test.ts
npm run build  # /tenants/[por]/[valor]/admin/propiedades* compilan como rutas dinámicas
```

**Requiere sesión real (Codespace, contra Supabase):**

1. Logueado como `TENANT_USER` (agente): en el sidebar **no** deberían
   aparecer "Usuarios" ni "Marca y configuración".
2. Logueado como `TENANT_ADMIN`: los siete módulos aparecen, los seis sin
   construir se ven deshabilitados con el tooltip "Próximamente".
3. Sin sesión, entrar directo a `tenant-a.localhost:3000/admin` → redirige a
   `/login`.
4. Con sesión de `tenant-a`, escribir a mano `tenant-b.localhost:3000/admin` →
   **404**, no el panel de `tenant-b`. Es el mismo chequeo que ya prueba
   `db:verify-rls` a nivel de datos, ahora aplicado a la primera pantalla real.
5. En mobile (o achicando la ventana), el sidebar se reemplaza por el botón de
   menú → abre el `Sheet` → un click en un item lo cierra y navega.
6. Crear una propiedad desde `/admin/propiedades/nueva`, subir 2-3 fotos,
   editar un campo y guardarlo, borrar una foto, y por último borrar la
   propiedad entera — confirmar que las fotos desaparecen también del bucket
   (panel de Supabase Storage) y no solo de la base.
7. Con sesión de `tenant-a`, escribir a mano la URL de una propiedad de
   `tenant-b` (`/admin/propiedades/<id-de-otro-tenant>`) → **404**.
