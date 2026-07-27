import { defineConfig } from "prisma/config";

/**
 * Configuracion del CLI de Prisma (migraciones, studio, generate).
 *
 * Ojo: la `url` de aca es la que usa el CLI, NO la que usa la app en runtime.
 * Son distintas a proposito.
 *
 *   DIRECT_URL  -> session pooler de Supabase, puerto 5432. Es la que va aca.
 *                  Las migraciones necesitan una conexion de sesion: abren
 *                  transacciones largas, toman locks y usan sentencias
 *                  preparadas que el pooler de transacciones corta.
 *
 *   DATABASE_URL -> transaction pooler, puerto 6543. La usa el cliente en
 *                  runtime (ver src/lib/db.ts). Correr migraciones por ahi
 *                  falla de formas poco obvias.
 *
 * No se usa `dotenv`: el proyecto no tiene archivos .env en disco. Las
 * variables llegan como Codespaces secrets en desarrollo y como Environment
 * Variables de Vercel en preview/produccion. Ver docs/setup.md.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
