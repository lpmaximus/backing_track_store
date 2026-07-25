-- Fase S1 / ADR-BTS-005: ensaios, presença, pauta-ata e escalação com prontidão.
-- Idempotente — pode rodar direto no SQL Editor do Neon como alternativa ao db:push.

-- ─── Evento (ensaio | show | sessão de estudo) ───────────────────────────────
-- O Setlist é o repertório; o Evento é a ocorrência datada que aponta para ele.
CREATE TABLE IF NOT EXISTS setlist_events (
  id            serial PRIMARY KEY,
  setlist_id    integer NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,
  -- null = sessão de estudo pessoal do Pro (evento sem participantes)
  band_id       integer REFERENCES bands(id) ON DELETE CASCADE,
  type          varchar(20) NOT NULL DEFAULT 'rehearsal', -- rehearsal | show | practice
  title         varchar(200) NOT NULL,
  starts_at     timestamp NOT NULL,
  duration_min  integer,
  location      varchar(200),
  agenda        text,   -- objetivo do ensaio, escrito ANTES
  minutes       text,   -- ata, escrita DEPOIS
  created_by    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    timestamp NOT NULL DEFAULT now(),
  updated_at    timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_setlist_events_setlist ON setlist_events(setlist_id);
CREATE INDEX IF NOT EXISTS idx_setlist_events_band_start ON setlist_events(band_id, starts_at);

-- ─── Presença ────────────────────────────────────────────────────────────────
-- O convite é para a BANDA; aqui só se responde vou / não vou / talvez.
CREATE TABLE IF NOT EXISTS setlist_event_attendance (
  id           serial PRIMARY KEY,
  event_id     integer NOT NULL REFERENCES setlist_events(id) ON DELETE CASCADE,
  user_id      integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       varchar(10) NOT NULL, -- yes | no | maybe
  responded_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_setlist_event_attendance
  ON setlist_event_attendance(event_id, user_id);

-- ─── Pauta (antes) e ata (depois) ────────────────────────────────────────────
-- O que fica como 'repeat' entra pré-selecionado no ensaio seguinte.
CREATE TABLE IF NOT EXISTS setlist_event_items (
  id              serial PRIMARY KEY,
  event_id        integer NOT NULL REFERENCES setlist_events(id) ON DELETE CASCADE,
  setlist_song_id integer NOT NULL REFERENCES setlist_songs(id) ON DELETE CASCADE,
  status          varchar(10) NOT NULL DEFAULT 'planned', -- planned | done | repeat
  note            text,
  created_at      timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_setlist_event_items
  ON setlist_event_items(event_id, setlist_song_id);

-- ─── Escalação + prontidão ───────────────────────────────────────────────────
-- readiness é a única informação que sobe do integrante para o líder;
-- só o próprio escalado pode alterá-la (enforce na rota PATCH).
CREATE TABLE IF NOT EXISTS setlist_assignments (
  id              serial PRIMARY KEY,
  event_id        integer NOT NULL REFERENCES setlist_events(id) ON DELETE CASCADE,
  setlist_song_id integer NOT NULL REFERENCES setlist_songs(id) ON DELETE CASCADE,
  user_id         integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instrument      varchar(50),
  focus           text,
  loop_start_sec  integer,
  loop_end_sec    integer,
  readiness       varchar(10) NOT NULL DEFAULT 'todo', -- todo | studying | ready
  updated_at      timestamp NOT NULL DEFAULT now(),
  created_at      timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_setlist_assignments
  ON setlist_assignments(event_id, setlist_song_id, user_id);
CREATE INDEX IF NOT EXISTS idx_setlist_assignments_user
  ON setlist_assignments(user_id, event_id);
