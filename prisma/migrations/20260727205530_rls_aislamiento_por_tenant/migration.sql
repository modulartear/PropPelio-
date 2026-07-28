-- ============================================================================
-- Row Level Security: segunda capa de aislamiento entre tenants
-- ============================================================================
--
-- La capa 1 es `forTenant()` en la aplicacion, que inyecta `where tenantId`.
-- Esta es la capa 2: aunque un bug dejara pasar un query sin filtro, Postgres
-- no devuelve filas de otro tenant.
--
-- COMO FUNCIONA
--
-- Las politicas comparan contra `app.tenant_id`, una variable de sesion que la
-- aplicacion setea con `set_config('app.tenant_id', <id>, true)`. El `true`
-- final la hace LOCAL a la transaccion: se descarta al terminar, asi que una
-- conexion devuelta al pool nunca arrastra el tenant del request anterior.
-- Por eso el cliente de Prisma envuelve cada query en una transaccion.
--
-- POR QUE UN ROL NUEVO
--
-- El rol `postgres` de Supabase es dueño de estas tablas e ignora sus propias
-- politicas, incluso con FORCE ROW LEVEL SECURITY. Se crea `app_user`, que no
-- es dueño de nada y por lo tanto SI queda sujeto a RLS.
--
-- ⚠️ PASO MANUAL REQUERIDO DESPUES DE ESTA MIGRACION
--
-- Este archivo crea el rol SIN contraseña, a proposito: una contraseña en un
-- archivo versionado es una contraseña filtrada. Hay que ejecutar una vez, en
-- el SQL Editor de Supabase:
--
--   ALTER ROLE app_user WITH LOGIN PASSWORD 'una-contraseña-generada';
--
-- y despues armar DATABASE_URL con ese rol. Ver docs/fase-2-auth.md §RLS.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Rol de aplicacion
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    -- NOLOGIN hasta que se le asigne contraseña a mano.
    CREATE ROLE app_user NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;

-- Sin BYPASSRLS bajo ninguna circunstancia: es el atributo que anularia todo
-- lo que sigue. Se fuerza por si el rol ya existia con otra configuracion.
ALTER ROLE app_user NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Que las tablas futuras (Property, Lead, etc.) hereden los permisos sin que
-- nadie tenga que acordarse. Las POLITICAS de esas tablas si hay que
-- escribirlas: ver el recordatorio al final de este archivo.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;


-- ----------------------------------------------------------------------------
-- 2. Funcion auxiliar: el tenant del request actual
-- ----------------------------------------------------------------------------
--
-- STABLE permite que Postgres la evalue una vez por sentencia en vez de una
-- vez por fila, que es la diferencia entre una politica gratis y una cara.
--
-- El segundo argumento `true` de current_setting hace que devuelva NULL en vez
-- de error cuando la variable no esta seteada. Eso importa: sin contexto de
-- tenant, la comparacion da NULL, NULL no es TRUE, y la politica no deja pasar
-- ninguna fila. Falla cerrado.

CREATE OR REPLACE FUNCTION public.tenant_actual()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')
$$;

GRANT EXECUTE ON FUNCTION public.tenant_actual() TO app_user;


-- ----------------------------------------------------------------------------
-- 3. users — datos de un tenant
-- ----------------------------------------------------------------------------

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_aislamiento_por_tenant ON "users";
CREATE POLICY users_aislamiento_por_tenant ON "users"
  FOR ALL
  TO app_user
  -- USING filtra lo que se puede LEER y sobre que filas se puede operar.
  USING ("tenantId" = public.tenant_actual())
  -- WITH CHECK impide ESCRIBIR filas de otro tenant. Sin esto, un INSERT o un
  -- UPDATE podria crear datos ajenos aunque no pudiera leerlos.
  WITH CHECK ("tenantId" = public.tenant_actual());


-- ----------------------------------------------------------------------------
-- 4. tenant_modules — datos de un tenant
-- ----------------------------------------------------------------------------

ALTER TABLE "tenant_modules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_modules" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_modules_aislamiento_por_tenant ON "tenant_modules";
CREATE POLICY tenant_modules_aislamiento_por_tenant ON "tenant_modules"
  FOR ALL
  TO app_user
  USING ("tenantId" = public.tenant_actual())
  WITH CHECK ("tenantId" = public.tenant_actual());


-- ----------------------------------------------------------------------------
-- 5. tenants — tabla de ruteo, no de datos
-- ----------------------------------------------------------------------------
--
-- Recibe un trato distinto y vale explicar por que.
--
-- Resolver un host a un tenant ocurre ANTES de que exista contexto de tenant:
-- es literalmente la operacion que lo establece. Si SELECT estuviera
-- restringido, ningun request podria arrancar.
--
-- Que no este restringido no filtra nada sensible: esta tabla solo tiene el
-- nombre comercial y el subdominio, que son publicos por definicion — cualquiera
-- puede escribir un subdominio en el navegador y ver si responde.
--
-- Lo que si se restringe es la ESCRITURA: un tenant no puede modificar ni
-- borrar el registro de otro.

ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_lectura ON "tenants";
CREATE POLICY tenants_lectura ON "tenants"
  FOR SELECT
  TO app_user
  USING (true);

DROP POLICY IF EXISTS tenants_escritura_propia ON "tenants";
CREATE POLICY tenants_escritura_propia ON "tenants"
  FOR UPDATE
  TO app_user
  USING ("id" = public.tenant_actual())
  WITH CHECK ("id" = public.tenant_actual());

-- El alta y la baja de tenants son operaciones del super-admin y del registro
-- self-service, que corren por DATABASE_ADMIN_URL. `app_user` no las necesita
-- y por lo tanto no tiene politica de INSERT ni de DELETE: sin politica, la
-- operacion se rechaza.


-- ============================================================================
-- RECORDATORIO PARA LAS FASES SIGUIENTES
--
-- Cada tabla nueva que tenga `tenantId` (Property, Lead, Appraisal, Document,
-- TenantPage...) necesita SU PROPIA politica. Los GRANT los hereda por
-- ALTER DEFAULT PRIVILEGES, pero las politicas no se heredan: una tabla con
-- RLS habilitado y sin politicas rechaza todo, y una tabla SIN RLS habilitado
-- queda completamente abierta.
--
-- El patron a copiar:
--
--   ALTER TABLE "x" ENABLE ROW LEVEL SECURITY;
--   ALTER TABLE "x" FORCE ROW LEVEL SECURITY;
--   CREATE POLICY x_aislamiento_por_tenant ON "x"
--     FOR ALL TO app_user
--     USING ("tenantId" = public.tenant_actual())
--     WITH CHECK ("tenantId" = public.tenant_actual());
--
-- La auditoria de la Fase 8 deberia verificar que no quedo ninguna tabla con
-- tenantId sin politica.
-- ============================================================================
