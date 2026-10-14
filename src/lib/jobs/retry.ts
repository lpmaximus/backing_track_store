/**
 * Classificação de falhas dos jobs de cifra/letra e política de retry.
 *
 * Por que existe: um job de letra morreu com "Prediction interrupted; please
 * retry (code: PA)" — falha de INFRA do Replicate, não do áudio — e o sistema o
 * marcou `failed` para sempre. Com centenas de separações isso é inaceitável.
 * Regra nova: erro transitório volta para a fila automaticamente (até
 * MAX_ATTEMPTS); só erro determinístico (áudio sem harmonia, sem vocal…) é
 * definitivo.
 *
 * Sem migração de banco: o contador de tentativas e o marcador de falha
 * definitiva viajam em um PREFIXO do `processing_jobs.error_message`:
 *   "[retry 2/3] msg"            → job voltou p/ a fila, 2ª tentativa
 *   "[retry 2/3][relaxed] msg"   → idem, com parâmetros relaxados (letra vazia)
 *   "[perm] msg"                 → falha definitiva: o backfill não retenta
 *
 * Módulo PURO (sem banco, sem rede) — testável isoladamente.
 */

export const MAX_ATTEMPTS = 3;
export const PERM_PREFIX = "[perm]";

/** Padrões de erro que NÃO dependem do áudio: infra, rede, fila, timeout. */
const TRANSIENT: RegExp[] = [
  /interrupted/i,
  /please retry/i,
  /\(code:\s*PA\)/i,
  /\b(408|425|429|500|502|503|504)\b/,
  /time(d)?[\s-]?out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|EPIPE/i,
  /fetch failed|socket hang up|network|connection (reset|closed)/i,
  /service unavailable|bad gateway|gateway time/i,
  /model (is )?(booting|starting|loading|cold)/i,
  /queue|capacity|overloaded|rate.?limit|throttl/i,
  /predição sem resposta/i,
];

/** Whisper devolveu nada utilizável — vale UMA nova tentativa com parâmetros relaxados. */
const EMPTY = /Nenhuma linha transcrita/i;

export type FailureKind = "transient" | "empty" | "permanent";

export function classifyFailure(error: string): FailureKind {
  const e = error ?? "";
  if (EMPTY.test(e)) return "empty";
  if (TRANSIENT.some((re) => re.test(e))) return "transient";
  return "permanent";
}

/** Quantas tentativas o job já consumiu (lido do prefixo; 0 se não há). */
export function attemptsOf(errorMessage: string | null | undefined): number {
  const m = /^\[retry (\d+)\/\d+\]/.exec(errorMessage ?? "");
  return m ? Number(m[1]) : 0;
}

/** A tentativa anterior já foi a versão relaxada? */
export function isRelaxed(errorMessage: string | null | undefined): boolean {
  return /^\[retry \d+\/\d+\]\[relaxed\]/.test(errorMessage ?? "");
}

/** Falha definitiva marcada — o backfill não deve recriar este job. */
export function isPermanent(errorMessage: string | null | undefined): boolean {
  return (errorMessage ?? "").startsWith(PERM_PREFIX);
}

export interface FailureDecision {
  action: "retry" | "fail";
  message: string;
}

const clip = (s: string) => s.slice(0, 480);

/**
 * Decide o destino de um job que falhou.
 *  - transitório: volta p/ a fila até MAX_ATTEMPTS; esgotado, vira `failed`
 *    SEM marca de definitivo (o backfill pode tentar de novo outro dia).
 *  - vazio (letra): 1 retry relaxado; se persistir, definitivo.
 *  - qualquer outro: definitivo.
 */
export function decideFailure(prevMessage: string | null | undefined, error: string): FailureDecision {
  const attempts = attemptsOf(prevMessage);
  const relaxed = isRelaxed(prevMessage);
  const kind = classifyFailure(error);

  if (kind === "transient") {
    if (attempts < MAX_ATTEMPTS) {
      const tag = `[retry ${attempts + 1}/${MAX_ATTEMPTS}]${relaxed ? "[relaxed]" : ""}`;
      return { action: "retry", message: clip(`${tag} ${error}`) };
    }
    return { action: "fail", message: clip(`[retry ${MAX_ATTEMPTS}/${MAX_ATTEMPTS}] esgotou tentativas: ${error}`) };
  }

  if (kind === "empty") {
    if (!relaxed && attempts < MAX_ATTEMPTS) {
      return { action: "retry", message: clip(`[retry ${attempts + 1}/${MAX_ATTEMPTS}][relaxed] ${error}`) };
    }
    return { action: "fail", message: clip(`${PERM_PREFIX} ${error}`) };
  }

  return { action: "fail", message: clip(`${PERM_PREFIX} ${error}`) };
}
