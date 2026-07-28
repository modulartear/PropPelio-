-- ============================================================================
-- Propiedades (Fase 3.2)
-- ============================================================================
--
-- Tres bloques: 1) tablas, 2) RLS de Postgres sobre esas tablas (mismo patron
-- que D-025: rol app_user, funcion tenant_actual()), 3) bucket de Storage
-- para las fotos + su propio RLS.
--
-- El bucket y sus politicas SI pueden ir en esta migracion versionada — a
-- diferencia de la contraseña de app_user (D-025), crear un bucket no es un
-- secreto. `npm run db:deploy` deja todo listo, sin pasos manuales en el
-- dashboard de Supabase.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Tablas
-- ----------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "property_type" AS ENUM ('HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL', 'OFFICE');

-- CreateEnum
CREATE TYPE "operation_type" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "property_status" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD');

-- CreateEnum
CREATE TYPE "currency" AS ENUM ('ARS', 'USD');

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "propertyType" "property_type" NOT NULL,
    "operationType" "operation_type" NOT NULL,
    "status" "property_status" NOT NULL DEFAULT 'AVAILABLE',
    "price" DECIMAL(14,2),
    "currency" "currency" NOT NULL DEFAULT 'ARS',
    "addressStreet" TEXT NOT NULL,
    "addressCity" TEXT NOT NULL,
    "addressProvince" TEXT NOT NULL,
    "addressZip" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "bedrooms" INTEGER,
    "bathrooms" INTEGER,
    "totalArea" DOUBLE PRECISION,
    "coveredArea" DOUBLE PRECISION,
    "garageSpaces" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_photos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "property_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "properties_tenantId_idx" ON "properties"("tenantId");

-- CreateIndex
CREATE INDEX "properties_tenantId_status_idx" ON "properties"("tenantId", "status");

-- CreateIndex
CREATE INDEX "property_photos_tenantId_idx" ON "property_photos"("tenantId");

-- CreateIndex
CREATE INDEX "property_photos_propertyId_idx" ON "property_photos"("propertyId");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ----------------------------------------------------------------------------
-- 2. RLS de Postgres (rol app_user, patron de D-025)
-- ----------------------------------------------------------------------------
--
-- GRANT ya lo cubre ALTER DEFAULT PRIVILEGES de la migracion anterior — se
-- aplica a toda tabla nueva automaticamente. Lo que NO se hereda son las
-- politicas: cada tabla nueva con tenantId necesita las suyas. Es la deuda
-- que ya quedo anotada en esa migracion.

ALTER TABLE "properties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "properties" FORCE ROW LEVEL SECURITY;

CREATE POLICY properties_aislamiento_por_tenant ON "properties"
  FOR ALL
  TO app_user
  USING ("tenantId" = public.tenant_actual())
  WITH CHECK ("tenantId" = public.tenant_actual());

ALTER TABLE "property_photos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "property_photos" FORCE ROW LEVEL SECURITY;

CREATE POLICY property_photos_aislamiento_por_tenant ON "property_photos"
  FOR ALL
  TO app_user
  USING ("tenantId" = public.tenant_actual())
  WITH CHECK ("tenantId" = public.tenant_actual());


-- ----------------------------------------------------------------------------
-- 3. Bucket de Storage + su RLS
-- ----------------------------------------------------------------------------
--
-- Bucket PUBLICO PARA LECTURA a proposito: son fotos de marketing pensadas
-- para aparecer en la landing publica del tenant, no archivos privados. Leer
-- una foto de una propiedad no requiere estar logueado, asi que no tiene
-- sentido pagar el costo de URLs firmadas (generarlas, que expiren, tener que
-- renovarlas) para contenido que es publico por diseño.
--
-- Lo que SI esta restringido es la ESCRITURA: solo un usuario autenticado que
-- pertenezca al tenant dueño de la propiedad puede subir o borrar sus fotos.
--
-- file_size_limit en bytes: 5MB = 5 * 1024 * 1024. Limite de CANTIDAD de
-- fotos por propiedad (20) no lo puede aplicar Storage — es una regla de
-- negocio que valida el Server Action antes de subir.
--
-- Convencion de path: <tenantId>/<propertyId>/<archivo>. Las politicas de
-- escritura comparan el primer segmento del path contra el tenant del
-- usuario autenticado.
--
-- IMPORTANTE — esto es un mecanismo DISTINTO al RLS de la seccion 2: las
-- operaciones de Storage van por la API de Supabase autenticada con la
-- sesion real del usuario (createServerSupabaseClient(), no el rol app_user
-- de Postgres), asi que las politicas usan auth.uid() de Supabase Auth, no
-- app.tenant_id via set_config. Ver D-030.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-photos',
  'property-photos',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "property-photos: lectura publica"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'property-photos');

CREATE POLICY "property-photos: el tenant sube sus propias fotos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'property-photos'
    AND (storage.foldername(name))[1] = (
      SELECT "tenantId" FROM public.users WHERE "authUserId" = auth.uid()::text
    )
  );

CREATE POLICY "property-photos: el tenant borra sus propias fotos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'property-photos'
    AND (storage.foldername(name))[1] = (
      SELECT "tenantId" FROM public.users WHERE "authUserId" = auth.uid()::text
    )
  );
