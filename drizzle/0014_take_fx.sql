-- Efeitos das gravações do usuário (a "pedaleira" do take).
-- Idempotente: pode rodar direto no SQL Editor do Neon.
--
-- Guarda `{ "preset": "hall", "mix": 0.4 }` — ver src/lib/takeFx.ts.
--
-- É configuração de REPRODUÇÃO, não processamento embutido: o arquivo gravado
-- continua limpo. É isso que permite trocar de efeito quantas vezes quiser sem
-- degradar a captação original, e o oposto de gravar já com reverb e descobrir
-- tarde demais que exagerou. O download renderiza a mesma cadeia na hora
-- (ver takeFxNodes.ts), então o arquivo baixado soa como o player.

ALTER TABLE user_takes ADD COLUMN IF NOT EXISTS fx jsonb;
