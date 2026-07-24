/**
 * Implementação WhisperX (Replicate) do LyricsProvider — letra COM TEMPO POR
 * PALAVRA. É o que permite posicionar cada acorde sobre a sílaba certa (cifra
 * estilo CifraClub), coisa que o Whisper comum não dá (timestamp só por linha).
 *
 * Usa o modelo público victor-upmeet/whisperx (não precisa de Cog/deploy próprio).
 * Roda sobre o STEM DE VOCAL isolado. Polling, igual ao Whisper — consultado em
 * /api/lyrics/advance.
 *
 * Saída do WhisperX: { segments: [{ start, end, text, words: [{word,start,end}] }] }.
 * O parser é defensivo (aceita variações de nome de campo).
 *
 * Env vars:
 *   REPLICATE_API_TOKEN       — token da conta Replicate (já usado)
 *   REPLICATE_WHISPERX_VERSION — hash da versão do victor-upmeet/whisperx
 *   WHISPER_LANGUAGE          — (opcional) idioma, ex. "pt" (default: auto)
 */
import type { LyricsProvider, LyricsSubmitResult, LyricsPollResult, LyricsLine, LyricsWord } from "./types";

const API = "https://api.replicate.com/v1/predictions";

/** Extrai palavras [{text,start,end}] de um segmento do WhisperX. */
function parseWords(seg: Record<string, unknown>): LyricsWord[] {
  const raw = seg.words;
  if (!Array.isArray(raw)) return [];
  const out: LyricsWord[] = [];
  for (const w of raw) {
    if (!w || typeof w !== "object") continue;
    const o = w as Record<string, unknown>;
    const textRaw = o.word ?? o.text ?? o.value;
    const text = typeof textRaw === "string" ? textRaw.trim() : "";
    const start = Number(o.start);
    const end = Number(o.end ?? o.start);
    // Só palavras com tempo válido servem pra ancorar acorde; sem tempo, ignora
    // (a linha ainda renderiza pelo texto do segmento).
    if (text && Number.isFinite(start) && Number.isFinite(end)) {
      out.push({ text, start, end });
    }
  }
  return out;
}

/** Converte a saída do WhisperX em LyricsLine[] (linha = segmento). */
function parseSegments(output: unknown): LyricsLine[] {
  let arr: unknown = output;
  if (output && typeof output === "object" && !Array.isArray(output)) {
    const o = output as Record<string, unknown>;
    arr = o.segments ?? o.result ?? o.transcription ?? [];
  }
  if (!Array.isArray(arr)) return [];

  const lines: LyricsLine[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const textRaw = o.text ?? o.value;
    const text = typeof textRaw === "string" ? textRaw.trim() : "";
    const start = Number(o.start ?? o.begin ?? o.time ?? 0);
    if (!text || !Number.isFinite(start)) continue;
    const words = parseWords(o);
    const line: LyricsLine = { time: start, text };
    if (words.length) line.words = words;
    lines.push(line);
  }
  return lines.sort((a, b) => a.time - b.time);
}

export class WhisperXProvider implements LyricsProvider {
  readonly name = "whisperx";

  isConfigured(): boolean {
    return Boolean(process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_WHISPERX_VERSION);
  }

  async submit(vocalUrl: string): Promise<LyricsSubmitResult> {
    if (!this.isConfigured()) throw new Error("WhisperX (Replicate) não configurado");
    const input: Record<string, unknown> = { audio_file: vocalUrl, align_output: true };
    if (process.env.WHISPER_LANGUAGE) input.language = process.env.WHISPER_LANGUAGE;

    const res = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ version: process.env.REPLICATE_WHISPERX_VERSION, input }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`WhisperX submit falhou (${res.status}): ${detail}`);
    }
    const data = (await res.json()) as { id: string };
    return { providerJobId: data.id };
  }

  async poll(providerJobId: string): Promise<LyricsPollResult> {
    const res = await fetch(`${API}/${providerJobId}`, {
      headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
    });
    if (!res.ok) return { status: "failed", error: `WhisperX status ${res.status}` };

    const job = (await res.json()) as { status: string; output?: unknown; error?: string };
    if (job.status === "failed" || job.status === "canceled") {
      return { status: "failed", error: job.error ?? "WhisperX reportou falha" };
    }
    if (job.status !== "succeeded") return { status: "running" };

    const lines = parseSegments(job.output);
    if (lines.length === 0) return { status: "failed", error: "Nenhuma linha transcrita" };
    return { status: "done", lines };
  }
}
