/**
 * Pré-carregamento em janela deslizante (Fase S3 / ADR-BTS-005, §6).
 *
 * Módulo PURO — nenhuma dependência de Tone.js, DOM ou rede. É o protótipo que
 * a ADR pede para validar ANTES de construir a tela: "um setlist de 20 músicas
 * × 5 stems não cabe na memória de um celular de uma vez — este é o risco
 * técnico real da funcionalidade" (§6). Se a janela de índices estiver errada,
 * qualquer bug aparece só depois de carregar áudio de verdade, no celular
 * errado, no ensaio errado. Aqui o bug aparece num teste que roda em
 * milissegundos.
 *
 * A regra do ADR: "enquanto toca a música N, carrega os stems da N+1 e
 * descarta os da N−1". Generalizado para `ahead` músicas à frente (1 por
 * padrão) e `behind` músicas atrás mantidas em memória (0 por padrão — a ADR
 * não pede manter a anterior, só evita recarregar do zero se o usuário volta
 * uma música, o que `behind=1` cobriria; deixamos configurável).
 *
 * O motor real (useStageEngine, S3) chama `computePreloadActions` toda vez que
 * o índice atual muda — inclusive quando o usuário pula manualmente várias
 * músicas de uma vez (não só avança uma por uma) — e seu Map de buffers
 * carregados é o `loaded` de entrada. A função é sem estado: não guarda nada
 * entre chamadas, então é trivial de testar e impossível de "esquecer" de
 * limpar (o chamador aplica exatamente as duas listas que voltam).
 */

export type PreloadWindowOptions = {
  /** Quantas músicas à frente do índice atual devem estar carregadas. */
  ahead?: number;
  /** Quantas músicas atrás do índice atual permanecem carregadas (não descartadas). */
  behind?: number;
};

export type PreloadActions = {
  /** Índices que precisam ser carregados agora (não estão em `loaded`). */
  toLoad: number[];
  /** Índices que devem ser descartados (estão em `loaded` mas saíram da janela). */
  toDispose: number[];
  /** A janela desejada nesta chamada — útil para depuração/telemetria. */
  window: number[];
};

/**
 * Calcula o que carregar e o que descartar para que a janela em memória fique
 * exatamente em `[currentIndex - behind, currentIndex + ahead]` (recortada aos
 * limites válidos do setlist).
 *
 * @param loaded        índices atualmente carregados (buffers já em memória)
 * @param currentIndex  índice da música que está tocando (ou prestes a tocar)
 * @param total         número total de músicas do setlist
 */
export function computePreloadActions(
  loaded: ReadonlySet<number>,
  currentIndex: number,
  total: number,
  options: PreloadWindowOptions = {},
): PreloadActions {
  const ahead = Math.max(0, options.ahead ?? 1);
  const behind = Math.max(0, options.behind ?? 0);

  if (total <= 0 || currentIndex < 0 || currentIndex >= total) {
    // Fora dos limites: nada deveria estar carregado (setlist vazio, ou índice
    // inválido — o motor não deveria chegar aqui, mas a função não explode).
    return { toLoad: [], toDispose: [...loaded].sort((a, b) => a - b), window: [] };
  }

  const desired = new Set<number>();
  for (let i = currentIndex - behind; i <= currentIndex + ahead; i++) {
    if (i >= 0 && i < total) desired.add(i);
  }

  const toLoad: number[] = [];
  for (const i of desired) if (!loaded.has(i)) toLoad.push(i);

  const toDispose: number[] = [];
  for (const i of loaded) if (!desired.has(i)) toDispose.push(i);

  toLoad.sort((a, b) => a - b);
  toDispose.sort((a, b) => a - b);

  return { toLoad, toDispose, window: [...desired].sort((a, b) => a - b) };
}

/**
 * Pico de memória em número de músicas simultaneamente carregadas, para uma
 * passagem completa do setlist do início ao fim avançando uma música por vez.
 * Serve só de documentação/sanity-check (usado no teste): com ahead=1 e
 * behind=0 o pico é sempre 2 (a atual + a próxima), nunca o setlist inteiro —
 * é exatamente o que resolve o risco de memória descrito na ADR.
 */
export function maxWindowSize(total: number, options: PreloadWindowOptions = {}): number {
  const ahead = Math.max(0, options.ahead ?? 1);
  const behind = Math.max(0, options.behind ?? 0);
  return Math.min(total, ahead + behind + 1);
}
