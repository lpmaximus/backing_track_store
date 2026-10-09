/**
 * Motor do pedal de loop — roda na THREAD DE ÁUDIO (AudioWorklet).
 *
 * ── Por que o motor inteiro vive aqui dentro ────────────────────────────────
 * A tentação era reaproveitar o MediaRecorder que a gravação de take já usa.
 * Não serve: ele entrega um arquivo codificado, e todo codec acrescenta um
 * atraso no começo (o MP3 reencodado do estúdio ganha ~26 ms, já medido). Num
 * take isso acontece UMA vez e a pessoa corrige no ajuste fino. Num loop, o
 * mesmo erro voltaria a cada volta: um loop de 4 s errando 26 ms está meia
 * batida fora depois de um minuto tocando.
 *
 * Aqui não há arquivo, não há codec e não há relógio de JavaScript. O loop é
 * um índice inteiro que anda de uma amostra por vez e volta a zero no fim —
 * a mesma aritmética que o pedal de verdade faz. Não existe deriva possível.
 *
 * ── Gravar e tocar no MESMO passo ───────────────────────────────────────────
 * A sobreposição (overdub) é somar o que entra no que já está gravado, na
 * posição que está tocando agora. Como leitura e escrita acontecem dentro do
 * mesmo `process()`, não é preciso calcular onde a camada nova cai: ela cai
 * onde o cabeçote está. Só resta descontar a latência (ver abaixo).
 *
 * ── Latência: por que dois números e não um ─────────────────────────────────
 * PRIMEIRA camada: a pessoa toca, e o som demora `latIn` para chegar aqui.
 * O tempo entre os dois toques do pé é o comprimento certo do loop; o material
 * é que está deslocado. Por isso o loop começa em `loopStart = latIn` em vez
 * de zero — e por isso continuamos gravando um rabo de `latIn` depois de
 * fechar, senão o fim do loop ficaria mudo.
 *
 * SOBREPOSIÇÃO: a pessoa ouve o loop com atraso `latOut`, responde, e a
 * resposta demora `latIn` para voltar. Ou seja, o que chega agora pertence a
 * `latIn + latOut` atrás do cabeçote. É isso que `latRound` desconta.
 *
 * ── Emenda ──────────────────────────────────────────────────────────────────
 * Onde o fim do loop encontra o começo quase nunca há cruzamento por zero, e
 * o salto vira um clique. Um fade de poucos milissegundos nas duas bordas
 * resolve sem ser percebido como corte.
 */

const FADE_MS = 4;

class LooperProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = options.processorOptions || {};
    const maxSeconds = Math.max(5, Math.min(600, opts.maxSeconds || 120));

    this.capacity = Math.floor(maxSeconds * sampleRate);
    this.buffer = new Float32Array(this.capacity);
    this.undo = null;

    this.state = "idle"; // idle | recording | playing | overdubbing | stopped
    this.loopStart = 0;
    this.loopLength = 0;
    this.playhead = 0;
    this.writeHead = 0;
    /** Enquanto > 0, ainda estamos capturando o rabo da primeira camada. */
    this.tail = 0;

    this.latIn = 0;
    this.latRound = 0;
    this.level = 1;
    this.monitor = 0;

    this.fade = Math.max(8, Math.floor((FADE_MS / 1000) * sampleRate));

    this.peak = 0;
    this.blocos = 0;

    this.port.onmessage = e => this.comando(e.data || {});
  }

  avisar(extra) {
    this.port.postMessage({
      type: "state",
      state: this.state,
      lengthSec: this.loopLength / sampleRate,
      canUndo: !!this.undo,
      ...extra,
    });
  }

  /** Suaviza as duas bordas do loop para a emenda não estalar. */
  suavizarBordas() {
    if (this.loopLength < this.fade * 3) return;
    const n = this.fade;
    for (let i = 0; i < n; i++) {
      const g = i / n;
      this.buffer[this.loopStart + i] *= g;
      this.buffer[this.loopStart + this.loopLength - 1 - i] *= g;
    }
  }

  comando(msg) {
    switch (msg.cmd) {
      case "config":
        if (Number.isFinite(msg.latIn)) this.latIn = Math.max(0, Math.floor(msg.latIn));
        if (Number.isFinite(msg.latRound)) this.latRound = Math.max(0, Math.floor(msg.latRound));
        if (Number.isFinite(msg.level)) this.level = Math.max(0, Math.min(2, msg.level));
        if (Number.isFinite(msg.monitor)) this.monitor = Math.max(0, Math.min(2, msg.monitor));
        break;

      case "rec":
        // Primeira camada. Zera só o que será usado — limpar 120 s de buffer a
        // cada tomada seria trabalho inútil na thread de áudio.
        this.buffer.fill(0, 0, Math.min(this.capacity, this.writeHead + this.loopStart + this.loopLength + 1));
        this.undo = null;
        this.loopStart = this.latIn;
        this.loopLength = 0;
        this.writeHead = 0;
        this.playhead = 0;
        this.tail = 0;
        this.state = "recording";
        this.avisar();
        break;

      case "close": {
        // O tempo entre os dois toques É o comprimento do loop. O material
        // ainda não chegou por inteiro, então seguimos capturando o rabo
        // enquanto o cabeçote já começa a tocar do começo.
        if (this.state !== "recording") break;
        const alvo = Math.max(this.fade * 3, this.writeHead);
        this.loopLength = Math.min(alvo, this.capacity - this.loopStart - 1);
        this.tail = this.loopStart;
        this.playhead = 0;
        this.state = msg.andThen === "stop" ? "stopped" : "playing";
        this.avisar();
        break;
      }

      case "overdub":
        if (this.loopLength <= 0) break;
        // Cópia só do trecho que existe — e só agora, quando o desfazer passa
        // a fazer sentido. Guardar a cada volta do loop custaria memória à toa.
        this.undo = this.buffer.slice(this.loopStart, this.loopStart + this.loopLength);
        this.state = "overdubbing";
        this.avisar();
        break;

      case "play":
        if (this.loopLength <= 0) break;
        if (this.state === "overdubbing") this.suavizarBordas();
        this.state = "playing";
        this.avisar();
        break;

      case "stop":
        if (this.state === "recording") { this.comando({ cmd: "close", andThen: "stop" }); break; }
        if (this.state === "overdubbing") this.suavizarBordas();
        if (this.loopLength > 0) { this.state = "stopped"; this.playhead = 0; }
        this.avisar();
        break;

      case "undo": {
        // Troca em vez de descartar: o mesmo gesto refaz o que acabou de ser
        // desfeito, como no pedal. Um nível, igual ao RC-1.
        if (!this.undo || this.loopLength <= 0) break;
        const atual = this.buffer.slice(this.loopStart, this.loopStart + this.loopLength);
        this.buffer.set(this.undo, this.loopStart);
        this.undo = atual;
        this.avisar();
        break;
      }

      case "clear":
        this.state = "idle";
        this.loopStart = 0;
        this.loopLength = 0;
        this.playhead = 0;
        this.writeHead = 0;
        this.tail = 0;
        this.undo = null;
        this.avisar();
        break;
    }
  }

  process(inputs, outputs) {
    const inCh = inputs[0] && inputs[0][0];
    const out = outputs[0];
    if (!out || out.length === 0) return true;
    const n = out[0].length;

    const gravando = this.state === "recording";
    const sobrepondo = this.state === "overdubbing";
    const tocando = this.state === "playing" || sobrepondo;

    let pico = 0;

    for (let i = 0; i < n; i++) {
      const entrada = inCh ? inCh[i] : 0;
      const a = entrada < 0 ? -entrada : entrada;
      if (a > pico) pico = a;

      // ── Primeira camada ───────────────────────────────────────────────────
      if (gravando && this.writeHead < this.capacity) {
        this.buffer[this.writeHead++] = entrada;
      } else if (this.tail > 0 && this.writeHead < this.capacity) {
        // Rabo: o material que ainda estava a caminho quando o pé fechou o loop.
        this.buffer[this.writeHead++] = entrada;
        this.tail--;
        if (this.tail === 0) this.suavizarBordas();
      }

      let som = 0;
      if (tocando && this.loopLength > 0) {
        const idx = this.loopStart + this.playhead;

        // ── Sobreposição ────────────────────────────────────────────────────
        // Escreve atrás do cabeçote, onde o som que acabou de chegar pertence.
        if (sobrepondo) {
          let w = this.playhead - this.latRound;
          while (w < 0) w += this.loopLength;
          const j = this.loopStart + w;
          let v = this.buffer[j] + entrada;
          // Teto duro: somar camada sobre camada estoura em algum momento, e
          // estourado não tem conserto depois. Melhor achatar o pico do que
          // devolver ruído digital.
          if (v > 1) v = 1; else if (v < -1) v = -1;
          this.buffer[j] = v;
        }

        som = this.buffer[idx] * this.level;

        this.playhead++;
        if (this.playhead >= this.loopLength) this.playhead = 0;
      }

      // Monitoração da entrada: desligada por padrão. Serve para quem toca
      // guitarra plugada na interface e não tem som acústico para se guiar.
      if (this.monitor > 0) som += entrada * this.monitor;

      for (let c = 0; c < out.length; c++) out[c][i] = som;
    }

    if (pico > this.peak) this.peak = pico;

    // Um aviso a cada ~12 ms basta para o anel de LED andar liso. Postar a
    // cada bloco (2,7 ms) só encheria a fila de mensagens do main thread.
    if (++this.blocos >= 4) {
      this.blocos = 0;
      this.port.postMessage({
        type: "tick",
        pos: this.loopLength > 0 ? this.playhead / this.loopLength : 0,
        recSec: gravando ? this.writeHead / sampleRate : 0,
        peak: this.peak,
      });
      this.peak = 0;
    }

    // Estourou a memória durante a primeira camada: fecha sozinho, senão a
    // pessoa continuaria pisando achando que ainda está gravando.
    if (gravando && this.writeHead >= this.capacity - 1) {
      this.comando({ cmd: "close" });
      this.port.postMessage({ type: "full" });
    }

    return true;
  }
}

registerProcessor("looper", LooperProcessor);
