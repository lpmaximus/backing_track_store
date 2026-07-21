/**
 * Preços e custos de referência (R3 / ADR-BTS-003).
 *
 * Módulo puro — usado pelo dashboard de Consumo para MRR e margem. Os preços
 * batem com app/api/asaas/checkout (Pro) e app/termos (Pro Band). O custo de
 * separação é o do modelo de 6 stems (htdemucs_6s), ~R$0,40/música — A
 * CONFIRMAR contra o billing real do Replicate (ver ADR-BTS-003 §4).
 */

// Preço mensal por plano pago (R$/mês). ProBand = plano Banda.
export const PLAN_PRICE_MONTHLY: Record<string, number> = {
  pro: 19.9,
  proband: 59.9,
};

// Custo médio real por separação de áudio (6 stems). A confirmar no Replicate.
export const SEPARATION_COST = 0.4;

// Estimativas fixas mensais de infra (R$). Ajustar conforme a fatura real.
export const FIXED_INFRA_COST = {
  storageR2: 5, // R2 sem egress; estimativa baixa
  neon: 0, // plano free/atual
  vercel: 0, // plano free/atual
};

/** MRR a partir da contagem de assinantes ativos por plano. */
export function computeMrr(counts: { pro: number; proband: number }): number {
  return counts.pro * PLAN_PRICE_MONTHLY.pro + counts.proband * PLAN_PRICE_MONTHLY.proband;
}
