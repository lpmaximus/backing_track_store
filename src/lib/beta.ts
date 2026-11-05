/**
 * Open Beta — regras do piloto (PRD-BTS-001 v3.0, "Plano de Validação do MVP").
 *
 * Módulo PURO: sem banco, pode ir para o client, para o edge e para as rotas.
 *
 * A flag tem DUAS envs de propósito:
 *  - `BETA_FULL_ACCESS=true` é lida no servidor (rotas, access.ts, quota.ts);
 *  - `NEXT_PUBLIC_BETA_FULL_ACCESS=true` é a única que chega ao navegador
 *    (o Next só embute no bundle o que começa com NEXT_PUBLIC_).
 * As duas precisam estar iguais na Vercel. Se só a do servidor estiver ligada,
 * a rota libera mas a tela não mostra o botão; se só a pública, a tela mostra
 * mas a rota recusa (403) — nunca libera nada indevido.
 *
 * Encerrar o Beta = desligar as duas. Nenhuma conta é migrada: quem gravou takes
 * pela liberação do Beta mantém os arquivos, mas perde o botão de gravar até a
 * decisão de fim de Beta (ver PRD-BTS-001 §7.2).
 */

export function isBetaFullAccess(): boolean {
  return (
    process.env.NEXT_PUBLIC_BETA_FULL_ACCESS === "true" ||
    process.env.BETA_FULL_ACCESS === "true"
  );
}

function intEnv(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function numEnv(raw: string | undefined, fallback: number | null): number | null {
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Limites do piloto. Todos configuráveis por env SEM deploy de código — só
 * redeploy da Vercel para reler as envs. Os valores padrão são os da seção 7
 * do plano. Leia SEMPRE pela função (não guarde em constante de módulo), para
 * o teste conseguir trocar a env.
 */
export function betaLimits() {
  return {
    /** Separações por mês para quem é Free durante o Beta (plano: 5 a 10). */
    separationsPerMonth: intEnv(process.env.BETA_SEPARATIONS_PER_MONTH, 5),
    /** Duração máxima do arquivo enviado, em segundos (plano: 10 min). */
    maxDurationSec: intEnv(process.env.BETA_MAX_DURATION_SEC, 600),
    /** Separações simultâneas por usuário (plano: 1). */
    concurrentPerUser: intEnv(process.env.BETA_CONCURRENT_SEPARATIONS, 1),
    /**
     * Orçamento mensal de separação em R$. null = sem teto (só mede).
     * O plano manda definir ANTES de abrir o Beta.
     */
    monthlyBudgetBrl: numEnv(process.env.BETA_MONTHLY_BUDGET_BRL, null),
    /** Custo por separação em R$. Trocar pelo valor medido no Replicate. */
    separationCostBrl: numEnv(process.env.SEPARATION_COST_BRL, 0.4) ?? 0.4,
    /** Teto de takes de quem grava pela liberação do Beta (não é Studio). */
    takes: {
      free: { perSong: intEnv(process.env.BETA_TAKES_PER_SONG_FREE, 3), total: intEnv(process.env.BETA_TAKES_TOTAL_FREE, 10) },
      pro: { perSong: intEnv(process.env.BETA_TAKES_PER_SONG_PRO, 6), total: intEnv(process.env.BETA_TAKES_TOTAL_PRO, 30) },
    },
  };
}

/**
 * Cota mensal do Free: no Beta vira o pacote do piloto, nunca abaixo do Free
 * normal. Pura para poder ser testada sem banco (quota.ts importa o Neon).
 */
export function freeMonthlyLimit(baseFreeLimit: number): number {
  return isBetaFullAccess() ? Math.max(baseFreeLimit, betaLimits().separationsPerMonth) : baseFreeLimit;
}

/** Alertas de orçamento: fração do teto que dispara e-mail ao fundador. */
export const BUDGET_ALERT_THRESHOLDS = [0.7, 0.9, 1] as const;

/**
 * Teto de takes para um role que só grava por causa do Beta. Studio e admin
 * gravam pelo próprio plano e seguem a regra deles (null = sem teto do Beta).
 */
export function betaTakeCap(role?: string | null): { perSong: number; total: number } | null {
  if (role === "studio" || role === "admin") return null;
  const l = betaLimits().takes;
  return role === "pro" || role === "proband" ? l.pro : l.free;
}
