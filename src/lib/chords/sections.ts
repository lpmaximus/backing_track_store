/**
 * Helpers compartilhados de pós-processamento de acordes detectados.
 *
 * Extraído do Music.ai para o BTC (e futuros providers) reusarem a mesma lógica
 * de colapsar repetições e agrupar em linhas — assim a cifra sai no mesmo
 * formato `ChordSection[]` que a página da música já sabe exibir, independente
 * de quem detectou.
 */
import type { ChordSection } from "./types";
import { keyFit } from "./spelling";

/** Um acorde detectado num instante (segundos) — formato interno dos providers. */
export interface DetectedChord {
  start: number;
  label: string;
}

/**
 * Acorde segurado por mais que isso volta a ser escrito na cifra. Colapsar TODA
 * repetição transformava |Am |Am |G |G | em "Am G" — para quem vai tocar, saber
 * que o acorde continua soando por mais um trecho é informação, não ruído.
 */
const MAX_HOLD_SECONDS = 8;

/** Arredonda p/ 0,1s — mesma precisão da chave usada para casar cifra com letra. */
const t1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Colapsa repetições consecutivas do mesmo acorde e agrupa em seções de 4
 * acordes por linha, no formato ChordSection (section vazio = detecção automática
 * não conhece verso/refrão).
 */
export function toSections(chords: DetectedChord[]): ChordSection[] {
  const sorted = [...chords]
    .filter((c) => Number.isFinite(c.start) && c.label)
    .sort((a, b) => a.start - b.start);

  const collapsed: DetectedChord[] = [];
  for (const c of sorted) {
    const prev = collapsed[collapsed.length - 1];
    if (prev && prev.label === c.label && c.start - prev.start < MAX_HOLD_SECONDS) continue;
    collapsed.push(c);
  }

  const sections: ChordSection[] = [];
  const PER_LINE = 4;
  for (let i = 0; i < collapsed.length; i += PER_LINE) {
    const group = collapsed.slice(i, i + PER_LINE);
    sections.push({
      section: "",
      // Sem arredondar p/ segundo inteiro: o timecode é a chave que casa a cifra
      // com a linha da letra, e perder a casa decimal desalinhava as duas listas.
      timecode: t1(group[0].start),
      chords: group.map((g) => g.label).join(" "),
      times: group.map((g) => t1(g.start)), // tempo de cada acorde (p/ cifra sobre a sílaba)
    });
  }
  return sections;
}

/** Quantos acordes DIFERENTES a detecção encontrou — medida barata de qualidade. */
export function distinctCount(chords: DetectedChord[]): number {
  return new Set(chords.map((c) => c.label)).size;
}

/**
 * A cifra automática é CONFIÁVEL? O BTC foi treinado em pop/rock de tríades
 * limpas; em metal distorcido, riff cromático ou mix denso ele "chuta" acordes
 * vizinhos (E, Em, D, F, G, C#, F#…) que não formam tom nenhum. Em vez de
 * publicar isso como se fosse resultado normal, marcamos "baixa confiança" — a
 * UI avisa o músico e a comunidade corrige.
 *
 * Dois sinais, ambos independentes de BPM e de gênero declarado:
 *   • encaixe no tom (keyFit) < 0,70 — a maior parte dos acordes não pertence a
 *     nenhum tom;
 *   • 10 ou mais raízes diferentes (de 12) — "sopa cromática"; música real
 *     raramente passa de 8.
 * Menos de 8 acordes: pouco material para julgar → "ok".
 */
export function assessConfidence(chords: DetectedChord[]): "ok" | "low" {
  const valid = chords.filter((c) => Number.isFinite(c.start) && c.label);
  if (valid.length < 8) return "ok";
  const roots = new Set<string>();
  for (const c of valid) {
    const m = /^[A-G](#|b)?/.exec(c.label);
    if (m) roots.add(m[0]);
  }
  const fit = keyFit(valid);
  return fit < 0.7 || roots.size >= 10 ? "low" : "ok";
}
