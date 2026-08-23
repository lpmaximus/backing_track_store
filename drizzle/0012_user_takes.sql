-- Takes do usuário (overdub) — BTS-Studio / CONCEITO-FASE-2-PLAYER-CAMADAS-TAKES.md
-- Idempotente: pode rodar direto no SQL Editor do Neon como alternativa ao db:push.
--
-- Segunda camada do modelo de conteúdo: a base (stems/cifra) é compartilhável
-- entre Pros, o take é da PESSOA e nunca viaja junto. Por isso tabela própria e
-- não uma linha em `stems` — misturar faria a gravação de voz de alguém vazar
-- junto com o compartilhamento da música.

CREATE TABLE IF NOT EXISTS user_takes (
  id            serial PRIMARY KEY,
  song_id       integer NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id       integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          varchar(120) NOT NULL,
  audio_url     text NOT NULL,
  duration_sec  numeric(8,2),
  -- Compensação de latência do navegador, em ms. Convenção usada no player e
  -- na UI: posição de leitura do take = posição da música + offset_ms/1000.
  -- Positivo = gravado atrasado, precisa adiantar.
  offset_ms     integer NOT NULL DEFAULT 0,
  -- private (padrão) | band | public. Privado por padrão porque gravação de
  -- voz é dado pessoal sensível — não é conservadorismo, é a regra do conceito.
  visibility    varchar(20) NOT NULL DEFAULT 'private',
  created_at    timestamp NOT NULL DEFAULT now(),
  updated_at    timestamp NOT NULL DEFAULT now()
);

-- O acesso é sempre "takes DESTE usuário NESTA música" — nunca por música
-- sozinha. O índice espelha a consulta e reforça o isolamento.
CREATE INDEX IF NOT EXISTS user_takes_user_song_idx ON user_takes(user_id, song_id);
