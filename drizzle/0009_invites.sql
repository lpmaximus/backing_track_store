-- Convites de teste (aba /admin/convites) + trial de N dias no usuário.
-- Idempotente — pode rodar direto no SQL Editor do Neon como alternativa ao db:push.

-- ─── Trial no usuário ────────────────────────────────────────────────────────
-- O trial não cria role novo: `role` vira pro|proband e estes campos guardam
-- a validade e o role de origem para o rebaixamento automático.
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_plan          varchar(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_started_at    timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at       timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_previous_role varchar(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_source        varchar(30);

-- Usado pelo cron /api/jobs/trials para achar os trials vencidos.
CREATE INDEX IF NOT EXISTS idx_users_trial_ends
  ON users(trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;

-- ─── Modelos de texto do convite ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invite_templates (
  id         serial PRIMARY KEY,
  name       varchar(100) NOT NULL,
  subject    varchar(200) NOT NULL,
  body       text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- ─── Convites ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invites (
  id            serial PRIMARY KEY,
  email         varchar(255) NOT NULL,
  name          varchar(255),
  plan          varchar(20) NOT NULL DEFAULT 'pro',   -- pro | proband
  trial_days    integer NOT NULL DEFAULT 20,
  token         varchar(96) NOT NULL UNIQUE,
  -- pending | sent | failed | clicked | accepted | expired | revoked
  status        varchar(20) NOT NULL DEFAULT 'pending',
  subject       varchar(200) NOT NULL,
  body          text NOT NULL,
  error         text,
  expires_at    timestamp NOT NULL,
  sent_at       timestamp,
  send_count    integer NOT NULL DEFAULT 0,
  clicked_at    timestamp,
  accepted_at   timestamp,
  first_use_at  timestamp,
  trial_ends_at timestamp,
  user_id       integer REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamp NOT NULL DEFAULT now(),
  updated_at    timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invites_email  ON invites(lower(email));
CREATE INDEX IF NOT EXISTS idx_invites_status ON invites(status, created_at DESC);

-- Usado por markFirstUse() a cada abertura de página de música: precisa ser
-- barato. O índice parcial só cobre convites que ainda não registraram uso.
CREATE INDEX IF NOT EXISTS idx_invites_first_use
  ON invites(user_id)
  WHERE user_id IS NOT NULL AND first_use_at IS NULL;
