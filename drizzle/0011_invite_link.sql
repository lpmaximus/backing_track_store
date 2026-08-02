-- Convite por LINK (envio manual via WhatsApp/mensagem), além do envio por e-mail.
-- Idempotente — pode rodar direto no SQL Editor do Neon como alternativa ao db:push.

-- E-mail deixa de ser obrigatório: no convite por link o admin pode não saber
-- o endereço da pessoa (manda por WhatsApp).
ALTER TABLE invites ALTER COLUMN email DROP NOT NULL;

-- Como o convite foi entregue. 'email' mantém o comportamento atual.
ALTER TABLE invites ADD COLUMN IF NOT EXISTS channel varchar(10) NOT NULL DEFAULT 'email';

-- Texto curto para envio manual, editável no admin junto do texto do e-mail.
ALTER TABLE invite_templates ADD COLUMN IF NOT EXISTS share_body text;

CREATE INDEX IF NOT EXISTS idx_invites_channel ON invites(channel, created_at DESC);
