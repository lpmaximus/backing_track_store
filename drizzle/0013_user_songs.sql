-- "Minha versão" de uma música do catálogo (BTS-Studio).
-- Idempotente: pode rodar direto no SQL Editor do Neon.
--
-- NÃO copia áudio. O R2 continua com um arquivo por stem; isto é uma folha de
-- configuração pessoal por cima da mesma base. Copiar de verdade multiplicaria
-- o storage por usuário para entregar exatamente o mesmo som.
--
-- Por construção é não destrutivo: "tirar uma faixa" desliga o stem NA SUA
-- versão; a música do catálogo não muda para mais ninguém.

CREATE TABLE IF NOT EXISTS user_songs (
  id              serial PRIMARY KEY,
  user_id         integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  song_id         integer NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  -- Null = usa o título original. Guardar null em vez de duplicar o título faz
  -- a versão acompanhar correções de metadado no catálogo até a pessoa
  -- renomear.
  title           varchar(255),
  -- Stems DESLIGADOS, por instrumento. Lista de exclusão e não de inclusão:
  -- assim um stem novo que apareça depois entra ligado por padrão, em vez de
  -- sumir da versão de quem pegou a música antes.
  disabled_stems  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamp NOT NULL DEFAULT now(),
  updated_at      timestamp NOT NULL DEFAULT now()
);

-- Uma versão por pessoa por música. Duas criariam a pergunta "a qual delas
-- pertence esta gravação?", já que user_takes é chaveado por (user, song).
CREATE UNIQUE INDEX IF NOT EXISTS user_songs_user_song_uq ON user_songs(user_id, song_id);
