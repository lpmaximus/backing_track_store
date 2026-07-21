-- Letra sincronizada (caminho 3: Whisper no stem de vocal + correção da comunidade).
-- Idempotente — pode rodar direto no SQL Editor do Neon como alternativa ao db:push.
ALTER TABLE songs ADD COLUMN IF NOT EXISTS lyrics jsonb;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS lyrics_source varchar(20);
ALTER TABLE songs ADD COLUMN IF NOT EXISTS lyrics_status varchar(20);
