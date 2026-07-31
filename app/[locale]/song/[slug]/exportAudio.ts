/**
 * Exportação de áudio no NAVEGADOR (Fase Pro — "export de stems").
 *
 * Por que no client e não no servidor: o player já baixou e decodificou todos
 * os stems para tocar. Renderizar a mixagem aqui custa ZERO em servidor, zero
 * em banda (nada sobe de volta) e sai instantâneo — enquanto um render com
 * ffmpeg na Vercel gastaria função serverless, egress do R2 e ainda esbarraria
 * no limite de tempo de execução em música longa.
 *
 * Duas saídas, de propósito:
 *  1. FAIXAS SEPARADAS — baixa o arquivo ORIGINAL do R2, sem reencodar. É o que
 *     o músico leva pro Reaper/Ableton; qualquer reencode aqui só degradaria.
 *  2. MIXAGEM — renderiza no OfflineAudioContext exatamente o que está audível
 *     na mesa (mute, solo, volume de canal) e encoda em MP3 320kbps.
 *
 * O MP3 é encodado por @breezystack/lamejs (fork mantido do lamejs, com ESM e
 * tipos). O import é DINÂMICO: são ~300kB que só quem clica em baixar paga —
 * não entram no bundle da página da música. Se o encoder falhar em carregar, o
 * fallback é WAV: melhor entregar um arquivo grande do que não entregar nada.
 *
 * ATENÇÃO — tom e velocidade NÃO entram no arquivo (decisão de 31/07/2026): o
 * export sai no áudio original. O pitch shift do Tone.js é um efeito de ensaio
 * e degrada o material; quem exporta quer o stem limpo pra tratar fora daqui.
 */

/** Uma faixa a entrar na mixagem, com o ganho já resolvido pela mesa. */
export type MixPart = {
  buffer: AudioBuffer;
  /** 0–1. Já é o produto de volume do canal × master; mute/solo entram como 0. */
  gain: number;
};

/** Taxa de amostragem do arquivo exportado. 44,1kHz é o que o lamejs encoda
 *  melhor e o que todo DAW espera. O OfflineAudioContext reamostra sozinho se
 *  o stem tiver vindo em outra taxa. */
const EXPORT_SAMPLE_RATE = 44100;
const MP3_KBPS = 320;

/** Nome de arquivo seguro em Windows, macOS e Linux. */
export function safeFileName(name: string): string {
  return name
    .normalize("NFC")
    .replace(/[\\/:*?"<>|]+/g, "-") // proibidos no Windows
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "audio";
}

/** Extensão do arquivo original a partir da URL (mp3/wav/flac…), com padrão mp3. */
export function extFromUrl(url: string): string {
  const m = url.split("?")[0].match(/\.([a-z0-9]{2,4})$/i);
  return m ? m[1].toLowerCase() : "mp3";
}

/** Dispara o download de um Blob sem depender de servidor. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Espera o browser começar a leitura antes de soltar a URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Baixa o arquivo ORIGINAL de um stem (sem reencodar) e salva no disco.
 *
 * Usa fetch + Blob em vez de <a download> direto na URL do R2 porque o
 * atributo `download` é ignorado em origem cruzada — o browser abriria o áudio
 * numa aba em vez de salvar. O R2 já libera CORS de GET (o Tone.js carrega os
 * stems desse mesmo jeito), então o fetch passa.
 */
export async function downloadOriginal(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  downloadBlob(await res.blob(), filename);
}

/**
 * Mixa as faixas num único AudioBuffer estéreo, respeitando o ganho de cada uma.
 * Faixas com ganho 0 (mutadas, ou fora do solo) devem ser filtradas ANTES de
 * chegar aqui — renderizar silêncio só gasta tempo.
 */
export async function renderMixdown(parts: MixPart[]): Promise<AudioBuffer> {
  if (parts.length === 0) throw new Error("no-parts");

  const seconds = Math.max(...parts.map((p) => p.buffer.duration));
  const frames = Math.ceil(seconds * EXPORT_SAMPLE_RATE);

  const OfflineCtx: typeof OfflineAudioContext =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;

  const ctx = new OfflineCtx(2, frames, EXPORT_SAMPLE_RATE);

  for (const part of parts) {
    const src = ctx.createBufferSource();
    src.buffer = part.buffer;
    const g = ctx.createGain();
    g.gain.value = part.gain;
    src.connect(g);
    g.connect(ctx.destination);
    src.start(0);
  }

  return ctx.startRendering();
}

/** float −1..1 → PCM 16 bits, com clipe duro (soma de stems estoura fácil). */
function toInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/**
 * Encoda o buffer em MP3 320kbps. Processa em blocos de 1152 amostras (o
 * tamanho do frame MPEG) e devolve o controle ao browser a cada ~50 blocos —
 * sem isso a aba congela por vários segundos numa música de 4 minutos.
 *
 * @param onProgress 0–1, para a barra de progresso.
 */
async function encodeMp3(buffer: AudioBuffer, onProgress?: (p: number) => void): Promise<Blob> {
  const lame = await import("@breezystack/lamejs");
  const channels = Math.min(2, buffer.numberOfChannels);
  const encoder = new lame.Mp3Encoder(channels, buffer.sampleRate, MP3_KBPS);

  const left = toInt16(buffer.getChannelData(0));
  const right = channels > 1 ? toInt16(buffer.getChannelData(1)) : null;

  const BLOCK = 1152;
  const chunks: Uint8Array[] = [];
  const total = left.length;

  for (let i = 0; i < total; i += BLOCK) {
    const l = left.subarray(i, i + BLOCK);
    const r = right ? right.subarray(i, i + BLOCK) : null;
    const buf = r ? encoder.encodeBuffer(l, r) : encoder.encodeBuffer(l);
    if (buf.length > 0) chunks.push(new Uint8Array(buf));

    if ((i / BLOCK) % 50 === 0) {
      onProgress?.(i / total);
      await new Promise((r2) => setTimeout(r2, 0));
    }
  }

  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(new Uint8Array(tail));
  onProgress?.(1);

  return new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
}

/** WAV 16 bits — plano B quando o encoder MP3 não carrega. */
function encodeWav(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels);
  const frames = buffer.length;
  const bytes = frames * channels * 2;
  const out = new ArrayBuffer(44 + bytes);
  const view = new DataView(out);

  const str = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  str(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, bytes, true);

  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let pos = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      pos += 2;
    }
  }
  return new Blob([out], { type: "audio/wav" });
}

/**
 * Mixa e encoda de uma vez. Devolve o blob e a extensão real usada — quem
 * chama não deve assumir ".mp3", porque o fallback pode ter entrado.
 */
export async function exportMixdown(
  parts: MixPart[],
  onProgress?: (p: number) => void,
): Promise<{ blob: Blob; ext: "mp3" | "wav" }> {
  const rendered = await renderMixdown(parts);
  try {
    return { blob: await encodeMp3(rendered, onProgress), ext: "mp3" };
  } catch (err) {
    console.error("[export] encoder MP3 indisponível, caindo pra WAV", err);
    onProgress?.(1);
    return { blob: encodeWav(rendered), ext: "wav" };
  }
}
