-- R2 / ADR-BTS-002: comentários no repertório da banda.
-- Idempotente — pode rodar direto no SQL Editor do Neon como alternativa ao db:push.
CREATE TABLE IF NOT EXISTS setlist_comments (
  id          serial PRIMARY KEY,
  setlist_id  integer NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     text NOT NULL,
  created_at  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_setlist_comments_setlist ON setlist_comments(setlist_id);
