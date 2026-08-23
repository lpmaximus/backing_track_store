"use client";

import type * as React from "react";
import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import { useTranslations } from "next-intl";
import DownloadPanel from "./DownloadPanel";
import { fxVazio, type TakeFx } from "@/src/lib/takeFx";
// A mesma cadeia usada no download — ver o cabeçalho de takeFxNodes.ts.
import { montarFx } from "./takeFxNodes";
import { normalizeCuts, totalCortado, type Cut, type TrackCuts } from "@/src/lib/cuts";

export type Stem = {
  id: number;
  instrument: string;
  label: string | null;
  audioUrl: string;
};

/** Gravação do próprio usuário sobre esta música (overdub). */
export type Take = {
  id: number;
  name: string;
  /**
   * Caminho da NOSSA rota (`/api/takes/:id/audio`), não o link do R2. A rota
   * confere a sessão e redireciona para um link assinado de uma hora — a URL
   * pública do bucket nunca chega ao navegador.
   */
  audioUrl: string;
  offsetMs: number;
  /** Formato real do arquivo. O caminho acima termina em `/audio` e não diz. */
  ext?: string;
  /** Efeito de reprodução — ver src/lib/takeFx.ts. */
  fx?: TakeFx | null;
};

/**
 * Controle imperativo do transporte, para quem precisa comandar o player de
 * fora — hoje só o painel de gravação, que tem de dar play na base no mesmo
 * instante em que abre o microfone.
 *
 * É imperativo de propósito: "começar a tocar agora" é um evento no tempo, não
 * um estado. Passar isso como prop booleana criaria um atraso de um render
 * entre a decisão e o áudio — e num overdub esse atraso vira desalinhamento.
 */
export type Transport = {
  play: () => Promise<void>;
  pause: () => void;
  seek: (t: number) => void;
};

type Props = {
  audioUrl: string | null;
  stems: Stem[];
  // Takes do usuário logado NESTA música. Nunca de terceiros — a rota que os
  // busca filtra por userId, e é isso que sustenta o modelo de camadas: a base
  // é compartilhável, a gravação da pessoa não viaja com ela.
  takes?: Take[];
  /** Recebe o controle de transporte assim que o motor fica pronto. */
  transportRef?: { current: Transport | null };
  isPro?: boolean;
  // Trilha-guia da banda: se definido e existir um stem com esse instrumento,
  // o player inicia com todas as outras trilhas mutadas (soft — o membro pode
  // reativar qualquer uma). Ver page.tsx / SongPlayer.
  soloInstrument?: string | null;
  songTitle: string;
  songArtist: string;
  onTimeUpdate?: (t: number) => void;
  onDurationReady?: (d: number) => void;
  // Velocidade e pitch são controlados pelo SongPlayer (controles ficam na
  // coluna direita). O player só LÊ esses valores pra o motor de áudio.
  speed?: number;
  pitch?: number;
  // Trecho a estudar (S1 / ADR-BTS-005): quando o integrante abre a música pela
  // atribuição do ensaio, o player já entra em loop A–B no pedaço combinado.
  // Em segundos; ignorado se end <= start. Ver page.tsx (?loop=início-fim).
  loopStart?: number | null;
  loopEnd?: number | null;
  // Mixagem do setlist já resolvida no servidor (S2 / ADR-BTS-005): estado e
  // volume por stem. Aplicada uma vez, quando o motor fica pronto — é soft,
  // como o pré-mute do ?solo=: o usuário mexe na mesa depois se quiser.
  initialMix?: { stemKey: string; state: string; volume: number }[] | null;
  // Analytics de produto: avisa o SongPlayer que o usuário mexeu na mesa
  // (mute, solo ou volume de faixa). Só sinaliza — quem grava é o SongPlayer.
  onMixerTouch?: () => void;
  // Analytics de produto: o usuário baixou áudio (mixagem ou faixas separadas).
  // Alimenta o evento "export" do log de atividade.
  onExport?: (kind: "mix" | "stems", count: number) => void;

  // ─── Cortes por faixa (apagar trecho pelo gráfico) ─────────────────────────
  // Trechos silenciados NA VERSÃO desta pessoa, por chave de faixa. Chegam da
  // configuração salva (user_songs.track_cuts) e voltam por `onCutsChange`, que
  // é quem persiste. O player não fala com a API: ele só toca e desenha.
  cuts?: TrackCuts;
  onCutsChange?: (next: TrackCuts) => void;
  /** Sem isto o arrasto na onda não seleciona nada — a onda só dá seek. */
  canCut?: boolean;
  /**
   * "Aplicar de vez": grava os cortes DENTRO do arquivo da gravação. Só existe
   * para faixa própria (take) — consolidar um stem do catálogo obrigaria a
   * duplicar o áudio por usuário, e o R2 guarda um arquivo por faixa, não um
   * por pessoa. Quem implementa o upload é o SongPlayer; aqui só entregamos o
   * buffer já decodificado, que é o que evita baixar o áudio de novo.
   */
  onApplyCuts?: (info: {
    takeId: number;
    key: string;
    buffer: AudioBuffer;
    cuts: Cut[];
    offsetSec: number;
  }) => Promise<void>;
  /**
   * A linha do tempo nasce das GRAVAÇÕES, não dos stems. É o modo dos projetos
   * em branco: não existe música por baixo, existe o que a pessoa gravou.
   */
  projectMode?: boolean;
};

// ─── Aparência por instrumento ────────────────────────────────────────────────
// "harmony" é o stem residual (tudo que não é bateria/baixo/vocal/guitarra —
// hoje predominantemente teclado/outros instrumentos). Precisa de ícone, cor
// e rótulo PRÓPRIOS e diferentes de "guitar", senão as duas faixas ficam
// visualmente idênticas na mesa de mixagem (foi exatamente o bug reportado:
// "2 guitarras" — era o stem de harmonia sendo forçado a se passar por guitarra).
const STEM_ICONS: Record<string, string> = {
  drums: "🥁", bass: "🎸", guitar: "🎸", harmony: "🎹", melody: "🎺", vocal: "🎤",
  // Gravação do próprio usuário (overdub). Microfone de estúdio, diferente do
  // 🎤 do stem de voz — na mesa as duas coisas aparecem lado a lado e precisam
  // ser distinguíveis de relance.
  take: "🎙️",
};
// Rótulo exibido por instrumento — por padrão usa o label do banco
// (`s.label`); só sobrescreve aqui se precisar de um nome fixo diferente.
// Chave de tradução por instrumento (ver messages/*.json → song.stems).
const STEM_LABEL_KEY: Record<string, string> = {
  vocal: "stems.vocals", drums: "stems.drums", bass: "stems.bass",
  guitar: "stems.guitar", harmony: "stems.piano", melody: "stems.other",
};
const STEM_COLORS: Record<string, string> = {
  vocal: "#3aa3ff", drums: "#7c5cff", bass: "#22d3b0",
  harmony: "#8b5cf6", melody: "#ea580c", guitar: "#f59e0b",
  take: "#ec4899",
};
const DEFAULT_COLOR = "#8a8a8c";

/**
 * Referências ESTÁVEIS para "nenhum corte".
 *
 * Não é preciosismo: o laço de posição chama `setCurrent` a cada quadro, então
 * o player re-renderiza 60 vezes por segundo. Um `?? []` escrito no meio do JSX
 * criaria um array novo a cada um desses renders, quebrando o `memo` da onda
 * (canvas redesenhado 60×/s por faixa) e a estabilidade da lista que vai para o
 * painel de download — que re-semearia a seleção em laço.
 */
const SEM_CORTES: TrackCuts = {};
const SEM_CORTES_LISTA: Cut[] = [];

// ─── Mixer no plano Free ─────────────────────────────────────────────────────
// Decisão de 2026-07-28: a landing sempre prometeu "Player com stems" no Free,
// e essa virou a promessa oficial (home, /planos e Termos alinhados). Portanto
// TODO mundo controla M/S de todos os canais — o que o Pro acrescenta é o
// EXPORT dos stems, pitch shift, loop A-B, PDF, setlists e Modo Performance.
// Para voltar a restringir, preencha este Set (vazio = tudo liberado).
const GUEST_UNLOCKED_INSTRUMENTS = new Set<string>();
const FREE_MIXER_UNLOCKED = true;

function colorFor(instrument: string) { return STEM_COLORS[instrument] ?? DEFAULT_COLOR; }
function iconFor(instrument: string) { return STEM_ICONS[instrument] ?? "🎵"; }

function formatTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

// ─── Peaks a partir de um AudioBuffer ─────────────────────────────────────────
// Reduz o buffer a `samples` picos normalizados (0..1) para desenhar a onda.
function computePeaks(buffer: AudioBuffer, samples: number): number[] {
  const ch = buffer.getChannelData(0);
  const block = Math.max(1, Math.floor(ch.length / samples));
  const peaks = new Array<number>(samples).fill(0);
  let max = 0;
  for (let i = 0; i < samples; i++) {
    let m = 0;
    const start = i * block;
    for (let j = 0; j < block; j++) {
      const v = Math.abs(ch[start + j] ?? 0);
      if (v > m) m = v;
    }
    peaks[i] = m;
    if (m > max) max = m;
  }
  if (max > 0) for (let i = 0; i < samples; i++) peaks[i] /= max;
  return peaks;
}

/**
 * Peaks de uma faixa POSICIONADA na linha do tempo da música.
 *
 * `computePeaks` espalha o arquivo inteiro pela largura toda, o que está certo
 * para stem (que tem a duração da música) e errado para gravação: um take de
 * 20 segundos era esticado ao longo de uma música de 2 minutos e parecia haver
 * áudio onde não há. Aqui cada barra corresponde a um instante da MÚSICA, e o
 * que está fora do trecho gravado fica em zero.
 *
 * O offset entra com o mesmo sinal do resto do módulo (ver `startAll`):
 * posição de leitura da faixa = posição da música + offset.
 */
function computePeaksInTimeline(
  buffer: AudioBuffer,
  samples: number,
  songDuration: number,
  offsetSec: number,
): number[] {
  const out = new Array<number>(samples).fill(0);
  if (songDuration <= 0 || samples <= 0) return out;

  const ch = buffer.getChannelData(0);
  const secPorBarra = songDuration / samples;
  const sr = buffer.sampleRate;
  let max = 0;

  for (let i = 0; i < samples; i++) {
    const tTake = i * secPorBarra + offsetSec;
    if (tTake < 0 || tTake >= buffer.duration) continue;

    const ini = Math.floor(tTake * sr);
    const fim = Math.min(ch.length, Math.floor((tTake + secPorBarra) * sr));
    let m = 0;
    for (let j = ini; j < fim; j++) {
      const v = Math.abs(ch[j]);
      if (v > m) m = v;
    }
    out[i] = m;
    if (m > max) max = m;
  }

  if (max > 0) for (let i = 0; i < samples; i++) out[i] /= max;
  return out;
}

// Combina vários arrays de peaks num só (média) — usado no modo mix.
function mergePeaks(list: number[][]): number[] {
  if (list.length === 0) return [];
  const n = list[0].length;
  const out = new Array<number>(n).fill(0);
  for (const p of list) for (let i = 0; i < n; i++) out[i] += p[i] ?? 0;
  let max = 0;
  for (let i = 0; i < n; i++) { out[i] /= list.length; if (out[i] > max) max = out[i]; }
  if (max > 0) for (let i = 0; i < n; i++) out[i] /= max;
  return out;
}

// ─── Onda em canvas ───────────────────────────────────────────────────────────
const WaveCanvas = memo(function WaveCanvas({
  peaks, color, height, dimmed, cuts, duration,
}: {
  peaks: number[]; color: string; height: number; dimmed: boolean;
  /** Trechos cortados, em segundos da música. Desenhados apagados, não sumidos:
   *  a pessoa precisa ver ONDE cortou para poder desfazer. */
  cuts?: Cut[];
  /** Duração da música — sem ela não há como mapear segundo → barra. */
  duration?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || peaks.length === 0) return;
    const W = 1000, H = height;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    const barW = W / peaks.length;
    const gap = barW > 3 ? 1 : 0;

    const dur = duration && duration > 0 ? duration : 0;
    const cortada = (i: number) => {
      if (!dur || !cuts || cuts.length === 0) return false;
      const t0 = (i / peaks.length) * dur;
      const t1 = ((i + 1) / peaks.length) * dur;
      return cuts.some(c => t1 > c.start && t0 < c.end);
    };

    for (let i = 0; i < peaks.length; i++) {
      const bh = Math.max(1, peaks[i] * (H - 2));
      const foi = cortada(i);
      // Barra cortada vira um traço fino na linha do meio: some o conteúdo (que
      // é o que o corte fez com o som) e fica a marca de que ali havia algo.
      ctx.fillStyle = foi ? "rgba(140,140,150,0.35)" : color;
      const h = foi ? Math.min(bh, 2) : bh;
      ctx.fillRect(i * barW, (H - h) / 2, Math.max(1, barW - gap), h);
    }

    // Faixa listrada por cima do trecho cortado — a marca que sobrevive mesmo
    // onde o áudio original já era silêncio e não havia barra para apagar.
    if (dur && cuts) {
      for (const c of cuts) {
        const x0 = Math.max(0, (c.start / dur) * W);
        const x1 = Math.min(W, (c.end / dur) * W);
        if (x1 <= x0) continue;
        ctx.fillStyle = "rgba(120,120,130,0.12)";
        ctx.fillRect(x0, 0, x1 - x0, H);
        ctx.strokeStyle = "rgba(150,150,160,0.5)";
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0 + 0.5, 0); ctx.lineTo(x0 + 0.5, H);
        ctx.moveTo(x1 - 0.5, 0); ctx.lineTo(x1 - 0.5, H);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [peaks, color, height, cuts, duration]);
  return (
    <canvas
      ref={ref}
      style={{ width: "100%", height, display: "block", opacity: dimmed ? 0.22 : 1, transition: "opacity 0.2s" }}
    />
  );
});

// ─── Tipos internos do motor ──────────────────────────────────────────────────
type ToneMod = typeof import("tone");
type Track = {
  key: string;
  instrument: string;
  label: string;
  audioUrl: string;
  // Só os takes preenchem. `takeId` marca a faixa como gravação do usuário —
  // é o que dá a ela o controle de ajuste fino e a distingue visualmente dos
  // stems, que são derivados da música.
  takeId?: number;
  offsetMs?: number;
  fileExt?: string;
  fx?: TakeFx | null;
};

/**
 * Liga `player → [efeitos] → volume`, desmontando a cadeia anterior.
 *
 * Trocar de efeito NÃO recarrega o áudio: o player e o buffer continuam os
 * mesmos, só o caminho entre eles muda. Sem essa separação, cada mudança de
 * preset baixaria e decodificaria a gravação de novo — e este é um controle
 * feito para experimentar.
 */
function aplicarFx(e: Engine, key: string, fx: TakeFx | null | undefined) {
  const player = e.players[key];
  // A cadeia termina no nó de CORTE, não no volume: o corte é o último elo
  // antes da mesa, e precisa silenciar também a cauda do reverb. Ligar o efeito
  // direto no volume faria o trecho cortado continuar soando com efeito.
  const vol = e.cutGains[key] ?? e.vols[key];
  if (!player || !vol) return;

  e.fx[key]?.forEach(n => { try { n.dispose(); } catch {} });
  delete e.fx[key];

  try { player.disconnect(); } catch {}

  if (fxVazio(fx)) {
    player.connect(vol);
    return;
  }

  const cadeia = montarFx(e.Tone, fx!);
  if (cadeia.length === 0) { player.connect(vol); return; }

  player.connect(cadeia[0]);
  for (let i = 0; i < cadeia.length - 1; i++) cadeia[i].connect(cadeia[i + 1]);
  cadeia[cadeia.length - 1].connect(vol);
  e.fx[key] = cadeia;
}

type Engine = {
  Tone: ToneMod;
  players: Record<string, import("tone").Player>;
  vols: Record<string, import("tone").Volume>;
  /**
   * Nó exclusivo do CORTE, entre a faixa (já com efeito) e o volume dela.
   *
   * Separado do volume de propósito: o volume é da mesa e a pessoa mexe nele o
   * tempo todo; o corte é automação agendada no tempo. Compartilhar o mesmo nó
   * faria um apagar o outro — mover o fader no meio de um trecho cortado
   * traria o áudio de volta, e o corte "não funcionaria" de forma intermitente.
   */
  cutGains: Record<string, import("tone").Gain>;
  /** Cortes ativos por faixa. Espelho do estado do React para uso no `startAll`. */
  cuts: Record<string, Cut[]>;
  master: import("tone").Volume;
  pitch: import("tone").PitchShift;
  duration: number;
  offset: number;      // posição de áudio (s) no último play/seek
  ctxStart: number;    // Tone.now() no último play
  playing: boolean;
  pitchActive: boolean;
  // Deslocamento por faixa, em SEGUNDOS. Zero para stems — eles nascem
  // alinhados com o mix. Só os takes do usuário usam isto, para compensar a
  // latência do navegador na gravação. Ver `startAll`.
  offsets: Record<string, number>;
  // Nós de efeito ativos por faixa, na ordem da cadeia. Guardados para poder
  // desmontar na troca de preset — nó de áudio não some sozinho, e deixar
  // reverb antigo pendurado vaza memória e soma o efeito duas vezes.
  fx: Record<string, import("tone").ToneAudioNode[]>;
  // Assinatura do efeito já montado por faixa ("hall:0.40"). Existe porque o
  // objeto `fx` chega novo a cada resposta da API mesmo quando nada mudou —
  // comparar por referência remontaria a cadeia à toa e cortaria o áudio.
  fxSig: Record<string, string>;
};

/**
 * Agenda o silêncio dos trechos cortados de UMA faixa.
 *
 * Automação no tempo, e não "pular o trecho": pular encurtaria a faixa e a
 * tiraria de sincronia com todas as outras, com a cifra e com a letra. Aqui a
 * linha do tempo continua intacta e o que muda é só o que se ouve.
 *
 * As bordas levam uma rampa de 5ms — corte seco no meio da onda estala.
 */
function agendarCortes(e: Engine, key: string, at: number, pos: number, rate: number) {
  const g = e.cutGains[key];
  if (!g) return;

  const cortes = e.cuts[key] ?? [];
  const param = g.gain;

  // Limpa o que ficou agendado da última âncora (play/seek/loop anteriores),
  // senão a automação antiga continua valendo e a faixa muda sozinha.
  try { param.cancelScheduledValues(at); } catch {}

  if (cortes.length === 0) {
    param.setValueAtTime(1, at);
    return;
  }

  const RAMPA = 0.005;
  // Começar já dentro de um corte é comum: a pessoa dá play em cima do trecho.
  param.setValueAtTime(cortes.some(c => pos >= c.start && pos < c.end) ? 0 : 1, at);

  for (const c of cortes) {
    // Da posição da música para o relógio do áudio: o que está no futuro entra
    // proporcional à velocidade de reprodução.
    const entra = at + (c.start - pos) / rate;
    const sai = at + (c.end - pos) / rate;
    if (sai <= at) continue; // corte já passou

    if (entra > at + RAMPA) {
      param.setValueAtTime(1, entra - RAMPA);
      param.linearRampToValueAtTime(0, entra);
    }
    param.setValueAtTime(0, Math.max(sai - RAMPA, at));
    param.linearRampToValueAtTime(1, Math.max(sai, at + RAMPA));
  }
}

/**
 * Dá start em TODAS as faixas na mesma âncora de tempo, respeitando o
 * deslocamento de cada uma.
 *
 * Isto existia copiado em quatro lugares (play, seek e duas voltas de loop no
 * laço de animação). Além da duplicação, era o motivo de o offset por faixa ser
 * inviável: qualquer compensação teria que ser lembrada nos quatro.
 *
 * Convenção do offset — a mesma do banco e da UI de ajuste:
 *   posição de leitura da faixa = posição da música + offset
 * Positivo = a faixa foi gravada atrasada, então adianta a leitura dela.
 *
 * Quando a leitura cai antes do início do arquivo (offset negativo no começo
 * da música), não dá para ler tempo negativo — então a faixa espera e entra
 * mais tarde, que é o mesmo efeito no ouvido.
 */
function startAll(e: Engine, at: number, pos: number, rate: number) {
  for (const [key, p] of Object.entries(e.players)) {
    p.playbackRate = rate;
    try { p.stop(); } catch {}

    // O corte é agendado mesmo para faixa que não vai dar start (take mais
    // curto que a música, por exemplo): o nó precisa voltar a 1 de qualquer
    // jeito, senão fica preso em 0 desde a última passagem por um corte.
    agendarCortes(e, key, at, pos, rate);

    const local = pos + (e.offsets[key] ?? 0);
    const buf = p.buffer?.duration ?? 0;

    // Já passou do fim daquele arquivo: não dá start. Sem esta guarda o Tone
    // reclama de offset além do buffer — acontece com take mais curto que a
    // música, que é o caso comum (a pessoa grava só o refrão).
    if (buf > 0 && local >= buf) continue;

    if (local >= 0) p.start(at, local);
    else p.start(at - local, 0);
  }
}

export default function WavePlayer({
  audioUrl, stems, takes = [], transportRef, isPro = false, soloInstrument = null, songTitle, songArtist, onTimeUpdate, onDurationReady, speed = 1, pitch = 0,
  loopStart = null, loopEnd = null, initialMix = null, onMixerTouch, onExport,
  cuts = SEM_CORTES, onCutsChange, canCut = false, onApplyCuts, projectMode = false,
}: Props) {
  // `tx` e não `t`: dentro do mixer `t` já é a faixa sendo mapeada.
  const tx = useTranslations("song");

  // Faixas de áudio a carregar. Com stems, cada stem é uma faixa; senão, o mix.
  // Os takes do usuário entram DEPOIS, como faixas normais — é o que o motor
  // Tone.js já faz de graça: mais um player no mesmo relógio, com sincronia de
  // amostra. Era por isso que o overdub encaixava barato.
  const tracks: Track[] = useMemo(() => {
    const base: Track[] =
      stems.length > 0
        ? stems.map(s => ({
            key: s.instrument,
            instrument: s.instrument,
            // Rótulo traduzido quando o instrumento é conhecido; senão cai no que
            // veio do banco. O VALOR (s.instrument) nunca muda de idioma.
            label: STEM_LABEL_KEY[s.instrument] ? tx(STEM_LABEL_KEY[s.instrument]) : (s.label ?? s.instrument),
            audioUrl: s.audioUrl,
          }))
        : audioUrl
          ? [{ key: "mix", instrument: "mix", label: songTitle, audioUrl }]
          : [];

    // Sem base e sem projeto não há linha do tempo em que pendurar gravação —
    // é o caso da música cujo áudio ainda não subiu. Em projeto em branco é o
    // contrário: as gravações SÃO a música, e sem elas não há nada mesmo.
    if (base.length === 0 && !projectMode) return base;

    // Prefixo "take:" evita colisão com nome de instrumento — sem ele, um take
    // chamado "bass" derrubaria o stem de baixo do mapa de players.
    return base.concat(
      takes.map(t => ({
        key: `take:${t.id}`,
        instrument: "take",
        label: t.name,
        audioUrl: t.audioUrl,
        takeId: t.id,
        offsetMs: t.offsetMs,
        fileExt: t.ext,
        fx: t.fx ?? null,
      })),
      // A dependência é o CONTEÚDO do fx, não a referência: a API devolve
      // objeto novo a cada resposta, e comparar por referência recriaria
      // `tracks` — e com ele o `trackSig` — recarregando todo o áudio a cada
      // clique no seletor de efeito.
    );
  }, [stems, takes, audioUrl, songTitle, tx, projectMode]);

  // Multitrack aparece pra qualquer um com stems, inclusive visitante sem
  // cadastro (efeito de divulgação: vê a mesa, ouve o mix completo). O que
  // isPro passa a controlar é QUAIS canais podem ser mutados/solados dentro
  // dela — ver `canControlTrack` — não a visão em si.
  //
  // No projeto em branco não há stem nenhum, e mesmo assim a mesa é o ponto:
  // é ali que as faixas gravadas aparecem uma sobre a outra.
  const showMultitrack = stems.length > 0 || (projectMode && tracks.length > 0);
  const hasAudio = tracks.length > 0;

  /**
   * Assinatura do CONJUNTO DE ÁUDIO carregado — só as URLs, não o resto.
   *
   * É o que dispara a recarga do motor. Sem isso, ajustar o offset de um take
   * mudaria a identidade de `tracks` e faria o player baixar e decodificar
   * tudo de novo a cada clique no ajuste fino — justamente o controle que a
   * pessoa vai mexer dezenas de vezes até o take encaixar. Offset é aplicado
   * quente, no efeito logo abaixo do carregamento.
   */
  const trackSig = useMemo(
    () => tracks.map(t => `${t.key}|${t.audioUrl}`).join("\n"),
    [tracks],
  );

  const engineRef = useRef<Engine | null>(null);
  const rafRef = useRef<number | null>(null);

  const [ready,     setReady]     = useState(false);
  const [playing,   setPlaying]   = useState(false);
  const [current,   setCurrent]   = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [volume,    setVolume]    = useState(0.85);
  // speed/pitch agora vêm por prop (controlados pelo SongPlayer / coluna direita).
  const [trackVol,  setTrackVol]  = useState<Record<string, number>>({});
  const [muted,     setMuted]     = useState<Record<string, boolean>>({});
  const [soloed,    setSoloed]    = useState<Record<string, boolean>>({});
  const [peaks,     setPeaks]     = useState<Record<string, number[]>>({});
  const [mixPeaks,  setMixPeaks]  = useState<number[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey,  setRetryKey]  = useState(0);
  const [loop,      setLoop]      = useState(false); // repetir a música até parar

  // Trecho a estudar (loop A–B). Nasce do deep link da atribuição do ensaio e
  // pode ser dispensado com um clique — o músico costuma querer ouvir a música
  // inteira depois de fechar o pedaço difícil.
  const validRegion =
    loopStart != null && loopEnd != null && loopEnd > loopStart
      ? { start: Math.max(0, loopStart), end: loopEnd }
      : null;
  const [region, setRegion] = useState<{ start: number; end: number } | null>(validRegion);

  // Refs espelho para uso dentro do loop de animação / callbacks
  const speedRef  = useRef(speed);   useEffect(() => { speedRef.current = speed; }, [speed]);
  const durRef    = useRef(0);       useEffect(() => { durRef.current = duration; }, [duration]);
  const loopRef   = useRef(false);   useEffect(() => { loopRef.current = loop; }, [loop]);
  const regionRef = useRef(region);  useEffect(() => { regionRef.current = region; }, [region]);
  const cutsRef   = useRef<TrackCuts>(cuts); useEffect(() => { cutsRef.current = cuts; }, [cuts]);

  const posNow = useCallback(() => {
    const e = engineRef.current;
    if (!e) return 0;
    return e.playing ? e.offset + (e.Tone.now() - e.ctxStart) * speedRef.current : e.offset;
  }, []);

  // ── Carga do motor Tone.js ──────────────────────────────────────────────────
  useEffect(() => {
    if (!hasAudio) return;
    let destroyed = false;
    setReady(false);
    setLoadError(null);

    (async () => {
      const Tone = await import("tone");
      if (destroyed) return;

      const master = new Tone.Volume(Tone.gainToDb(0.85));
      const pitchNode = new Tone.PitchShift({ pitch: 0, windowSize: 0.1 });
      master.toDestination(); // pitch começa bypassado (0 st)

      const players: Record<string, import("tone").Player> = {};
      const vols: Record<string, import("tone").Volume> = {};
      const cutGains: Record<string, import("tone").Gain> = {};
      let failed = false;

      await Promise.all(tracks.map(t => new Promise<void>(resolve => {
        const vol = new Tone.Volume(0);
        vol.connect(master);
        vols[t.key] = vol;
        // faixa → [efeito] → corte → volume → master. O corte fica DEPOIS do
        // efeito para silenciar também a cauda dele, e ANTES do volume para não
        // brigar com o fader da mesa. Ver Engine.cutGains.
        const cut = new Tone.Gain(1);
        cut.connect(vol);
        cutGains[t.key] = cut;
        const player = new Tone.Player({
          url: t.audioUrl,
          onload: () => resolve(),
          onerror: () => { failed = true; resolve(); },
        });
        player.connect(cut);
        players[t.key] = player;
      })));

      if (destroyed) { Object.values(players).forEach(p => p.dispose()); return; }
      if (failed) { setLoadError(tx("loadError")); return; }

      // Duração + peaks.
      // A duração vem SÓ das faixas da música. Um take não estica a linha do
      // tempo: se a pessoa deixou o microfone aberto meio minuto a mais depois
      // do fim, a música não passa a ter meio minuto de silêncio no fim.
      let dur = 0;
      const pk: Record<string, number[]> = {};
      const res = showMultitrack ? 240 : 500;

      // Duas passadas: a duração da música precisa estar fechada ANTES de
      // desenhar as gravações, porque elas são posicionadas nessa linha do
      // tempo. Numa passada só, a primeira gravação seria desenhada contra uma
      // duração ainda incompleta.
      for (const t of tracks) {
        if (t.takeId != null) continue;
        const buf = players[t.key].buffer.get() as AudioBuffer | undefined;
        if (buf) {
          dur = Math.max(dur, buf.duration);
          pk[t.key] = computePeaks(buf, res);
        }
      }

      // Projeto em branco: não existe música por baixo, então a linha do tempo
      // é a gravação mais longa. Sem esta passada a duração ficaria em zero e
      // nada seria desenhado — o projeto pareceria vazio mesmo cheio de faixas.
      if (dur === 0 && projectMode) {
        for (const t of tracks) {
          const buf = players[t.key].buffer.get() as AudioBuffer | undefined;
          if (buf) dur = Math.max(dur, buf.duration - (t.offsetMs ?? 0) / 1000);
        }
      }

      for (const t of tracks) {
        if (t.takeId == null) continue;
        const buf = players[t.key].buffer.get() as AudioBuffer | undefined;
        if (buf) pk[t.key] = computePeaksInTimeline(buf, res, dur, (t.offsetMs ?? 0) / 1000);
      }

      // Com trecho a estudar, a agulha já nasce no início do pedaço.
      const reg = regionRef.current;
      const startOffset = reg && reg.start < dur ? reg.start : 0;

      engineRef.current = {
        Tone, players, vols, cutGains, master, pitch: pitchNode,
        duration: dur, offset: startOffset, ctxStart: 0, playing: false, pitchActive: false,
        offsets: Object.fromEntries(tracks.map(t => [t.key, (t.offsetMs ?? 0) / 1000])),
        // Os cortes salvos já entram aqui: quem abre a música de novo tem de
        // ouvir exatamente o que ouvia quando fechou.
        cuts: { ...cutsRef.current },
        fx: {},
        fxSig: {},
      };

      // Efeitos gravados na configuração entram já no carregamento — quem
      // salvou reverb na voz espera ouvir reverb ao abrir a música de novo.
      for (const t of tracks) {
        if (t.takeId == null) continue;
        const assinatura = fxVazio(t.fx) ? "" : `${t.fx!.preset}:${t.fx!.mix.toFixed(2)}`;
        if (assinatura) aplicarFx(engineRef.current, t.key, t.fx);
        engineRef.current.fxSig[t.key] = assinatura;
      }
      if (startOffset > 0) { setCurrent(startOffset); onTimeUpdate?.(startOffset); }
      setPeaks(pk);
      // A onda única do modo mix representa A MÚSICA — gravação do usuário não
      // entra nela (e nem existe nesse modo, que só aparece sem stems).
      setMixPeaks(
        mergePeaks(tracks.filter(t => t.takeId == null).map(t => pk[t.key]).filter(Boolean)),
      );
      setDuration(dur);
      setReady(true);
      onDurationReady?.(dur);
    })();

    return () => {
      destroyed = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const e = engineRef.current;
      if (e) {
        Object.values(e.players).forEach(p => { try { p.stop(); } catch {} p.dispose(); });
        Object.values(e.fx).forEach(cadeia => cadeia.forEach(n => { try { n.dispose(); } catch {} }));
        Object.values(e.cutGains).forEach(g => { try { g.dispose(); } catch {} });
        Object.values(e.vols).forEach(v => v.dispose());
        e.master.dispose();
        e.pitch.dispose();
      }
      engineRef.current = null;
    };
    // `tracks` é lido dentro, mas quem dispara é `trackSig` — ver o comentário
    // na definição dele. Os dois mudam juntos quando o áudio muda de verdade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackSig, retryKey]);

  // ── Offset por faixa, aplicado a quente ───────────────────────────────────
  // Ajuste fino do take: atualiza o mapa do motor e, se estiver tocando,
  // re-ancora as faixas na posição atual para o efeito ser ouvido na hora. Sem
  // o re-ancoramento a pessoa mexeria no controle e não ouviria diferença até
  // dar pause e play — e concluiria que o ajuste não funciona.
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;

    // Efeito é trocado sem tocar no áudio: só o caminho entre o player e o
    // volume muda. Comparação por conteúdo porque `fx` chega como objeto novo
    // a cada resposta da API, mesmo quando o preset é o mesmo.
    for (const t of tracks) {
      if (t.takeId == null) continue;
      const assinatura = fxVazio(t.fx) ? "" : `${t.fx!.preset}:${t.fx!.mix.toFixed(2)}`;
      if (e.fxSig[t.key] === assinatura) continue;
      aplicarFx(e, t.key, t.fx);
      e.fxSig[t.key] = assinatura;
    }

    let mudou = false;
    for (const t of tracks) {
      const v = (t.offsetMs ?? 0) / 1000;
      if (e.offsets[t.key] !== v) { e.offsets[t.key] = v; mudou = true; }
    }
    if (!mudou || !e.playing) return;

    const pos = posNow();
    const at = e.Tone.now() + 0.05;
    startAll(e, at, pos, speedRef.current);
    e.offset = pos;
    e.ctxStart = at;
  }, [tracks, ready, posNow]);

  // ── Cortes aplicados a quente ─────────────────────────────────────────────
  // Cortar é uma ação sobre o que se está OUVINDO: a pessoa marca o trecho com
  // a música tocando e espera o silêncio na hora. Re-ancorar as faixas na
  // posição atual reagenda a automação sem interromper a reprodução — sem isso
  // o corte só valeria no próximo play, e pareceria que o botão não funcionou.
  const cutsSig = useMemo(() => JSON.stringify(cuts), [cuts]);
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    e.cuts = { ...cutsRef.current };

    const pos = posNow();
    const at = e.Tone.now() + 0.03;
    if (e.playing) {
      startAll(e, at, pos, speedRef.current);
      e.offset = pos;
      e.ctxStart = at;
    } else {
      // Parado, basta devolver cada nó ao estado que o próximo play espera —
      // senão uma faixa que ficou muda dentro de um corte apagado continuaria
      // muda até alguém tocar de novo.
      for (const key of Object.keys(e.cutGains)) agendarCortes(e, key, at, pos, speedRef.current);
    }
  }, [cutsSig, ready, posNow]);

  // ── Loop de posição ───────────────────────────────────────────────────────
  const startRaf = useCallback(() => {
    const tick = () => {
      const e = engineRef.current;
      if (!e) return;
      const pos = posNow();

      // Trecho a estudar: volta ao início do pedaço em vez de seguir a música.
      const reg = regionRef.current;
      if (reg && pos >= reg.end) {
        e.offset = reg.start;
        const at = e.Tone.now() + 0.02;
        startAll(e, at, reg.start, speedRef.current);
        e.ctxStart = at;
        setCurrent(reg.start); onTimeUpdate?.(reg.start);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (pos >= durRef.current && durRef.current > 0) {
        if (loopRef.current) {
          // Repetir: reinicia do zero sem parar (o scroll Automático volta ao topo sozinho).
          e.offset = 0;
          const at = e.Tone.now() + 0.02;
          startAll(e, at, 0, speedRef.current);
          e.ctxStart = at;
          setCurrent(0); onTimeUpdate?.(0);
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        // fim: para e volta ao início
        Object.values(e.players).forEach(p => { try { p.stop(); } catch {} });
        e.playing = false; e.offset = 0;
        setPlaying(false); setCurrent(0); onTimeUpdate?.(0);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        return;
      }
      setCurrent(pos);
      onTimeUpdate?.(pos);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [posNow, onTimeUpdate]);

  // ── Pitch/velocidade → nó PitchShift ──────────────────────────────────────
  // playbackRate r desloca o tom em +12·log2(r); compensamos para manter o tom.
  const applyPitch = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    const effective = pitch - 12 * Math.log2(speed);
    e.pitch.pitch = effective;
    const shouldBeActive = Math.abs(effective) > 0.01;
    if (shouldBeActive && !e.pitchActive) {
      e.master.disconnect();
      e.master.connect(e.pitch);
      e.pitch.toDestination();
      e.pitchActive = true;
    } else if (!shouldBeActive && e.pitchActive) {
      e.master.disconnect();
      e.pitch.disconnect();
      e.master.toDestination();
      e.pitchActive = false;
    }
  }, [pitch, speed]);

  useEffect(() => { applyPitch(); }, [applyPitch]);

  // ── Transporte ────────────────────────────────────────────────────────────
  const play = useCallback(async () => {
    const e = engineRef.current;
    if (!e) return;
    await e.Tone.start();
    const at = e.Tone.now() + 0.05;
    startAll(e, at, e.offset, speedRef.current);
    e.ctxStart = at;
    e.playing = true;
    setPlaying(true);
    startRaf();
  }, [startRaf]);

  const pause = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    e.offset = posNow();
    Object.values(e.players).forEach(p => { try { p.stop(); } catch {} });
    e.playing = false;
    setPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [posNow]);

  const togglePlay = useCallback(() => {
    if (!engineRef.current) return;
    if (engineRef.current.playing) pause(); else play();
  }, [play, pause]);

  const seek = useCallback((t: number) => {
    const e = engineRef.current;
    if (!e) return;
    const clamped = Math.max(0, Math.min(t, e.duration));
    const wasPlaying = e.playing;
    Object.values(e.players).forEach(p => { try { p.stop(); } catch {} });
    e.offset = clamped;
    setCurrent(clamped);
    onTimeUpdate?.(clamped);
    if (wasPlaying) {
      const at = e.Tone.now() + 0.05;
      startAll(e, at, clamped, speedRef.current);
      e.ctxStart = at;
    }
  }, [onTimeUpdate]);

  // Re-ancora a velocidade sem cortar o áudio.
  useEffect(() => {
    const e = engineRef.current;
    if (!e) { applyPitch(); return; }
    if (e.playing) {
      e.offset = posNow();
      const at = e.Tone.now() + 0.05;
      // `startAll` e não um p.start() por faixa: é ele que respeita o offset de
      // cada gravação e reagenda os cortes na velocidade nova. Mudar o
      // andamento com um laço solto aqui desalinhava o take e ressuscitava o
      // trecho cortado.
      startAll(e, at, e.offset, speed);
      e.ctxStart = at;
    } else {
      Object.values(e.players).forEach(p => { p.playbackRate = speed; });
    }
    applyPitch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  // ── Volumes / mute / solo ─────────────────────────────────────────────────
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    e.master.volume.value = e.Tone.gainToDb(volume);
  }, [volume, ready]);

  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    const anySolo = Object.values(soloed).some(Boolean);
    for (const t of tracks) {
      const v = e.vols[t.key];
      if (!v) continue;
      const on = anySolo ? !!soloed[t.key] : !muted[t.key];
      const g = trackVol[t.key] ?? 1;
      v.volume.value = on ? e.Tone.gainToDb(Math.max(0.0001, g)) : -Infinity;
    }
  }, [muted, soloed, trackVol, tracks, ready]);

  // ── Trilha-guia da banda (pré-mute) ───────────────────────────────────────
  // Quando o player abre via setlist da banda com ?solo=<instrumento>, muta
  // todas as trilhas exceto a do integrante — uma única vez, quando fica pronto.
  // É soft: o membro pode reativar qualquer trilha na mesa depois.
  const soloAppliedRef = useRef(false);
  useEffect(() => {
    if (soloAppliedRef.current) return;
    if (!ready || !soloInstrument) return;
    const hasTrack = tracks.some(t => t.key === soloInstrument);
    if (!hasTrack) return;
    setMuted(Object.fromEntries(tracks.filter(t => t.key !== soloInstrument).map(t => [t.key, true])));
    soloAppliedRef.current = true;
  }, [ready, soloInstrument, tracks]);

  // ── Mixagem do setlist (S2) ───────────────────────────────────────────────
  // Aplica mudo, solo e volume que vieram resolvidos do servidor. Uma vez só,
  // ao ficar pronto — depois a mesa é do usuário. Não roda junto com o
  // ?solo= (modo "ouvir como é"), que já define o estado das trilhas.
  const mixAppliedRef = useRef(false);
  useEffect(() => {
    if (mixAppliedRef.current) return;
    if (!ready || !initialMix || initialMix.length === 0 || soloInstrument) return;

    const known = new Set(tracks.map(t => t.key));
    const nextMuted: Record<string, boolean> = {};
    const nextSoloed: Record<string, boolean> = {};
    const nextVol: Record<string, number> = {};

    for (const m of initialMix) {
      if (!known.has(m.stemKey)) continue;
      if (m.state === "mute") nextMuted[m.stemKey] = true;
      if (m.state === "solo") nextSoloed[m.stemKey] = true;
      if (m.volume !== 100) nextVol[m.stemKey] = Math.max(0, Math.min(100, m.volume)) / 100;
    }

    if (Object.keys(nextMuted).length) setMuted(nextMuted);
    if (Object.keys(nextSoloed).length) setSoloed(nextSoloed);
    if (Object.keys(nextVol).length) setTrackVol(prev => ({ ...prev, ...nextVol }));
    mixAppliedRef.current = true;
  }, [ready, initialMix, soloInstrument, tracks]);

  // ── Atalho espaço ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      if (ev.code === "Space") { ev.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay]);

  // Mixer liberado para todos (ver FREE_MIXER_UNLOCKED no topo). O Set continua
  // sendo consultado para o caso de voltarmos a liberar só alguns canais.
  const canControlTrack = useCallback(
    (instrument: string) =>
      isPro || FREE_MIXER_UNLOCKED || GUEST_UNLOCKED_INSTRUMENTS.has(instrument),
    [isPro]
  );

  // M e S são mutuamente exclusivos por faixa: ligar um desliga o outro.
  // Guarda de novo aqui (além do `disabled` no botão) pra não depender só da UI.
  const toggleMute = (k: string) => {
    const t = tracks.find(tr => tr.key === k);
    if (t && !canControlTrack(t.instrument)) return;
    onMixerTouch?.();
    setMuted(p => ({ ...p, [k]: !p[k] }));
    setSoloed(p => (p[k] ? { ...p, [k]: false } : p));
  };
  const toggleSolo = (k: string) => {
    const t = tracks.find(tr => tr.key === k);
    if (t && !canControlTrack(t.instrument)) return;
    onMixerTouch?.();
    setSoloed(p => ({ ...p, [k]: !p[k] }));
    setMuted(p => (p[k] ? { ...p, [k]: false } : p));
  };

  // Publica o transporte para quem comanda o player de fora (painel de
  // gravação). Limpa na saída para o painel não segurar um motor já destruído.
  useEffect(() => {
    if (!transportRef) return;
    transportRef.current = { play, pause, seek };
    return () => { transportRef.current = null; };
  }, [transportRef, play, pause, seek]);

  const pct = duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;
  const anySolo = Object.values(soloed).some(Boolean);

  // ── Download (Pro) ────────────────────────────────────────────────────────
  // O painel reaproveita os buffers que o motor já decodificou pra tocar: nada
  // é baixado de novo pra gerar a mixagem. Ver DownloadPanel/exportAudio.
  const getBuffer = useCallback((key: string): AudioBuffer | null => {
    const e = engineRef.current;
    if (!e) return null;
    return (e.players[key]?.buffer.get() as AudioBuffer | undefined) ?? null;
  }, []);

  // Espelha a regra de audibilidade da mesa (mesma linha da UI das faixas):
  // com algum solo ligado vale o solo; sem solo, vale o mudo. Canal travado
  // toca sempre — mas quem não é Pro nem vê o painel, então não muda nada aqui.
  const audible = useMemo(() => {
    const solos = Object.values(soloed).some(Boolean);
    return Object.fromEntries(
      tracks.map((t) => [t.key, solos ? !!soloed[t.key] : !muted[t.key]]),
    );
  }, [tracks, soloed, muted]);

  /**
   * As faixas do painel de download vão com os cortes junto: o arquivo baixado
   * precisa soar como o que se ouve aqui. Sem isso o trecho apagado
   * ressuscitaria no download, e a pessoa só descobriria depois de mandar o
   * arquivo para a banda.
   *
   * Memoizado porque o painel re-semeia a seleção de faixas quando a lista
   * muda de identidade — um array novo a cada quadro do laço de posição faria
   * essa semeadura virar laço infinito.
   */
  const tracksParaDownload = useMemo(
    () => tracks.map(t => (cuts[t.key]?.length ? { ...t, cuts: cuts[t.key] } : t)),
    // `cutsSig` e não `cuts`: é o conteúdo que importa. Ver o efeito de cortes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tracks, cutsSig],
  );

  // Pula `delta` segundos a partir da posição atual (avançar/voltar).
  const skip = (delta: number) => seek(posNow() + delta);

  const proGate = (label: string) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
      background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
      borderRadius: 8, fontSize: 13, color: "var(--muted)",
    }}>
      <span className="pro-badge">PRO</span>
      <span>{tx("proFeatureIn", { label })}</span>
      <a href="/planos" style={{ color: "var(--accent)", fontWeight: 700, marginLeft: "auto" }}>{tx("tryFree")}</a>
    </div>
  );

  // Clique-para-seek numa área de onda.
  const onWaveClick = (ev: React.MouseEvent<HTMLDivElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const frac = (ev.clientX - rect.left) / rect.width;
    seek(frac * duration);
  };

  // ── Selecionar o trecho a apagar, na própria onda ──────────────────────────
  //
  // A onda de cada faixa acumula dois gestos: clique curto continua sendo seek
  // (é o que todo player faz, e tirar isso quebraria o hábito), arrasto vira
  // seleção. O que separa os dois é a distância percorrida — abaixo de 5px é
  // tremida de mão, não intenção de arrastar.
  //
  // Só quando `canCut`: quem não pegou a música para a sua área não tem onde
  // guardar corte nenhum, e uma seleção que não vira nada é pior que nada.
  const [sel, setSel] = useState<{ key: string; start: number; end: number } | null>(null);
  const dragRef = useRef<{ key: string; rect: DOMRect; x0: number; moved: boolean } | null>(null);
  const [aplicando, setAplicando] = useState<string | null>(null);
  const [erroCorte, setErroCorte] = useState<string | null>(null);

  const fracDe = (clientX: number, rect: DOMRect) =>
    Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

  const onWavePointerDown = (ev: React.PointerEvent<HTMLDivElement>, key: string) => {
    if (!canCut || !ready || duration <= 0) return;
    dragRef.current = {
      key,
      rect: ev.currentTarget.getBoundingClientRect(),
      x0: ev.clientX,
      moved: false,
    };
    // Captura o ponteiro para o arrasto continuar valendo se o cursor sair da
    // faixa — o gesto natural para marcar um trecho passa por cima das outras.
    try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch {}
  };

  const onWavePointerMove = (ev: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    if (!d.moved && Math.abs(ev.clientX - d.x0) < 5) return;
    d.moved = true;
    const a = fracDe(d.x0, d.rect) * duration;
    const b = fracDe(ev.clientX, d.rect) * duration;
    setSel({ key: d.key, start: Math.min(a, b), end: Math.max(a, b) });
  };

  const onWavePointerUp = (ev: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    try { ev.currentTarget.releasePointerCapture(ev.pointerId); } catch {}
    if (d.moved) return; // a seleção fica na tela esperando o botão
    setSel(null);
    seek(fracDe(ev.clientX, d.rect) * duration);
  };

  /** Junta a seleção aos cortes da faixa e devolve o mapa novo para o pai salvar. */
  const cortarSelecao = useCallback(() => {
    if (!sel || !onCutsChange) return;
    const atuais = cuts[sel.key] ?? [];
    // `normalizeCuts` é a MESMA função que a rota usa: funde sobreposição e
    // ordena, então cortar duas vezes o mesmo trecho não empilha duplicata.
    const proximos = normalizeCuts([...atuais, { start: sel.start, end: sel.end }]);
    onCutsChange({ ...cuts, [sel.key]: proximos });
    setSel(null);
  }, [sel, cuts, onCutsChange]);

  const removerCorte = useCallback((key: string, i: number) => {
    if (!onCutsChange) return;
    const restantes = (cuts[key] ?? []).filter((_, idx) => idx !== i);
    const proximos = { ...cuts };
    if (restantes.length) proximos[key] = restantes;
    else delete proximos[key];
    onCutsChange(proximos);
  }, [cuts, onCutsChange]);

  const limparCortes = useCallback((key: string) => {
    if (!onCutsChange) return;
    const proximos = { ...cuts };
    delete proximos[key];
    onCutsChange(proximos);
  }, [cuts, onCutsChange]);

  /**
   * "Aplicar de vez" — grava os cortes dentro do arquivo da gravação.
   *
   * Irreversível, e por isso pede confirmação: a partir daqui não é mais
   * configuração da sua versão, é o áudio. Só aparece em faixa própria (take);
   * stem do catálogo é o mesmo arquivo para todo mundo.
   */
  const aplicarNoArquivo = useCallback(async (t: Track) => {
    if (!onApplyCuts || t.takeId == null) return;
    const lista = cuts[t.key] ?? [];
    if (lista.length === 0) return;
    if (!confirm(tx("cutApplyConfirm", { label: t.label }))) return;

    const buffer = getBuffer(t.key);
    if (!buffer) { setErroCorte(tx("cutApplyError")); return; }

    setErroCorte(null);
    setAplicando(t.key);
    try {
      await onApplyCuts({
        takeId: t.takeId,
        key: t.key,
        buffer,
        cuts: lista,
        offsetSec: (t.offsetMs ?? 0) / 1000,
      });
    } catch (err) {
      console.error("[corte] falha ao aplicar no arquivo", err);
      setErroCorte(tx("cutApplyError"));
    } finally {
      setAplicando(null);
    }
  }, [onApplyCuts, cuts, getBuffer, tx]);

  const PlayButton = (
    <button onClick={togglePlay} disabled={!ready && hasAudio}
      style={{
        width: 42, height: 42, borderRadius: "50%",
        background: ready || !hasAudio ? "var(--accent)" : "var(--surface3)",
        color: "#000", border: "none", fontSize: 17, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
      title={tx("space")}
    >
      {!ready && hasAudio ? "..." : playing ? "❚❚" : "▶"}
    </button>
  );

  const LoopButton = (
    <button onClick={() => setLoop(v => !v)} disabled={!ready} aria-label={tx("repeat")} title={tx("repeatTitle")}
      style={{
        width: 34, height: 34, borderRadius: "50%",
        background: loop ? "var(--accent)" : "var(--surface2)",
        border: `1px solid ${loop ? "var(--accent)" : "var(--border2)"}`,
        color: loop ? "#000" : (ready ? "var(--text)" : "var(--muted2)"),
        fontSize: 14, fontWeight: 700, cursor: ready ? "pointer" : "default",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      🔁
    </button>
  );

  const skipBtn = (delta: number, label: string, aria: string) => (
    <button onClick={() => skip(delta)} disabled={!ready} aria-label={aria} title={aria}
      style={{
        width: 34, height: 34, borderRadius: "50%",
        background: "var(--surface2)", border: "1px solid var(--border2)",
        color: ready ? "var(--text)" : "var(--muted2)", fontSize: 12, fontWeight: 700,
        cursor: ready ? "pointer" : "default",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ─── Painel principal ─── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>

        {/* Estados especiais */}
        {!hasAudio ? (
          <div style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14 }}>
            {tx("noTrack")}
          </div>
        ) : loadError ? (
          <div style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--danger)", fontSize: 13 }}>
            <span>⚠ {loadError}</span>
            <button onClick={() => setRetryKey(k => k + 1)}
              style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer", color: "var(--text)", fontWeight: 600 }}>
              {tx("retry")}
            </button>
          </div>
        ) : showMultitrack ? (
          /* ─── Modo multitrack (Moises) ─── */
          <>
            {/* Barra de transporte */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              {skipBtn(-10, "«", tx("skipBack"))}
              {PlayButton}
              {skipBtn(10, "»", tx("skipForward"))}
              {LoopButton}
              <span style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--font-mono, monospace)", minWidth: 92 }}>
                {formatTime(current)} / {formatTime(duration)}
              </span>
              {region && (
                <button
                  onClick={() => setRegion(null)}
                  title={tx("playWhole")}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px",
                    borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: "rgba(255,154,0,0.12)", border: "1px solid rgba(255,154,0,0.35)",
                    color: "var(--accent)", whiteSpace: "nowrap",
                  }}
                >
                  {tx("regionExit", { start: formatTime(region.start), end: formatTime(region.end) })}
                </button>
              )}
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>Volume Master</span>
                <input type="range" min={0} max={1} step={0.05} value={volume}
                  onChange={e => setVolume(Number(e.target.value))} style={{ width: 84 }} aria-label="Volume Master" />
              </div>
            </div>

            {/* Faixas + playhead — rola horizontalmente em telas estreitas (.mixer-tracks) */}
            <div className="mixer-tracks" style={{ position: "relative" }}>
              {tracks.map(t => {
                const locked = !canControlTrack(t.instrument);
                // Canal travado nunca é mutado pelo próprio visitante — toca
                // junto no mix completo, que é exatamente a regra de divulgação.
                const on = locked ? true : (anySolo ? !!soloed[t.key] : !muted[t.key]);
                const isMuted = !locked && !!muted[t.key];
                const isSolo = !locked && !!soloed[t.key];
                const g = trackVol[t.key] ?? 1;
                const cortes = cuts[t.key] ?? SEM_CORTES_LISTA;
                const selDaFaixa = sel && sel.key === t.key ? sel : null;
                return (
                  // Agrupa a linha da faixa com a barra de cortes dela.
                  // `fit-content`: em tela estreita a mesa rola na horizontal
                  // (.mixer-tracks), e sem isto o grupo ficaria preso à largura
                  // visível enquanto a linha dentro dele tem 480px de mínimo.
                  <div key={t.key} style={{ minWidth: "fit-content" }}>
                  <div className="mixer-track-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 16px", borderBottom: cortes.length || selDaFaixa ? "none" : "1px solid var(--border)" }}>
                    {/* M / S — travado (bloqueado) mostra cadeado no lugar dos botões */}
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      {locked ? (
                        <div title={tx("proOnlyChannel")} aria-label={tx("lockedAria", { label: t.label })}
                          style={{ width: 56, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                            background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--muted2)", fontSize: 12 }}>
                          🔒
                        </div>
                      ) : (
                        <>
                          <button onClick={() => toggleMute(t.key)} aria-label={tx("muteAria", { label: t.label })}
                            style={{ width: 26, height: 26, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                              background: isMuted ? "var(--danger)" : "var(--surface2)",
                              border: `1px solid ${isMuted ? "var(--danger)" : "var(--border2)"}`,
                              color: isMuted ? "#fff" : "var(--muted)" }}>M</button>
                          <button onClick={() => toggleSolo(t.key)} aria-label={tx("soloAria", { label: t.label })}
                            style={{ width: 26, height: 26, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                              background: isSolo ? "var(--pro)" : "var(--surface2)",
                              border: `1px solid ${isSolo ? "var(--pro)" : "var(--border2)"}`,
                              color: isSolo ? "#000" : "var(--muted)" }}>S</button>
                        </>
                      )}
                    </div>
                    {/* ícone + nome */}
                    <div style={{ width: 118, display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                      <span style={{ fontSize: 17, opacity: on ? 1 : 0.4 }}>{iconFor(t.instrument)}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: on ? "var(--text)" : "var(--muted2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</span>
                    </div>
                    {/* volume da faixa — trava junto com M/S pra não dar isolamento "por fora" */}
                    {locked ? (
                      <a href="/planos" title={tx("unlockChannel")}
                        style={{ width: 64, flexShrink: 0, textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--accent)", textDecoration: "none", letterSpacing: "0.05em" }}>
                        PRO
                      </a>
                    ) : (
                      <input type="range" min={0} max={1} step={0.02} value={g}
                        onChange={e => { onMixerTouch?.(); setTrackVol(p => ({ ...p, [t.key]: Number(e.target.value) })); }}
                        style={{ width: 64, flexShrink: 0 }} aria-label={`Volume ${t.label}`} />
                    )}
                    {/* onda — clique dá seek; arrasto (com corte liberado) marca o trecho */}
                    <div
                      style={{ flex: 1, minWidth: 0, cursor: "pointer", position: "relative", touchAction: canCut ? "pan-y" : undefined }}
                      onClick={canCut ? undefined : onWaveClick}
                      onPointerDown={canCut ? (ev) => onWavePointerDown(ev, t.key) : undefined}
                      onPointerMove={canCut ? onWavePointerMove : undefined}
                      onPointerUp={canCut ? onWavePointerUp : undefined}
                      onPointerCancel={canCut ? () => { dragRef.current = null; } : undefined}
                    >
                      <WaveCanvas
                        peaks={peaks[t.key] ?? []}
                        color={colorFor(t.instrument)}
                        height={40}
                        dimmed={!on}
                        cuts={cortes}
                        duration={duration}
                      />
                      {/* Trecho sendo marcado agora — some ao cortar ou cancelar. */}
                      {selDaFaixa && duration > 0 && (
                        <div
                          aria-hidden="true"
                          style={{
                            position: "absolute", top: 0, bottom: 0,
                            left: `${(selDaFaixa.start / duration) * 100}%`,
                            width: `${Math.max(0.4, ((selDaFaixa.end - selDaFaixa.start) / duration) * 100)}%`,
                            background: "rgba(255,154,0,0.22)",
                            border: "1px solid var(--accent)",
                            pointerEvents: "none",
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* ── Barra de cortes da faixa ──
                      Só existe quando há algo a dizer: um trecho marcado ou
                      cortes já feitos. Fora isso a mesa continua limpa. */}
                  {canCut && (selDaFaixa || cortes.length > 0) && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                      padding: "0 16px 8px 82px", borderBottom: "1px solid var(--border)",
                    }}>
                      {selDaFaixa ? (
                        <>
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>
                            {tx("cutSelected", {
                              start: formatTime(selDaFaixa.start),
                              end: formatTime(selDaFaixa.end),
                            })}
                          </span>
                          <button
                            onClick={cortarSelecao}
                            style={{
                              padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                              background: "var(--accent)", color: "#000", border: "none",
                            }}
                          >
                            ✂ {tx("cutApply")}
                          </button>
                          <button
                            onClick={() => { seek(selDaFaixa.start); }}
                            style={{
                              padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                              background: "var(--surface2)", border: "1px solid var(--border2)", color: "var(--muted)",
                            }}
                          >
                            {tx("cutListen")}
                          </button>
                          <button
                            onClick={() => setSel(null)}
                            style={{
                              padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer",
                              background: "transparent", border: "1px solid var(--border2)", color: "var(--muted2)",
                            }}
                          >
                            {tx("cutCancel")}
                          </button>
                        </>
                      ) : null}

                      {cortes.length > 0 && (
                        <>
                          <span style={{ fontSize: 11, color: "var(--muted2)" }}>
                            {tx("cutTotal", { n: cortes.length, seconds: totalCortado(cortes).toFixed(1) })}
                          </span>
                          {cortes.map((c, i) => (
                            <button
                              key={`${c.start}-${c.end}`}
                              onClick={() => removerCorte(t.key, i)}
                              title={tx("cutUndoOne")}
                              style={{
                                padding: "3px 8px", borderRadius: 500, fontSize: 11, fontWeight: 600, cursor: "pointer",
                                background: "var(--surface2)", border: "1px dashed var(--border2)", color: "var(--muted)",
                                fontFamily: "var(--font-mono, monospace)",
                              }}
                            >
                              {formatTime(c.start)}–{formatTime(c.end)} ✕
                            </button>
                          ))}
                          <button
                            onClick={() => limparCortes(t.key)}
                            style={{
                              padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                              background: "transparent", border: "1px solid var(--border2)", color: "var(--muted2)",
                            }}
                          >
                            {tx("cutClear")}
                          </button>
                          {/* Consolidar só faz sentido em gravação própria: stem
                              do catálogo é o mesmo arquivo para todo mundo. */}
                          {t.takeId != null && onApplyCuts && (
                            <button
                              onClick={() => aplicarNoArquivo(t)}
                              disabled={aplicando !== null}
                              title={tx("cutApplyFileTitle")}
                              style={{
                                padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                                cursor: aplicando ? "default" : "pointer", opacity: aplicando ? 0.5 : 1,
                                background: "rgba(255,154,0,0.12)", border: "1px solid rgba(255,154,0,0.4)",
                                color: "var(--accent)",
                              }}
                            >
                              {aplicando === t.key ? tx("cutApplyFileBusy") : tx("cutApplyFile")}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  </div>
                );
              })}
              {/* Playhead alinhado ao início real da coluna de ondas:
                  pad 16 + M/S 56 + gap 10 + nome 118 + gap 10 + vol 64 + gap 10 = 284px;
                  o percurso vai de 284px até (100% - 16px de pad direito). */}
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `calc(284px + (100% - 300px) * ${pct} / 100)`, width: 2, background: "var(--accent)", pointerEvents: "none", opacity: ready ? 1 : 0 }} />
            </div>

            {/* Como cortar — a única pista de que arrastar na onda faz algo. */}
            {canCut && (
              <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--muted2)", lineHeight: 1.6 }}>✂ {tx("cutHint")}</span>
                {erroCorte && (
                  <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600 }}>⚠ {erroCorte}</span>
                )}
              </div>
            )}

            {/* Download da seleção (Pro/ProBand) — mixagem e/ou faixas separadas */}
            <DownloadPanel
              tracks={tracksParaDownload}
              audible={audible}
              trackVol={trackVol}
              getBuffer={getBuffer}
              songTitle={songTitle}
              songArtist={songArtist}
              isPro={isPro}
              ready={ready}
              songDuration={duration}
              onExport={onExport}
            />
          </>
        ) : (
          /* ─── Modo single (mix) ─── */
          <>
            <div style={{ padding: "14px 18px 0" }}>
              <div
                style={{ position: "relative", cursor: "pointer", opacity: ready ? 1 : 0.3, transition: "opacity 0.3s", touchAction: canCut ? "pan-y" : undefined }}
                onClick={canCut ? undefined : onWaveClick}
                onPointerDown={canCut ? (ev) => onWavePointerDown(ev, "mix") : undefined}
                onPointerMove={canCut ? onWavePointerMove : undefined}
                onPointerUp={canCut ? onWavePointerUp : undefined}
                onPointerCancel={canCut ? () => { dragRef.current = null; } : undefined}
              >
                <WaveCanvas peaks={mixPeaks} color="var(--accent)" height={56} dimmed={false} cuts={cuts["mix"]} duration={duration} />
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pct}%`, width: 2, background: "var(--accent)", pointerEvents: "none" }} />
                {sel && sel.key === "mix" && duration > 0 && (
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute", top: 0, bottom: 0,
                      left: `${(sel.start / duration) * 100}%`,
                      width: `${Math.max(0.4, ((sel.end - sel.start) / duration) * 100)}%`,
                      background: "rgba(255,154,0,0.22)", border: "1px solid var(--accent)", pointerEvents: "none",
                    }}
                  />
                )}
              </div>

              {/* Mesma barra de cortes da mesa, na única faixa que existe aqui. */}
              {canCut && (sel?.key === "mix" || (cuts["mix"]?.length ?? 0) > 0) && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 8 }}>
                  {sel?.key === "mix" && (
                    <>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>
                        {tx("cutSelected", { start: formatTime(sel.start), end: formatTime(sel.end) })}
                      </span>
                      <button onClick={cortarSelecao}
                        style={{ padding: "4px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", background: "var(--accent)", color: "#000", border: "none" }}>
                        ✂ {tx("cutApply")}
                      </button>
                      <button onClick={() => setSel(null)}
                        style={{ padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", background: "transparent", border: "1px solid var(--border2)", color: "var(--muted2)" }}>
                        {tx("cutCancel")}
                      </button>
                    </>
                  )}
                  {(cuts["mix"] ?? []).map((c, i) => (
                    <button key={`${c.start}-${c.end}`} onClick={() => removerCorte("mix", i)} title={tx("cutUndoOne")}
                      style={{ padding: "3px 8px", borderRadius: 500, fontSize: 11, fontWeight: 600, cursor: "pointer", background: "var(--surface2)", border: "1px dashed var(--border2)", color: "var(--muted)", fontFamily: "var(--font-mono, monospace)" }}>
                      {formatTime(c.start)}–{formatTime(c.end)} ✕
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: "12px 18px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "var(--muted)", fontSize: 12, minWidth: 36, textAlign: "right" }}>{formatTime(current)}</span>
                <div style={{ flex: 1, position: "relative", height: 4 }}>
                  <div style={{ height: "100%", borderRadius: 2, background: "var(--surface3)", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: "var(--accent)", borderRadius: 2 }} />
                  </div>
                  <input type="range" min={0} max={duration || 0} step={0.1} value={current}
                    onChange={e => seek(Number(e.target.value))}
                    style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", height: "100%" }} aria-label={tx("position")} />
                </div>
                <span style={{ color: "var(--muted)", fontSize: 12, minWidth: 36 }}>{formatTime(duration)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {skipBtn(-10, "«", tx("skipBack"))}
                {PlayButton}
                {skipBtn(10, "»", tx("skipForward"))}
              {LoopButton}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{songTitle}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>{songArtist}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>{tx("vol")}</span>
                  <input type="range" min={0} max={1} step={0.05} value={volume}
                    onChange={e => setVolume(Number(e.target.value))} style={{ width: 72 }} aria-label={tx("volume")} />
                </div>
                <kbd style={{ background: "var(--surface2)", border: "1px solid var(--border2)", padding: "3px 8px", borderRadius: 5, fontSize: 11, color: "var(--muted2)", flexShrink: 0 }}>{tx("space")}</kbd>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Velocidade e Pitch foram movidos pra a coluna direita (SongPlayer). */}

      {/* O mixer inteiro é do Free; o upsell abaixo é sobre o que só o Pro tem. */}
      {!isPro && stems.length > 0 && proGate(tx("gateStems"))}

    </div>
  );
}
