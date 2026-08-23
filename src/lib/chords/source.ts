/**
 * De QUAL áudio a cifra é detectada.
 *
 * Era daqui que vinha o defeito maior do pipeline. O código escolhia o stem de
 * "harmonia" — que no `htdemucs_6s` é o `other`, ou seja, o RESÍDUO depois de
 * tirar voz, bateria, baixo, guitarra e piano. Nas músicas guiadas por guitarra
 * (todo o rock/punk do acervo) esse stem é praticamente vazio, e o detector
 * devolvia zero ou um acorde. Pior: o fallback era `stems[0]`, que podia ser a
 * bateria.
 *
 * Além disso o BTC-ISMIR19 foi treinado em MIXAGENS COMPLETAS (Isophonics,
 * Billboard, RWC). Stem isolado é operar fora da distribuição de treino.
 *
 * Ordem de preferência:
 *   1. o MIX — é o que o modelo espera, e de quebra dá BPM e batidas confiáveis
 *      (o beat tracker do librosa precisa do transiente da bateria);
 *   2. `guitar` — nas músicas sem mix guardado, é onde a harmonia costuma estar;
 *   3. `harmony` (o antigo `other`);
 *   4. `melody` (nomenclatura das faixas importadas do Suno).
 * Bateria e baixo NUNCA são fonte de cifra.
 */

export interface StemLike {
  instrument: string;
  audioUrl: string;
}

export interface ChordAudioSource {
  url: string;
  /** De onde veio — vai no log e ajuda a diagnosticar cifra ruim. */
  from: string;
}

const STEM_FALLBACK_ORDER = ["guitar", "harmony", "melody"];

export function pickChordAudio(
  mixUrl: string | null | undefined,
  stems: StemLike[],
): ChordAudioSource | null {
  if (mixUrl) return { url: mixUrl, from: "mix" };
  for (const instrument of STEM_FALLBACK_ORDER) {
    const stem = stems.find((s) => s.instrument === instrument && s.audioUrl);
    if (stem) return { url: stem.audioUrl, from: instrument };
  }
  return null;
}
