/**
 * Higienização da letra transcrita.
 *
 * O Whisper roda sobre o STEM DE VOCAL do Demucs, que traz artefato metálico e
 * vazamento de instrumento nos trechos sem canto. É justamente esse material que
 * faz o modelo alucinar. Três defeitos apareceram em produção:
 *
 *   1. LOOP — a mesma linha repetida N vezes seguidas ("I want a piece." 4x).
 *      Causa: `condition_on_previous_text` realimentando a própria saída. Já
 *      desligamos isso no provider; aqui é a rede de segurança.
 *   2. TROCA DE ALFABETO — o large-v3 redetecta o idioma ao longo da faixa e
 *      escorrega, colando cirílico no fim de uma linha em inglês ("oh,ета до").
 *   3. LINHA VAZIA / SÓ PONTUAÇÃO — sobra de trecho instrumental.
 *
 * Nada aqui depende de saber o idioma de antemão: o alfabeto dominante é medido
 * na própria transcrição.
 */
import type { LyricsLine } from "./types";

/** Quantas repetições consecutivas da mesma linha sobrevivem. */
const MAX_REPEAT = 2;

/** Fração mínima do alfabeto dominante para valer a pena filtrar os outros. */
const DOMINANCE = 0.7;

const SCRIPTS: { name: string; re: RegExp }[] = [
  { name: "latin",    re: /[A-Za-zÀ-ɏ]/ },
  { name: "cyrillic", re: /[Ѐ-ӿ]/ },
  { name: "greek",    re: /[Ͱ-Ͽ]/ },
  { name: "hebrew",   re: /[֐-׿]/ },
  { name: "arabic",   re: /[؀-ۿ]/ },
  { name: "devanagari", re: /[ऀ-ॿ]/ },
  { name: "cjk",      re: /[぀-ヿ一-鿿가-힯]/ },
];

/** Alfabeto de um pedaço de texto — o primeiro que aparecer, ou "" se só símbolos. */
function scriptOf(text: string): string {
  for (const s of SCRIPTS) if (s.re.test(text)) return s.name;
  return "";
}

/** Conta letras por alfabeto no texto inteiro e devolve o dominante (ou ""). */
function dominantScript(lines: LyricsLine[]): string {
  const counts = new Map<string, number>();
  let total = 0;
  for (const l of lines) {
    for (const ch of l.text) {
      const s = scriptOf(ch);
      if (!s) continue;
      counts.set(s, (counts.get(s) ?? 0) + 1);
      total++;
    }
  }
  if (!total) return "";
  let best = "";
  let bestN = 0;
  for (const [name, n] of counts) if (n > bestN) { best = name; bestN = n; }
  return bestN / total >= DOMINANCE ? best : "";
}

/**
 * Remove os TRECHOS de alfabeto estrangeiro, preservando o resto da linha.
 *
 * A deriva do large-v3 cola o texto estrangeiro no fim de uma linha normal e às
 * vezes GRUDADO na última palavra ("oh,ета до"). Descartar a linha inteira
 * perderia letra boa; filtrar por palavra também não bastava, porque a palavra
 * misturada continua majoritariamente latina. Então a remoção é por sequência de
 * caracteres do alfabeto errado.
 */
function scrubForeign(text: string, dominant: string): string {
  if (!dominant) return text;
  let out = text;
  for (const s of SCRIPTS) {
    if (s.name === dominant) continue;
    out = out.replace(new RegExp(s.re.source + "+", "gu"), "");
  }
  return out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,;:])\1+/g, "$1")
    .trim();
}

/** Só pontuação, símbolo ou vazio — não é letra cantada. */
function isNoise(text: string): boolean {
  return !/[\p{L}\p{N}]/u.test(text);
}

/** Chave de comparação p/ detectar repetição (ignora caixa e pontuação). */
const repeatKey = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();

/**
 * Aplica as três limpezas e devolve a letra em ordem de tempo. Sempre devolve um
 * array (possivelmente vazio) — quem chama decide se vazio é falha.
 */
export function sanitizeLyrics(lines: LyricsLine[]): LyricsLine[] {
  const dominant = dominantScript(lines);

  const cleaned: LyricsLine[] = [];
  for (const line of lines) {
    const text = scrubForeign(line.text, dominant).trim();
    if (!text || isNoise(text)) continue;
    // As palavras com tempo (WhisperX) precisam continuar batendo com o texto.
    const words = line.words?.filter((w) => text.includes(w.text));
    cleaned.push(words?.length ? { ...line, text, words } : { time: line.time, text });
  }

  cleaned.sort((a, b) => a.time - b.time);

  const out: LyricsLine[] = [];
  let lastKey = "";
  let run = 0;
  for (const line of cleaned) {
    const key = repeatKey(line.text);
    if (key && key === lastKey) {
      run++;
      if (run > MAX_REPEAT) continue; // loop de alucinação — corta o excedente
    } else {
      lastKey = key;
      run = 1;
    }
    out.push(line);
  }
  return out;
}
