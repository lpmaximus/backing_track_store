-- Fase 2: coluna de compartilhamento de uploads do usuário.
-- Privado por padrão (default false) — protege músicas próprias.
-- Aplicar no Neon: psql "$DATABASE_URL" -f drizzle/0002_add_shared.sql
--                  (ou: npm run db:push)
ALTER TABLE "songs" ADD COLUMN IF NOT EXISTS "shared" boolean NOT NULL DEFAULT false;
