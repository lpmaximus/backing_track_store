-- Migration Fase 1.5 — Pivô técnico (upload do usuário, cifra colaborativa, banda)
-- Gerada em 2026-07-11. Todas as mudanças são ADITIVAS (não quebram o schema atual).
--
-- COMO APLICAR:
--   Opção A (recomendada, é o fluxo do projeto): `npm run db:push`
--     — o drizzle-kit faz o diff de src/db/schema.ts contra o Neon e aplica isto.
--   Opção B (manual): rodar este arquivo direto no banco (psql / Neon SQL editor).
--
-- Idempotente: pode rodar mais de uma vez sem erro.

-- ─── Novas tabelas ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bands (
  id serial PRIMARY KEY,
  name varchar(200) NOT NULL,
  leader_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id integer REFERENCES subscriptions(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS band_members (
  id serial PRIMARY KEY,
  band_id integer NOT NULL REFERENCES bands(id) ON DELETE CASCADE,
  user_id integer REFERENCES users(id) ON DELETE CASCADE,
  invited_email text,
  invite_token varchar(64) UNIQUE,
  instrument varchar(50),
  status varchar(20) NOT NULL DEFAULT 'invited',
  joined_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS processing_jobs (
  id serial PRIMARY KEY,
  song_id integer NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  provider varchar(50) NOT NULL,
  provider_job_id text,
  stage varchar(30) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamp NOT NULL DEFAULT now(),
  completed_at timestamp
);

CREATE TABLE IF NOT EXISTS cifra_edit_history (
  id serial PRIMARY KEY,
  song_id integer NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_chords jsonb,
  new_chords jsonb,
  previous_cifra_text text,
  new_cifra_text text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cifra_reports (
  id serial PRIMARY KEY,
  song_id integer NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  reported_by_user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text,
  status varchar(20) NOT NULL DEFAULT 'open',
  created_at timestamp NOT NULL DEFAULT now()
);

-- ─── Colunas novas em songs ───────────────────────────────────────────────────
ALTER TABLE songs ADD COLUMN IF NOT EXISTS source_type varchar(20) NOT NULL DEFAULT 'admin';
ALTER TABLE songs ADD COLUMN IF NOT EXISTS uploaded_by_user_id integer REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS source_hash varchar(64);
ALTER TABLE songs ADD COLUMN IF NOT EXISTS processing_status varchar(20) NOT NULL DEFAULT 'ready';
ALTER TABLE songs ADD COLUMN IF NOT EXISTS chords_source varchar(20) NOT NULL DEFAULT 'admin';
ALTER TABLE songs ADD COLUMN IF NOT EXISTS chords_status varchar(20) NOT NULL DEFAULT 'validated';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'songs_source_hash_unique') THEN
    ALTER TABLE songs ADD CONSTRAINT songs_source_hash_unique UNIQUE (source_hash);
  END IF;
END $$;

-- ─── Coluna nova em setlists ──────────────────────────────────────────────────
ALTER TABLE setlists ADD COLUMN IF NOT EXISTS band_id integer REFERENCES bands(id) ON DELETE CASCADE;
