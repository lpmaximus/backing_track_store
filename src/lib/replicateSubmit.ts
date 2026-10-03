/**
 * POST de predição no Replicate que SOBREVIVE ao rate limit.
 *
 * Enquanto a conta tem menos de US$5 de crédito, o Replicate limita a criação
 * de predições a 6/min com burst de 1. O webhook de separação submete cifra e
 * letra com 350 ms de intervalo — a segunda levava 429 e a música ficava SEM
 * letra (incidente "Deixa Ele Ir", 2026-10-03). Aqui o 429 vira espera pelo
 * `retry_after` que o próprio Replicate informa, e nova tentativa.
 */
const API = "https://api.replicate.com/v1/predictions";

/** Teto de espera total: cabe folgado no limite de função da Vercel. */
const MAX_ATTEMPTS = 4;
const MAX_WAIT_MS = 15_000;

export interface SubmitOptions {
  /** Sem espera/retry: num 429 falha na hora (quem chama reenfileira). */
  fast?: boolean;
}

/** O erro é o rate limit do Replicate (429)? — fila deve esperar, não desistir. */
export function isThrottled(err: unknown): boolean {
  return /submit falhou \(429\)/.test(String(err));
}

export async function replicateCreatePrediction(
  version: string,
  input: Record<string, unknown>,
  label: string,
  opts: SubmitOptions = {},
): Promise<{ id: string }> {
  const attempts = opts.fast ? 1 : MAX_ATTEMPTS;
  let lastDetail = "";
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ version, input }),
    });
    if (res.ok) return (await res.json()) as { id: string };

    lastDetail = await res.text().catch(() => "");
    if (res.status !== 429 || attempt === attempts) {
      throw new Error(`${label} submit falhou (${res.status}): ${lastDetail}`);
    }
    let retryAfter = 10;
    try { retryAfter = Number(JSON.parse(lastDetail).retry_after) || 10; } catch { /* corpo não-JSON */ }
    const header = Number(res.headers.get("retry-after"));
    if (Number.isFinite(header) && header > 0) retryAfter = header;
    await new Promise((r) => setTimeout(r, Math.min(retryAfter * 1000 + 500, MAX_WAIT_MS)));
  }
  throw new Error(`${label} submit falhou (429): ${lastDetail}`);
}
