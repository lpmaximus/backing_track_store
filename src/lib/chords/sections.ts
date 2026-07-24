/**
 * Helpers compartilhados de pós-processamento de acordes detectados.
 *
 * Extraído do Music.ai para o BTC (e futuros providers) reusarem a mesma lógica
 * de colapsar repetições e agrupar em linhas — assim a cifra sai no mesmo
 * formato `ChordSection[]` que a página da música já sabe exibir, independente
 * de quem detectou.
 */
import type { ChordSection } from "./types";

/** Um acorde detectado num instante (segundos) — formato interno dos providers. */
export interface DetectedChord {
  start: number;
  label: string;
}

/**
 * Colapsa repetições consecutivas do mesmo acorde e agrupa em seções de 4
 * acordes por linha, no formato ChordSection (section vazio = detecção automática
 * não conhece verso/refrão).
 */
export function toSections(chords: DetectedChord[]): ChordSection[] {
  const sorted = [...chords].sort((a, b) => a.start - b.start);

  const collapsed: DetectedChord[] = [];
  for (const c of sorted) {
    if (collapsed.length && collapsed[collapsed.length - 1].label === c.label) continue;
    collapsed.push(c);
  }

  const sections: ChordSection[] = [];
  const PER_LINE = 4;
  for (let i = 0; i < collapsed.length; i += PER_LINE) {
    const group = collapsed.slice(i, i + PER_LINE);
    sections.push({
      section: "",
      timecode: Math.round(group[0].start),
      chords: group.map((g) => g.label).join(" "),
      times: group.map((g) => g.start), // tempo de cada acorde (p/ cifra sobre a sílaba)
    });
  }
  return sections;
}
