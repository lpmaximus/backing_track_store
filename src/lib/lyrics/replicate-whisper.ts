/**
 * Implementação Whisper (Replicate) do LyricsProvider — caminho 3.
 *
 * Roda Whisper sobre o STEM DE VOCAL isolado (não o mix), o que melhora muito a
 * transcrição de canto e mantém o custo em centavos por música. Diferente da
 * separação (Demucs, que usa webhook), aqui usamos POLLING: criamos a predição
 * SEM webhook e consultamos o status em /api/lyrics/advance — assim não colide
 * com o webhook de separação.
 *
 * Env vars:
 *   REPLICATE_API_TOKEN       — token da conta Replicate (já usado pela separação)
 *   REPLICATE_WHISPER_VERSION — hash da versão do modelo Whisper no Replicate
 *   WHISPER_LANGUAGE          — (opcional) idioma forçado, ex. "pt" (default: auto)
 *
 * O formato de saída varia conforme o modelo Whisper escolhido. `parseSegments`
 * é defensivo (aceita segments/chunks e nomes de campo comuns). Depois do 1º
 * teste real, ajuste se os campos vierem diferentes.
 */
import type { LyricsProvider, LyricsSubmitResult, LyricsPollResult, LyricsLine } from "./types";

const API = "https://api.replicate.com/v1/predictions";

/** Extrai linhas [{time,text}] de formatos variados de saída do Whisper. */
function parseSegments(output: unknown): LyricsLine[] {
  let arr: unknown = output;
  if (output && typeof output === "object" && !Array.isArray(output)) {
    const o = output as Record<string, unknown>;
    arr = o.segments ?? o.chunks ?? o.result ?? o.transcription ?? [];
  }
  if (!Array.isArray(arr)) return [];

  const lines: LyricsLine[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    // Whisper: {start,end,text}. incredibly-fast-whisper: {timestamp:[start,end], text}.
    let start: number | undefined;
    if (Array.isArray(o.timestamp)) start = Number(o.timestamp[0]);
    else start = Number(o.start ?? o.begin ?? o.time ?? 0);
    const textRaw = o.text ?? o.value;
    const text = typeof textRaw === "string" ? textRaw.trim() : "";
    if (text && Number.isFinite(start)) lines.push({ time: Number(start), text });
  }
  return lines.sort((a, b) => a.time - b.time);
}

export class ReplicateWhisperProvider implements LyricsProvider {
  readonly name = "replicate_whisper";

  isConfigured(): boolean {
    return Boolean(process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_WHISPER_VERSION);
  }

  async submit(vocalUrl: string): Promise<LyricsSubmitResult> {
    if (!this.isConfigured()) throw new Error("Whisper (Replicate) não configurado");
    const input: Record<string, unknown> = { audio: vocalUrl };
    if (process.env.WHISPER_LANGUAGE) input.language = process.env.WHISPER_LANGUAGE;

    const res = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      // Sem webhook — este job é consultado por polling em /api/lyrics/advance.
      body: JSON.stringify({ version: process.env.REPLICATE_WHISPER_VERSION, input }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Whisper submit falhou (${res.status}): ${detail}`);
    }
    const data = (await res.json()) as { id: string };
    return { providerJobId: data.id };
  }

  async poll(providerJobId: string): Promise<LyricsPollResult> {
    const res = await fetch(`${API}/${providerJobId}`, {
      headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
    });
    if (!res.ok) return { status: "failed", error: `Whisper status ${res.status}` };

    const job = (await res.json()) as { status: string; output?: unknown; error?: string };
    if (job.status === "failed" || job.status === "canceled") {
      return { status: "failed", error: job.error ?? "Whisper reportou falha" };
    }
    if (job.status !== "succeeded") return { status: "running" };

    const lines = parseSegments(job.output);
    if (lines.length === 0) return { status: "failed", error: "Nenhuma linha transcrita" };
    return { status: "done", lines };
  }
}
