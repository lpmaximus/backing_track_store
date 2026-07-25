-- Fase S2 / ADR-BTS-005: mixagem em três camadas + preparo do repertório.
-- Idempotente — pode rodar direto no SQL Editor do Neon como alternativa ao db:push.

-- ─── Preparo por música ──────────────────────────────────────────────────────
-- Tom e velocidade deixam de ser texto no campo de notas ("tocar 1 tom abaixo")
-- e viram dado que o player aplica. gap_seconds é o respiro no modo palco (S3).
ALTER TABLE setlist_songs
  ADD COLUMN IF NOT EXISTS transpose_semitones integer NOT NULL DEFAULT 0;
ALTER TABLE setlist_songs
  ADD COLUMN IF NOT EXISTS speed numeric(3,2) NOT NULL DEFAULT 1.00;
ALTER TABLE setlist_songs
  ADD COLUMN IF NOT EXISTS gap_seconds integer NOT NULL DEFAULT 0;

-- ─── Camada 1: mixagem padrão do setlist ─────────────────────────────────────
-- Definida pelo líder; vale para todo mundo que abrir a música por este setlist.
CREATE TABLE IF NOT EXISTS setlist_song_mix (
  id              serial PRIMARY KEY,
  setlist_song_id integer NOT NULL REFERENCES setlist_songs(id) ON DELETE CASCADE,
  stem_key        varchar(50) NOT NULL,  -- vocal | drums | bass | guitar | harmony
  state           varchar(10) NOT NULL DEFAULT 'on',  -- on | mute | solo
  volume          integer NOT NULL DEFAULT 100        -- 0-100
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_setlist_song_mix
  ON setlist_song_mix(setlist_song_id, stem_key);

-- ─── Camada 3: override pessoal ──────────────────────────────────────────────
-- Só o dono lê e escreve. A camada 2 (auto-mute do instrumento do integrante)
-- é derivada de band_members.instrument e não tem tabela — ver src/lib/mix.ts.
CREATE TABLE IF NOT EXISTS setlist_song_mix_user (
  id              serial PRIMARY KEY,
  setlist_song_id integer NOT NULL REFERENCES setlist_songs(id) ON DELETE CASCADE,
  user_id         integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stem_key        varchar(50) NOT NULL,
  state           varchar(10) NOT NULL DEFAULT 'on',
  volume          integer NOT NULL DEFAULT 100
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_setlist_song_mix_user
  ON setlist_song_mix_user(setlist_song_id, user_id, stem_key);

CREATE INDEX IF NOT EXISTS idx_setlist_song_mix_user_owner
  ON setlist_song_mix_user(user_id, setlist_song_id);
