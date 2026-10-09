-- E-mails de ciclo de vida (retenção): boas-vindas, lembrete da 1ª separação
-- e resumo da 1ª semana. Idempotente — pode rodar direto no SQL Editor do Neon.
--
-- Tabelas próprias (e não colunas em users) de propósito: enquanto esta
-- migração não rodar, login e sessão continuam funcionando; só os e-mails de
-- ciclo de vida falham (best-effort, logado no console da Vercel).

CREATE TABLE IF NOT EXISTS user_email_prefs (
  user_id    integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  locale     varchar(5) NOT NULL DEFAULT 'pt',
  opt_out_at timestamp,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lifecycle_emails (
  id      serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind    varchar(30) NOT NULL,
  sent_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lifecycle_emails_user_kind_uq
  ON lifecycle_emails(user_id, kind);
