-- Área do Usuário: caixa de mensagens (avisos automáticos do sistema, banda e,
-- futuramente, promoções). Idempotente — pode rodar direto no SQL Editor do
-- Neon como alternativa ao db:push.

CREATE TABLE IF NOT EXISTS notifications (
  id         serial PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       varchar(20) NOT NULL DEFAULT 'system', -- system | promo | band
  title      varchar(200) NOT NULL,
  body       text,
  link       text,
  read       boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read);
