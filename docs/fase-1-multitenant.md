# Fase 1 — Núcleo multi-tenant

Cómo funciona la resolución de tenant y cómo verificarla.

> Estado: código completo. **Falta aplicar la migración y correr el seed** — ver
> §4. Eso requiere el Codespace con los secrets cargados.

---

## 1. El recorrido de un request

```
                lopez.proppelio.com/propiedades
                            │
                            ▼
              ┌──────────────────────────┐
              │  src/middleware.ts       │   edge runtime · sin base de datos
              │  resolverHost(Host)      │
              └────────────┬─────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   dominio raíz       subdominio /       reservado, anidado
        │             dominio propio     o sin Host
        │                  │                  │
        ▼                  ▼                  ▼
   sigue de largo      rewrite a            404
   (marketing)     /tenants/subdomain/
                     lopez/propiedades
                           │
                           ▼
              ┌──────────────────────────┐
              │  tenantDesdeSegmentos()  │   Node · consulta la base
              │  → TenantContext         │   cacheado por request
              └────────────┬─────────────┘
                           │
                           ▼
              ┌──────────────────────────┐
              │  forTenant(tenant.id)    │   todo query lleva el filtro
              └──────────────────────────┘
```

**El middleware no toca la base.** Corre en el edge runtime, donde Prisma no
funciona. Por eso reescribe con el host y el `tenantId` se resuelve después, ya
en Node. Ver D-019.

Consecuencia útil: los subdominios reservados y los hosts inválidos se rechazan
con 404 sin gastar una conexión a la base.

---

## 2. Las dos capas de aislamiento

### Capa 1 — `forTenant()` (implementada)

```ts
import { forTenant } from "@/lib/db";

const db = forTenant(tenant.id);
await db.user.findMany({ where: { role: "TENANT_USER" } });
// ejecuta: where: { role: "TENANT_USER", tenantId: tenant.id }
```

Tres propiedades que la hacen difícil de romper:

1. **La lista de modelos es de exclusiones, no de inclusiones.** Un modelo nuevo
   queda filtrado por defecto. Agregar `Property` al schema y olvidarse de
   `tenant-scope.ts` no abre una fuga. Al revés — una lista de modelos a
   filtrar — el olvido sería silencioso.
2. **El `tenantId` se aplica último.** Uno que venga en los args (por ejemplo
   desde un parámetro de URL) no puede sobrescribir el del scope.
3. **ESLint bloquea el atajo.** Importar el cliente crudo fuera de
   `src/lib/db/**` es un error de lint, no una fuga que se descubre en
   producción.

> **Limitación conocida:** el filtro aplica al modelo raíz, no a las relaciones
> anidadas de un `include`. No abre una fuga en la práctica — se llega a esas
> filas por una raíz que sí está filtrada — pero es parte de por qué la capa 2
> importa, y la auditoría de la Fase 8 debería probarlo explícitamente.

### Capa 2 — RLS en Postgres (Fase 2)

Las políticas filtran por el usuario autenticado, y en la Fase 1 todavía no hay
autenticación: no habría contra qué escribirlas. Es una tarea propia de la
Fase 2 en el plan del proyecto.

---

## 3. Piezas y dónde están

| Archivo                          | Rol                                                     |
| -------------------------------- | ------------------------------------------------------- |
| `src/middleware.ts`              | Lee el `Host`, reescribe o rechaza                      |
| `src/lib/tenant/host.ts`         | Clasifica el host. Función pura, testeada               |
| `src/lib/tenant/resolve.ts`      | `getTenantFromRequest()`, `requireTenant()`             |
| `src/lib/db/tenants.ts`          | Único lugar que busca tenants con el cliente sin filtro |
| `src/lib/db/tenant-scope.ts`     | Inyección del `tenantId`. Función pura, testeada        |
| `src/lib/db/tenant-client.ts`    | Conecta esa lógica a Prisma vía `$extends`              |
| `src/app/tenants/[por]/[valor]/` | Landing genérica del tenant                             |

### Cómo obtener el tenant en tu código

```ts
// En una página o Server Action que sólo tiene sentido dentro de un tenant:
import { requireTenant } from "@/lib/tenant/resolve";
const tenant = await requireTenant(); // 404 si no hay

// Si el caso "sin tenant" es válido (dominio raíz):
import { getTenantFromRequest } from "@/lib/tenant/resolve";
const tenant = await getTenantFromRequest(); // TenantContext | null
```

`requireTenant()` responde **404 y no 500**: pedir un tenant que no existe es
una URL equivocada, no un error del servidor. Tampoco distingue "no existe" de
"suspendido" — decirlo filtraría qué subdominios están tomados.

---

## 4. Puesta en marcha (en el Codespace)

```bash
npm run db:deploy   # aplica la migración inicial a Supabase
npm run db:seed     # crea los tenants de prueba
npm run dev
```

`db:deploy` usa `prisma migrate deploy`, no `migrate dev`: aplica las
migraciones ya versionadas sin intentar generar nuevas ni resetear nada.

El seed es **idempotente** — correrlo dos veces no duplica ni falla.

### Qué crea el seed

| Subdominio | Nombre              | Estado    | Para probar                   |
| ---------- | ------------------- | --------- | ----------------------------- |
| `tenant-a` | Inmobiliaria López  | ACTIVE    | resolución por subdominio     |
| `tenant-b` | Propiedades del Sur | ACTIVE    | dominio propio                |
| `tenant-c` | Suspendida SA       | SUSPENDED | que un suspendido no resuelva |

---

## 5. Verificar el criterio de cierre

### "Visitar `tenant-a.localhost:3000` y `tenant-b.localhost:3000` muestra contenido distinto"

Con `npm run dev` corriendo:

| URL                            | Esperado                           |
| ------------------------------ | ---------------------------------- |
| http://localhost:3000          | Sitio de marketing                 |
| http://tenant-a.localhost:3000 | "Bienvenido a Inmobiliaria López"  |
| http://tenant-b.localhost:3000 | "Bienvenido a Propiedades del Sur" |
| http://tenant-c.localhost:3000 | **404** (suspendido)               |
| http://noexiste.localhost:3000 | **404**                            |
| http://api.localhost:3000      | **404** (subdominio reservado)     |

> ⚠️ **En Codespaces, desde el navegador sólo se ve el sitio de marketing.**
>
> La URL que abre Codespaces (`<algo>-3000.app.github.dev`) pasa por su proxy de
> reenvío de puertos, que le entrega a Next `Host: localhost:3000`. El
> middleware lo clasifica como dominio raíz y sirve el marketing — correcto,
> pero significa que **los subdominios no se pueden probar desde el navegador**:
> no existe `tenant-a.<algo>.app.github.dev`, y aunque existiera, el proxy
> reescribiría el Host igual.
>
> Las pruebas de tenant se hacen con `curl` desde la terminal del Codespace,
> mandando el `Host` a mano, como abajo. En una máquina con el proyecto corriendo
> local, en cambio, los navegadores resuelven `*.localhost` a `127.0.0.1` solos y
> las URLs de la tabla funcionan tal cual.

**Desde la terminal**, que funciona igual en el Codespace:

```bash
for h in localhost:3000 tenant-a.localhost:3000 tenant-b.localhost:3000 \
         tenant-c.localhost:3000 noexiste.localhost:3000 api.localhost:3000; do
  printf "%-30s %s\n" "$h" "$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $h" http://127.0.0.1:3000/)"
done
```

**Dominio propio**, sin comprar ningún dominio:

```bash
curl -s -H "Host: propiedadesdelsur.test" http://127.0.0.1:3000/ | grep -o "Bienvenido a [^<]*"
```

### "Intentar acceder a datos de otro tenant devuelve 404/403, no error de servidor"

Se puede probar pidiendo a mano la ruta interna que normalmente escribe el
middleware:

```bash
# Un tenant que no existe -> 404, no 500
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/tenants/subdomain/noexiste

# Un campo de búsqueda inventado -> 404, no un query arbitrario
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/tenants/id/algo
```

El segundo es el importante: el segmento `por` viene de la URL, y se valida
contra los dos valores permitidos antes de usarlo como nombre de campo.

---

## 6. Tests

```bash
npm test
```

42 casos con el runner nativo de Node, sin dependencias. Cubren la clasificación
de hosts y la inyección del `tenantId`, que son los dos puntos donde un bug
significa que una inmobiliaria vea los datos de otra.

Corren en milisegundos y no necesitan base de datos: por eso ambas lógicas están
aisladas en funciones puras.

---

## 7. Lo que NO está en esta fase

- **Autenticación.** Cualquiera puede ver la landing de cualquier tenant; es
  pública por diseño. El panel protegido es la Fase 2.
- **RLS.** Fase 2.
- **Wildcard DNS.** Fase 6 / D-018.
