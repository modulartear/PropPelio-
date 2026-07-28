# Fase 3 — Panel admin del tenant (estilo Tokko Broker)

La fase más grande del plan (2-3 semanas, siete módulos). Se divide en
sub-etapas cerrables por separado — ver la tabla de estado.

## Estado por sub-etapa

| Sub-etapa | Contenido                                                       | Estado                   |
| --------- | --------------------------------------------------------------- | ------------------------ |
| **3.1**   | Esqueleto del panel: layout, navegación, guard, dashboard vacío | ✅ Este documento        |
| **3.2**   | CRUD de propiedades + fotos en Storage                          | ⏳ Pendiente             |
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

## Verificación

Automatizable sin credenciales:

```bash
npm test       # incluye nav-items.test.ts
npm run build  # /tenants/[por]/[valor]/admin compila como ruta dinámica
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
