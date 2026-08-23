/**
 * Cortes por faixa — "apagar um trecho do áudio pelo gráfico".
 *
 * Módulo PURO (sem banco, sem Tone.js): é importado pela rota que valida o que
 * chega, pelo player que silencia o trecho e pelo render que grava o corte no
 * arquivo. Ter as três pontas lendo a MESMA normalização é o que impede o caso
 * clássico de "some na tela, volta no download".
 *
 * ── O que um corte é, exatamente ─────────────────────────────────────────────
 * Um intervalo [start, end) da LINHA DO TEMPO DA MÚSICA em que aquela faixa
 * fica muda. O corte NÃO encurta a música: se apagar o trecho puxasse o resto
 * para trás, a faixa sairia de sincronia com todas as outras, com a cifra e com
 * a letra — que são posicionadas por timecode. Silenciar mantém tudo alinhado,
 * que é o que "apagar a parte errada da gravação" significa num multipista.
 *
 * ── Não destrutivo por padrão ───────────────────────────────────────────────
 * O corte vive na SUA versão da música (user_songs.track_cuts), não no arquivo.
 * Dá para desfazer sempre, e o mesmo stem continua servindo todo mundo — o R2
 * guarda um arquivo por faixa, não um por usuário. Quem quiser gravar o corte
 * no arquivo usa "aplicar de vez", e isso só existe para faixa PRÓPRIA (take):
 * consolidar um stem do catálogo obrigaria a duplicar o áudio por pessoa.
 *
 * ── Chave da faixa ──────────────────────────────────────────────────────────
 * A mesma do player: `instrument` para stem ("drums", "bass"…) e `take:<id>`
 * para gravação do usuário. Ver Track em WavePlayer.tsx.
 */

export type Cut = { start: number; end: number };

/** Mapa faixa → cortes. Faixa sem corte simplesmente não aparece. */
export type TrackCuts = Record<string, Cut[]>;

/** Trecho menor que isto é clique errado, não intenção. */
export const MIN_CUT_SEC = 0.05;

/**
 * Teto de cortes por faixa. Não é limite técnico: é o ponto em que a lista
 * deixa de ser "tirei os três erros" e vira edição de áudio de verdade, que
 * pede outra ferramenta (e outro formato de armazenamento).
 */
export const MAX_CUTS_POR_FAIXA = 40;

const MAX_FAIXAS = 32;

/**
 * Teto de sanidade, em segundos (4 horas). Existe para barrar valor absurdo
 * vindo de cliente adulterado, não para conferir contra a duração real da
 * música: `songs.duration` é metadado e às vezes está zerado ou desatualizado,
 * e validar contra ele apagaria cortes legítimos de quem tem o áudio certo.
 */
const MAX_TEMPO_SEG = 4 * 60 * 60;

/** `take:<id>` → id; qualquer outra coisa → null. */
export function takeIdDaChave(key: string): number | null {
  const m = /^take:(\d+)$/.exec(key);
  return m ? Number(m[1]) : null;
}

/**
 * Ordena, descarta lixo e FUNDE cortes que se tocam.
 *
 * A fusão não é cosmética: sem ela, cortar duas vezes o mesmo trecho iria
 * empilhando intervalos idênticos até estourar o teto, e a lista guardada
 * cresceria sem que nada mudasse no som.
 */
export function normalizeCuts(raw: unknown, duracaoMax?: number): Cut[] {
  if (!Array.isArray(raw)) return [];

  const limite = duracaoMax && duracaoMax > 0 ? Math.min(duracaoMax, MAX_TEMPO_SEG) : MAX_TEMPO_SEG;

  const limpos = raw
    .map(c => {
      const o = c as { start?: unknown; end?: unknown };
      const s = Number(o?.start);
      const e = Number(o?.end);
      if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
      const start = Math.max(0, Math.min(s, limite));
      const end = Math.max(0, Math.min(e, limite));
      if (end - start < MIN_CUT_SEC) return null;
      // 3 casas = milissegundo. Guardar o float inteiro só engorda o JSON com
      // precisão que ninguém ouve.
      return { start: Number(start.toFixed(3)), end: Number(end.toFixed(3)) };
    })
    .filter((c): c is Cut => c !== null)
    .sort((a, b) => a.start - b.start);

  const fundidos: Cut[] = [];
  for (const c of limpos) {
    const ultimo = fundidos[fundidos.length - 1];
    if (ultimo && c.start <= ultimo.end) {
      ultimo.end = Math.max(ultimo.end, c.end);
    } else {
      fundidos.push({ ...c });
    }
  }

  return fundidos.slice(0, MAX_CUTS_POR_FAIXA);
}

/**
 * Valida o mapa inteiro. `chavesValidas` vem de quem conhece a música (stems
 * existentes + takes do usuário): sem esse filtro a coluna viraria depósito de
 * chaves mortas — faixa que foi apagada, instrumento digitado errado — e
 * ninguém notaria, porque corte em faixa inexistente não faz barulho nenhum.
 */
export function sanitizeTrackCuts(
  raw: unknown,
  chavesValidas: ReadonlySet<string>,
  duracaoMax?: number,
): TrackCuts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const out: TrackCuts = {};
  let n = 0;

  for (const [key, valor] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= MAX_FAIXAS) break;
    if (!chavesValidas.has(key)) continue;
    const cortes = normalizeCuts(valor, duracaoMax);
    if (cortes.length === 0) continue; // faixa sem corte não ocupa espaço
    out[key] = cortes;
    n++;
  }

  return out;
}

/** Soma dos trechos cortados, em segundos — só para exibir na interface. */
export function totalCortado(cortes: Cut[]): number {
  return cortes.reduce((acc, c) => acc + (c.end - c.start), 0);
}

/** A posição da música cai dentro de algum corte? */
export function dentroDeCorte(cortes: Cut[], t: number): boolean {
  return cortes.some(c => t >= c.start && t < c.end);
}
