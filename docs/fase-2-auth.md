# Fase 2 — Autenticación y roles

Cómo funciona la identidad, los permisos y la segunda capa de aislamiento.

---

## 1. Las dos mitades de la identidad

El sistema de identidad está partido en dos, y entender el corte evita
confusiones más adelante:

|                   | Dónde vive               | Qué sabe                                                           |
| ----------------- | ------------------------ | ------------------------------------------------------------------ |
| **Autenticación** | `auth.users` de Supabase | **Quién** se autenticó (un UUID, el email, la contraseña hasheada) |
| **Autorización**  | Nuestra tabla `users`    | **Qué puede hacer** (rol) y **dónde** (tenant)                     |

El vínculo es `User.authUserId`. Se decidió una sola tabla en vez de la tabla
`profiles` separada que sugiere el plan, para no tener que migrar datos entre
dos tablas que representan lo mismo. Ver D-021.

```
navegador ──cookie──► middleware (refresca token)
                          │
                          ▼
              supabase.auth.getUser()  ← valida contra Supabase, no confía en la cookie
                          │  UUID
                          ▼
              buscarUsuarioPorAuthId()  ← rol + tenantId
                          │
                          ▼
                   guards de sesión
```

---

## 2. Guards disponibles

```ts
import {
  getCurrentUser, // UsuarioActual | null
  requireUser, // redirige a /login si no hay sesión
  requireTenantUser, // + exige pertenecer al tenant del host
  requireTenantAdmin, // + exige rol TENANT_ADMIN
  requireSuperAdmin, // exige rol SUPER_ADMIN
} from "@/lib/auth/session";
```

### `requireTenantUser()` hace dos chequeos, no uno

1. Que haya sesión.
2. Que el `tenantId` del usuario **coincida con el tenant que resolvió el host**.

El segundo es el que importa: sin él, un `TENANT_ADMIN` logueado en su panel
podría escribir el subdominio de otra inmobiliaria y entrar con su propia
sesión. Es el ataque más obvio contra un SaaS multi-tenant, y no lo cubre
ningún chequeo de rol.

### Todos responden 404, nunca 403

Un 403 confirma que el recurso existe. Para quien no es super-admin, el panel
central directamente no existe. Ver D-027.

### El `SUPER_ADMIN` no entra al panel de un tenant

No es un olvido. Si más adelante hace falta "entrar como" un cliente para dar
soporte, tiene que ser un flujo **explícito y auditable**, no un permiso
implícito que nadie recuerda que existe.

---

## 3. Las dos capas de aislamiento, ahora completas

| Capa                | Dónde         | Qué pasa si falla la otra                                                           |
| ------------------- | ------------- | ----------------------------------------------------------------------------------- |
| 1 — `forTenant()`   | Aplicación    | Si RLS estuviera mal configurado, el filtro por `tenantId` igual limita el query    |
| 2 — RLS en Postgres | Base de datos | Si un bug dejara pasar un query sin filtro, Postgres igual no devuelve filas ajenas |

### Por qué hizo falta un rol de Postgres nuevo

El rol `postgres` de Supabase es **dueño** de las tablas, y en Postgres el dueño
ignora sus propias políticas — incluso con `FORCE ROW LEVEL SECURITY`. Escritas
de la forma habitual, las políticas no habrían protegido **ni un solo query de
Prisma**: habrían sido una segunda capa sólo en el papel.

Por eso hay dos conexiones:

| Variable             | Rol        | RLS        | Usada por                                  |
| -------------------- | ---------- | ---------- | ------------------------------------------ |
| `DATABASE_URL`       | `app_user` | **aplica** | `forTenant()` — todos los datos de negocio |
| `DATABASE_ADMIN_URL` | `postgres` | bypasea    | Sólo `src/lib/db/tenants.ts` y `users.ts`  |

La segunda existe porque **tres operaciones ocurren antes de que exista un
tenant** y por lo tanto no pueden estar scopeadas: resolver el host (es la
operación que _establece_ el tenant), resolver al usuario autenticado, y el alta
self-service (crea el tenant que todavía no existe).

### Cómo se transmite el tenant a Postgres

`forTenant()` abre una transacción y declara el tenant antes del query:

```sql
SELECT set_config('app.tenant_id', '<id>', true);
```

El `true` la hace **local a la transacción**. Es lo esencial con el transaction
pooler: sin él, la conexión vuelve al pool con el tenant del request anterior
pegado, y el siguiente request que la tome vería datos ajenos — exactamente el
bug que todo esto busca evitar.

**Costo:** cada operación de Prisma es una transacción con una sentencia extra.
Un round-trip más por query. Ver D-025.

### ⚠️ Deuda que esto genera

**Cada tabla nueva con `tenantId` necesita su propia política.** Los `GRANT` se
heredan por `ALTER DEFAULT PRIVILEGES`; las políticas **no**. Una tabla con RLS
habilitado y sin políticas rechaza todo; una tabla **sin** RLS habilitado queda
completamente abierta.

El patrón a copiar está al final de la migración
`*_rls_aislamiento_por_tenant/migration.sql`.

---

## 4. Puesta en marcha

Además de lo de la Fase 1, esta fase requiere pasos que **no se pueden
automatizar** porque involucran credenciales.

### 4.1 Aplicar la migración

```bash
npm run db:deploy
```

### 4.2 Darle contraseña al rol `app_user`

La migración crea el rol **sin contraseña, a propósito**: una contraseña en un
archivo versionado es una contraseña filtrada.

Generala en la terminal (no la escribas a mano — la vas a tener que transcribir
dos veces y un typo produce un error de autenticación poco claro):

```bash
P=$(openssl rand -base64 24 | tr -d '/+=')
echo "$P"
```

El `tr -d '/+='` saca los caracteres que romperían la connection string.

En el **SQL Editor de Supabase**:

```sql
ALTER ROLE app_user WITH LOGIN PASSWORD 'la-que-generaste';
```

Verificá:

```sql
SELECT rolname, rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname = 'app_user';
```

Tiene que dar `rolcanlogin = true` y **`rolbypassrls = false`**. Si diera `true`,
el rol ignoraría las políticas y el RLS sería decorativo.

### 4.3 Las dos connection strings

```bash
# 1. Guardá la actual como DATABASE_ADMIN_URL (sin modificar)
echo "$DATABASE_URL"

# 2. Armá la nueva, con app_user
NUEVA=$(printf '%s' "$DATABASE_URL" | sed -E "s#://postgres\.([^:]+):[^@]+@#://app_user.\1:${P}@#")

# 3. Probala ANTES de guardarla
PRUEBA="$NUEVA" node -e 'const{Client}=require("pg");const c=new Client({connectionString:process.env.PRUEBA});c.connect().then(()=>c.query("select current_user")).then(r=>{console.log("✓",r.rows[0].current_user);return c.end()}).catch(e=>{console.error("✗",e.message);process.exit(1)})'
```

Buscás `✓ app_user`. Recién ahí cargás los secrets — primero
`DATABASE_ADMIN_URL` con el valor viejo, después `DATABASE_URL` con el nuevo. En
ese orden: al revés perdés el original.

Y rebuild del Codespace, que es cuando se inyectan.

### 4.4 Confirmación de email

**Supabase → Authentication → Providers → Email → "Confirm email"**

- **Activado** (default): el usuario confirma por mail antes de poder entrar.
- **Desactivado**: registro y login directo.

Recomendación: desactivalo mientras desarrollás, reactivalo antes de lanzar. Si
lo dejás activo y no te llega el mail, vas a pensar que el registro falló cuando
en realidad funcionó.

---

## 5. Verificar el criterio de cierre

### "Un usuario nuevo puede registrarse, elegir subdominio, y loguearse en su propio panel"

1. `/registro` — escribí el nombre y mirá cómo se sugiere y normaliza el
   subdominio. Probá con acentos (`Inmobiliaria Piñeyro` → `inmobiliaria-pineyro`)
   y con uno reservado (`api`) para ver el mensaje.
2. Enviá → caés en `/registro/listo`.
3. `/login` con esas credenciales → `/panel`, que muestra tu rol y `tenantId`.
4. Cerrá sesión y entrá a `/panel` directo → te manda al login.

### "Un `TENANT_ADMIN` no puede acceder a rutas de super-admin ni ver datos de otro tenant"

**Rutas de super-admin.** Logueado como `TENANT_ADMIN`, entrá a `/super-admin`.
Tiene que dar **404**, no 403 ni un error de servidor.

**Datos de otro tenant.** Es lo que verifica:

```bash
npm run db:verify-rls
```

Ese script intenta romper el aislamiento a propósito y falla si lo logra:

1. Leer sin contexto de tenant → tiene que devolver 0 filas.
2. Leer con contexto → sólo las propias.
3. Pedir explícitamente las de otro tenant → 0 filas.
4. Escribir en otro tenant → rechazado por `WITH CHECK`.
5. Desactivar RLS desde el rol de la app → sin permiso.

Termina en `✅ RLS aisla correctamente.` o dice cuál falló y con qué números.

---

## 6. Lo que NO está en esta fase

- **Proveedores OAuth (Google).** Supabase los soporta out-of-the-box; queda
  agregar el provider en el dashboard y un botón. No estaba en el criterio de
  cierre.
- **Emails con branding propio.** Los manda Supabase con su SMTP compartido,
  que tiene límite bajo de envíos. Resend entra cuando haya dominio (D-018).
- **Invitar agentes al tenant.** Es tarea de la Fase 3.
- **Recuperación de contraseña.** Supabase la maneja; falta la pantalla.
