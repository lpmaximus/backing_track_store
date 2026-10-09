/**
 * Pedal de loop — regras puras (EVT-005).
 *
 * Só a máquina de estados e o mapa de teclas do pedal físico. Nada de áudio,
 * nada de React: o motor vive no AudioWorklet (`public/looper-worklet.js`) e a
 * tela em `LoopPedal.tsx`. Separado assim porque a parte que erra em silêncio
 * é justamente esta — "o que o próximo toque faz" — e aqui ela é testável sem
 * microfone, sem navegador e sem alguém pisando num pedal.
 *
 * ── Efêmero, de propósito (EVT-005 §7) ──────────────────────────────────────
 * O loop existe enquanto a janela está aberta. Não há tabela, rota nem R2:
 * fechar o pop-up descarta o áudio. Isso é o que separa esta função da
 * gravação de take — que produz um arquivo, é do tier Studio e carrega a
 * discussão de privacidade de voz guardada em servidor. Aqui não há arquivo,
 * então não há o que proteger, e a função pode viver em qualquer plano pago.
 */

/** Estados do pedal. Espelham os do motor no worklet. */
export type LooperState = "idle" | "recording" | "playing" | "overdubbing" | "stopped";

/** Comandos que o worklet entende. */
export type LooperCmd = "rec" | "close" | "overdub" | "play" | "stop" | "undo" | "clear";

/**
 * O que o toque no interruptor ESQUERDO faz, dado o estado atual.
 *
 * É o ciclo do pedal de verdade: gravar → tocar → sobrepor → tocar → sobrepor…
 * Um pé só, sem escolher nada, sem menu. Quem está com as duas mãos no
 * instrumento não tem como fazer diferente.
 */
export function aoPisarPrincipal(state: LooperState): { cmd: LooperCmd; next: LooperState } {
  switch (state) {
    case "idle":        return { cmd: "rec",     next: "recording" };
    case "recording":   return { cmd: "close",   next: "playing" };
    case "playing":     return { cmd: "overdub", next: "overdubbing" };
    case "overdubbing": return { cmd: "play",    next: "playing" };
    case "stopped":     return { cmd: "play",    next: "playing" };
  }
}

/**
 * Interruptor DIREITO, toque curto: parar.
 *
 * Durante a primeira camada, parar também FECHA o loop — o material gravado
 * não é descartado. Descartar exige o gesto de apagar (segurar), que é
 * deliberado. Perder uma tomada por um toque errado seria imperdoável.
 */
export function aoPisarParar(state: LooperState): { cmd: LooperCmd; next: LooperState } | null {
  if (state === "idle") return null;
  if (state === "stopped") return null;
  return { cmd: "stop", next: "stopped" };
}

/** Só faz sentido desfazer quando existe uma camada sobreposta guardada. */
export function podeDesfazer(state: LooperState, temUndo: boolean): boolean {
  return temUndo && state !== "idle" && state !== "recording";
}

/** Rótulo da ação que o próximo toque no interruptor esquerdo executa. */
export function rotuloPrincipal(state: LooperState): "rec" | "play" | "dub" {
  if (state === "idle") return "rec";
  if (state === "recording") return "play";
  if (state === "playing") return "dub";
  return "play";
}

// ─── Pedal físico ────────────────────────────────────────────────────────────
//
// Pedal de página por Bluetooth (AirTurn, PageFlip, iRig BlueTurn, Donner e
// afins) não é um dispositivo de áudio: para o sistema ele É UM TECLADO, e
// pisar nele manda uma tecla. Por isso não há Web Bluetooth aqui — não haveria
// o que parear. O que resolve de verdade é deixar a pessoa ENSINAR a tecla:
// ela pisa, a gente guarda o código, e passa a funcionar com qualquer modelo,
// inclusive os que ainda não existem.
//
// Guardamos `event.code` (posição física da tecla) e não `event.key`: o código
// não muda com o layout do teclado nem com a tecla morta do português.

export type PedalKeymap = {
  /** Códigos que disparam o interruptor esquerdo (gravar/tocar/sobrepor). */
  primary: string[];
  /** Códigos que disparam o interruptor direito (parar). */
  stop: string[];
};

/**
 * Sem pedal, o teclado do computador já serve. Espaço é a tecla mais óbvia
 * para a ação principal — e capturá-la é seguro porque o pedal só escuta
 * enquanto o pop-up está aberto, onde não há mais nada para rolar.
 */
export const KEYMAP_PADRAO: PedalKeymap = { primary: ["Space"], stop: ["KeyS"] };

/** As combinações que os pedais mais comuns mandam de fábrica. */
export const PEDAL_PRESETS: { id: string; keymap: PedalKeymap }[] = [
  { id: "teclado",  keymap: KEYMAP_PADRAO },
  // AirTurn e a maioria dos "modo 1": setas.
  { id: "setas",    keymap: { primary: ["ArrowUp", "ArrowRight"], stop: ["ArrowDown", "ArrowLeft"] } },
  // PageFlip e leitores de partitura: página.
  { id: "pagina",   keymap: { primary: ["PageDown"], stop: ["PageUp"] } },
];

const CODIGO_VALIDO = /^[A-Za-z0-9]{1,24}$/;

/** Tecla que não deve virar comando de pedal por atrapalhar a própria janela. */
const RESERVADAS = new Set(["Escape", "Tab"]);

export function codigoUtilizavel(code: unknown): code is string {
  return typeof code === "string" && CODIGO_VALIDO.test(code) && !RESERVADAS.has(code);
}

/**
 * Normaliza o que veio do localStorage. Mapa estragado volta ao padrão em vez
 * de erro: uma preferência ilegível não pode impedir alguém de usar o pedal.
 */
export function sanitizeKeymap(v: unknown): PedalKeymap {
  if (!v || typeof v !== "object") return { ...KEYMAP_PADRAO };
  const o = v as { primary?: unknown; stop?: unknown };
  const limpar = (x: unknown): string[] =>
    Array.isArray(x) ? Array.from(new Set(x.filter(codigoUtilizavel))).slice(0, 4) : [];
  const primary = limpar(o.primary);
  const stop = limpar(o.stop);
  return {
    primary: primary.length ? primary : [...KEYMAP_PADRAO.primary],
    // Parar pode ficar sem tecla (há o botão na tela); gravar, não — sem ele o
    // pedal não faz nada e a pessoa acharia que quebrou.
    stop,
  };
}

/** Qual interruptor esta tecla aciona, se algum. */
export function acaoDaTecla(km: PedalKeymap, code: string): "primary" | "stop" | null {
  if (km.primary.includes(code)) return "primary";
  if (km.stop.includes(code)) return "stop";
  return null;
}

/**
 * Ensina uma tecla a um interruptor, tirando-a do outro se estiver lá.
 * Deixar a mesma tecla nos dois faria o pedal gravar e parar no mesmo toque —
 * um defeito que só apareceria em cima da hora, no palco.
 */
export function aprenderTecla(km: PedalKeymap, alvo: "primary" | "stop", code: string): PedalKeymap {
  if (!codigoUtilizavel(code)) return km;
  const outro = alvo === "primary" ? "stop" : "primary";
  return {
    ...km,
    [alvo]: [code],
    [outro]: km[outro].filter(c => c !== code),
  } as PedalKeymap;
}

// ─── Latência ────────────────────────────────────────────────────────────────

/**
 * Palpite inicial de ida-e-volta, em milissegundos, a partir do que o próprio
 * navegador declara. É só ponto de partida: `baseLatency` cobre o caminho
 * interno do navegador, mas nem ele nem o sistema informam o atraso do
 * microfone ou da interface, que é justamente a parte que varia de máquina
 * para máquina. Daí o ajuste fino na tela.
 */
export function latenciaEstimadaMs(ctx: { baseLatency?: number; outputLatency?: number }): number {
  const base = Number(ctx.baseLatency) || 0;
  const saida = Number(ctx.outputLatency) || 0;
  const total = (base + saida) * 1000;
  // Piso de 20 ms: um navegador que declara zero está omitindo, não sendo
  // instantâneo — e zero deixaria a sobreposição atrasada sem explicação.
  return Math.round(Math.max(20, Math.min(300, total || 30)));
}

export const LATENCIA_MIN_MS = 0;
export const LATENCIA_MAX_MS = 300;

export function sanitizeLatenciaMs(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 30;
  return Math.round(Math.max(LATENCIA_MIN_MS, Math.min(LATENCIA_MAX_MS, n)));
}
