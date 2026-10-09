/**
 * Ligação entre a tela do pedal e o motor que roda na thread de áudio.
 *
 * Só encanamento: abre o microfone, carrega o worklet, monta a cadeia e passa
 * recados nos dois sentidos. Nenhuma regra de produto mora aqui — quem decide
 * o que cada toque faz é `src/lib/looper.ts`, e quem faz o áudio é
 * `public/looper-worklet.js`.
 *
 * A cadeia é: microfone → ganho de entrada → LOOPER → saída.
 *
 * O ganho fica ANTES do motor de propósito: é assim que ele entra no material
 * gravado. Depois, só mudaria o que se ouve, e a camada continuaria fraca por
 * baixo — descoberto tarde, com o loop já montado.
 */

import { latenciaEstimadaMs, type LooperCmd, type LooperState } from "@/src/lib/looper";

/** Teto de memória do loop. 120 s a 48 kHz são ~23 MB — folgado para prática. */
export const MAX_SEGUNDOS = 120;

export type LooperTick = {
  /** 0–1, posição do cabeçote dentro do loop. Move o anel de LED. */
  pos: number;
  /** Segundos já gravados na primeira camada (0 fora dela). */
  recSec: number;
  /** Pico da entrada desde o último aviso, 0–1. */
  peak: number;
};

export type LooperSnapshot = {
  state: LooperState;
  lengthSec: number;
  canUndo: boolean;
};

type Opcoes = {
  deviceId?: string;
  onState: (s: LooperSnapshot) => void;
  onTick: (t: LooperTick) => void;
  /** Estourou o teto de memória durante a gravação — o loop fechou sozinho. */
  onFull?: () => void;
};

export class LooperEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private gain: GainNode | null = null;

  /** Latência de ida-e-volta em ms, informada pela tela. */
  private latenciaMs = 30;
  private nivel = 1;
  private monitorar = 0;

  async iniciar(op: Opcoes): Promise<void> {
    if (this.ctx) return;

    if (typeof AudioWorkletNode === "undefined") throw new Error("worklet");

    // Processamento de voz desligado pelo mesmo motivo da gravação de take:
    // cancelamento de eco, supressão de ruído e ganho automático existem para
    // chamada de voz e destroem sinal musical — comem sustain, cortam reverb e
    // bombeiam o volume no meio da frase. Num loop o estrago se repete a cada
    // volta, então aqui pesa ainda mais.
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        // `exact`: se a interface escolhida sumiu, é melhor avisar do que cair
        // calado no microfone do notebook e gravar o loop com o som errado.
        ...(op.deviceId ? { deviceId: { exact: op.deviceId } } : {}),
      },
    });

    const Ctx: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    // `interactive` pede a menor latência que a máquina consegue entregar — é a
    // diferença entre um pedal utilizável e um que responde depois do tempo.
    const ctx = new Ctx({ latencyHint: "interactive" });
    await ctx.audioWorklet.addModule("/looper-worklet.js");
    await ctx.resume();

    const node = new AudioWorkletNode(ctx, "looper", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: { maxSeconds: MAX_SEGUNDOS },
    });

    node.port.onmessage = e => {
      const m = e.data as { type: string } & LooperTick & LooperSnapshot;
      if (m.type === "tick") op.onTick({ pos: m.pos, recSec: m.recSec, peak: m.peak });
      else if (m.type === "state") op.onState({ state: m.state, lengthSec: m.lengthSec, canUndo: m.canUndo });
      else if (m.type === "full") op.onFull?.();
    };

    const src = ctx.createMediaStreamSource(stream);
    const gain = ctx.createGain();
    gain.gain.value = 1;
    src.connect(gain);
    gain.connect(node);
    node.connect(ctx.destination);

    this.ctx = ctx;
    this.stream = stream;
    this.node = node;
    this.gain = gain;

    this.enviarConfig();
  }

  private enviarConfig() {
    const ctx = this.ctx;
    if (!ctx || !this.node) return;
    const sr = ctx.sampleRate;
    const round = Math.round((this.latenciaMs / 1000) * sr);
    // A primeira camada só sofre o atraso de ENTRADA; a sobreposição sofre a
    // ida e a volta. Sem um número separado para a entrada, metade do
    // ida-e-volta é a melhor aproximação disponível — e errar aqui só desloca
    // o loop inteiro, que ninguém percebe quando ele toca sozinho.
    this.node.port.postMessage({
      cmd: "config",
      latIn: Math.round(round / 2),
      latRound: round,
      level: this.nivel,
      monitor: this.monitorar,
    });
  }

  /**
   * O que o navegador declara de atraso, já em milissegundos.
   *
   * Vem do AudioContext que está TOCANDO, não de um criado só para perguntar:
   * um contexto recém-aberto ainda não conhece a saída em uso e costuma
   * responder zero. Continua sendo um piso — nem navegador nem sistema
   * informam o atraso do microfone ou da interface, que é a parte que mais
   * varia. Por isso o número volta para a tela como ponto de partida, não
   * como resposta final.
   */
  latenciaSugeridaMs(): number {
    return this.ctx ? latenciaEstimadaMs(this.ctx) : 30;
  }

  /** Ida-e-volta em milissegundos. Vale a partir da PRÓXIMA camada gravada. */
  setLatenciaMs(ms: number) {
    this.latenciaMs = ms;
    this.enviarConfig();
  }

  /** Volume do loop (o botão LEVEL do pedal). */
  setNivel(v: number) {
    this.nivel = v;
    this.enviarConfig();
  }

  /** Devolve a entrada à saída para quem toca plugado e não se ouve. */
  setMonitor(on: boolean) {
    this.monitorar = on ? 1 : 0;
    this.enviarConfig();
  }

  /** Ganho da entrada — entra no material gravado, não só na reprodução. */
  setGanhoEntrada(v: number) {
    if (this.gain) this.gain.gain.value = v;
  }

  enviar(cmd: LooperCmd) {
    this.node?.port.postMessage({ cmd });
  }

  get ativo(): boolean {
    return !!this.ctx;
  }

  /**
   * Solta tudo. Chamado ao fechar o pop-up — e é aqui que "efêmero" deixa de
   * ser promessa: o buffer do loop vive dentro do worklet, e fechar o
   * AudioContext o descarta junto. Não existe caminho para o disco.
   */
  parar() {
    if (this.node) this.node.port.onmessage = null;
    try { this.node?.disconnect(); } catch {}
    this.stream?.getTracks().forEach(t => t.stop());
    // Sem isto o indicador de gravação do navegador fica aceso depois que a
    // pessoa fecha a janela — e ela não tem como saber que já parou.
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.stream = null;
    this.node = null;
    this.gain = null;
  }
}
