-- Cota de separações por convite (total do período de teste, sem reset mensal).
-- Idempotente — pode rodar direto no SQL Editor do Neon como alternativa ao db:push.

-- Quantas separações o convite libera no total do trial.
-- NULL = usa o limite padrão do plano (Pro 20 / Pro Band 40 por ciclo).
ALTER TABLE invites ADD COLUMN IF NOT EXISTS trial_separations integer;

-- Cópia do valor no usuário no momento em que o convite é aceito.
-- Enquanto NÃO for nulo, quota.ts ignora o limite por ciclo e conta o total
-- gasto desde trial_started_at. É limpo no rebaixamento (src/lib/trials.ts).
ALTER TABLE users   ADD COLUMN IF NOT EXISTS trial_separations integer;
