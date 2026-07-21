-- R3 / ADR-BTS-003: colunas do painel administrativo MVP.
-- Idempotente — pode rodar direto no SQL Editor do Neon como alternativa ao db:push.

ALTER TABLE users ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS block_reason text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_scheduled_at timestamp;

ALTER TABLE songs ADD COLUMN IF NOT EXISTS moderation_status varchar(20) NOT NULL DEFAULT 'approved';

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_songs_moderation ON songs(moderation_status);
