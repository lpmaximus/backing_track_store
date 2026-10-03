/**
 * Grafia enarmônica e tom a partir dos acordes detectados.
 *
 * Dois defeitos que apareceram juntos em "Deixa Ele Ir":
 *   1. O BTC só fala sustenido (G#, D#, A#). Numa música em Dó menor isso vira
 *      "G# G#maj7 G# D#" quando o músico espera ler "Ab Abmaj7 Ab Eb".
 *   2. O tom vinha do chroma médio do mix (Krumhansl no predict.py), que confunde
 *      tons vizinhos — deu "Gm" para uma progressão Cm–Fm–G7–Ab–Eb–Bb.
 *
 * Aqui o tom é inferido da PRÓPRIA harmonia detectada (ponderada pelo tempo que
 * cada acorde soa) e a grafia segue a armadura desse tom. Trocar sustenido por
 * bemol nunca muda o comprimento do nome (G#→Ab, A#m→Bbm), então as cifras
 * posicionais (acorde sobre a sílaba) não desalinham.
 *
 * Sem dependências — roda no servidor (btc.ts) e no client (CifraView).
 */

const SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLATS  = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const PC: Record<string, number> = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4, F: 5, "E#": 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11,
};

type Quality = "maj" | "min" | "dim" | "any";

const ROOT_RE = /^([A-G](?:#|b)?)(.*)$/;

function qualityOf(rest: string): Quality {
  const r = rest.split("/")[0];
  if (/^(dim|°|m7b5|ø)/.test(r)) return "dim";
  if (/^m(?!aj)/.test(r)) return "min";
  if (/^5(?!\+)/.test(r)) return "any"; // power chord: sem terça
  return "maj";
}

function parse(label: string): { pc: number; q: Quality } | null {
  const m = ROOT_RE.exec(label.trim());
  if (!m || PC[m[1]] === undefined) return null;
  return { pc: PC[m[1]], q: qualityOf(m[2]) };
}

// Graus diatônicos (semitons a partir da tônica) e qualidade da tríade.
const MAJOR_DEG: [number, Quality][] = [[0, "maj"], [2, "min"], [4, "min"], [5, "maj"], [7, "maj"], [9, "min"], [11, "dim"]];
// Menor natural + V maior e vii° da harmônica (o G7 em Dó menor).
const MINOR_DEG: [number, Quality][] = [[0, "min"], [2, "dim"], [3, "maj"], [5, "min"], [7, "min"], [7, "maj"], [8, "maj"], [10, "maj"], [11, "dim"]];

function fits(deg: [number, Quality][], tonic: number, c: { pc: number; q: Quality }): boolean {
  const iv = (c.pc - tonic + 12) % 12;
  return deg.some(([d, q]) => d === iv && (c.q === "any" || q === c.q));
}

export interface TimedChord { start: number; label: string }

/**
 * Tom mais provável da sequência, ex. "Cm", "Bb", "F#m". Devolve "" se houver
 * pouca informação (menos de 3 acordes distintos) — aí quem chama mantém o tom
 * que já tinha.
 */
export function keyFromChords(chords: TimedChord[]): string {
  const sorted = [...chords].filter((c) => parse(c.label)).sort((a, b) => a.start - b.start);
  if (new Set(sorted.map((c) => c.label)).size < 3) return "";

  // Duração de cada acorde = até o próximo (o último vale a média).
  const items = sorted.map((c, i) => {
    const next = sorted[i + 1]?.start;
    return { ...parse(c.label)!, dur: next !== undefined ? Math.max(0.1, Math.min(next - c.start, 16)) : 2 };
  });
  const total = items.reduce((s, x) => s + x.dur, 0) || 1;

  let best = { score: -Infinity, tonic: 0, minor: false };
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const minor of [false, true]) {
      const deg = minor ? MINOR_DEG : MAJOR_DEG;
      const tq: Quality = minor ? "min" : "maj";
      let score = 0;
      for (const it of items) {
        if (fits(deg, tonic, it)) score += it.dur;
        else score -= it.dur * 0.5;
        if (it.pc === tonic && (it.q === tq || it.q === "any")) score += it.dur * 0.6; // peso da tônica
      }
      // Primeiro e último acorde costumam ser a tônica.
      for (const it of [items[0], items[items.length - 1]]) {
        if (it.pc === tonic && (it.q === tq || it.q === "any")) score += total * 0.05;
      }
      if (minor && items.some((it) => (it.pc - tonic + 12) % 12 === 7 && it.q === "maj")) score += total * 0.03; // V maior denuncia o menor
      if (score > best.score) best = { score, tonic, minor };
    }
  }
  const flats = prefersFlats(best.tonic, best.minor);
  return (flats ? FLATS : SHARPS)[best.tonic] + (best.minor ? "m" : "");
}

/** Armadura com bemóis? (F, Bb, Eb, Ab, Db maiores; Dm, Gm, Cm, Fm, Bbm, Ebm menores.) */
function prefersFlats(tonic: number, minor: boolean): boolean {
  const major = minor ? (tonic + 3) % 12 : tonic; // relativo maior
  return [5, 10, 3, 8, 1].includes(major) || (minor && tonic === 3);
}

/** Lê "Cm", "Bb", "G#m" etc. e diz se a grafia do tom é com bemol. */
export function keyUsesFlats(key: string | null | undefined): boolean | null {
  const p = key ? parse(key) : null;
  if (!p) return null;
  return prefersFlats(p.pc, p.q === "min");
}

/** Reescreve a nota (raiz e baixo "/X") de um acorde na grafia pedida. */
export function respell(label: string, flats: boolean): string {
  const names = flats ? FLATS : SHARPS;
  return label.replace(/(^|\/)([A-G])(#|b)?/g, (whole, pre: string, letter: string, acc?: string) => {
    const pc = PC[letter + (acc ?? "")];
    return pc === undefined ? whole : pre + names[pc];
  });
}

/**
 * Reescreve todos os acordes de uma linha (separados por espaço ou posicionais)
 * mantendo o espaçamento — tokens que não são acorde ("|A|", "3X") passam intactos
 * se a raiz não for reconhecida.
 */
export function respellLine(line: string, flats: boolean): string {
  return line.replace(/\S+/g, (tok) => (ROOT_RE.test(tok) ? respell(tok, flats) : tok));
}

/**
 * Corrige a grafia das cifras JÁ SALVAS (geradas antes desta correção) na hora
 * de exibir. Só mexe nas seções automáticas: o que uma pessoa corrigiu à mão
 * (`aligned: true`) aparece exatamente como ela escreveu.
 */
export function respellSections<T extends { chords: string; timecode: number; times?: number[]; aligned?: boolean }>(
  sections: T[],
): T[] {
  const timed: TimedChord[] = [];
  for (const sec of sections) {
    const toks = sec.chords.split(/\s+/).filter((t) => ROOT_RE.test(t));
    toks.forEach((label, i) => timed.push({ start: sec.times?.[i] ?? sec.timecode + i, label }));
  }
  const flats = keyUsesFlats(keyFromChords(timed));
  if (flats === null) return sections;
  return sections.map((sec) => (sec.aligned === true ? sec : { ...sec, chords: respellLine(sec.chords, flats) }));
}
