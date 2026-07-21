/**
 * Implementação Music.ai do ChordDetectionProvider (Frente C).
 *
 * Fluxo (polling): POST /job cria o job com um workflow que devolve acordes;
 * GET /job/{id} até status SUCCEEDED; baixa o JSON de resultado e converte para
 * ChordSection[] (o formato que a página da música já sabe exibir).
 *
 * Env vars:
 *   MUSICAI_API_KEY          — chave da conta Music.ai
 *   MUSICAI_CHORDS_WORKFLOW  — slug do workflow de acordes criado na sua conta
 *   MUSICAI_CHORDS_OUTPUT    — (opcional) nome da saída do workflow; default "chords"
 *
 * Observação: o formato exato do JSON de acordes depende do workflow. O parser
 * abaixo é defensivo (aceita variações comuns de nomes de campo). Depois do 1º
 * teste real, ajuste `parseChordPayload` se os nomes vierem diferentes.
 */
import type {
  ChordDetectionProvider,
  ChordDetectionSubmitResult,
  ChordPollResult,
  ChordSection,
} from "./types";

const API = "https://api.music.ai/api";

interface DetectedChord {
  start: number;
  label: string;
}

/** Extrai [{start,label}] de formatos variados de saída de acordes. */
function parseChordPayload(payload: unknown): DetectedChord[] {
  // Aceita: array direto, ou { chords: [...] }, ou { result: [...] }
  let arr: unknown = payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const o = payload as Record<string, unknown>;
    arr = o.chords ?? o.result ?? o.segments ?? o.data ?? [];
  }
  if (!Array.isArray(arr)) return [];

  const out: DetectedChord[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const start = Number(o.start ?? o.time ?? o.timestamp ?? o.begin ?? 0);
    const labelRaw = o.chord ?? o.label ?? o.value ?? o.name;
    const label = typeof labelRaw === "string" ? labelRaw.trim() : "";
    if (!label || label.toUpperCase() === "N" || label === "N.C.") continue; // ignora "sem acorde"
    if (Number.isFinite(start)) out.push({ start, label });
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Agrupa acordes em seções curtas (4 por linha) no formato ChordSection. */
function toSections(chords: DetectedChord[]): ChordSection[] {
  // Colapsa repetições consecutivas do mesmo acorde.
  const collapsed: DetectedChord[] = [];
  for (const c of chords) {
    if (collapsed.length && collapsed[collapsed.length - 1].label === c.label) continue;
    collapsed.push(c);
  }
  const sections: ChordSection[] = [];
  const PER_LINE = 4;
  for (let i = 0; i < collapsed.length; i += PER_LINE) {
    const group = collapsed.slice(i, i + PER_LINE);
    sections.push({
      section: "", // detecção automática não conhece verso/refrão — fica vazio
      timecode: Math.round(group[0].start),
      chords: group.map((g) => g.label).join(" "),
    });
  }
  return sections;
}

export class MusicAiChordProvider implements ChordDetectionProvider {
  readonly name = "musicai";

  isConfigured(): boolean {
    return Boolean(process.env.MUSICAI_API_KEY && process.env.MUSICAI_CHORDS_WORKFLOW);
  }

  private headers() {
    return {
      Authorization: process.env.MUSICAI_API_KEY as string,
      "Content-Type": "application/json",
    };
  }

  async submit(audioUrl: string): Promise<ChordDetectionSubmitResult> {
    if (!this.isConfigured()) throw new Error("Music.ai não configurado");
    const res = await fetch(`${API}/job`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        name: `chords-${Date.now()}`,
        workflow: process.env.MUSICAI_CHORDS_WORKFLOW,
        params: { inputUrl: audioUrl },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Music.ai submit falhou (${res.status}): ${detail}`);
    }
    const data = (await res.json()) as { id: string };
    return { providerJobId: data.id };
  }

  async poll(providerJobId: string): Promise<ChordPollResult> {
    const res = await fetch(`${API}/job/${providerJobId}`, { headers: this.headers() });
    if (!res.ok) {
      return { status: "failed", error: `Music.ai status ${res.status}` };
    }
    const job = (await res.json()) as {
      status: string;
      result?: Record<string, unknown>;
      error?: string;
    };

    if (job.status === "FAILED") {
      return { status: "failed", error: job.error ?? "Music.ai reportou falha" };
    }
    if (job.status !== "SUCCEEDED") {
      return { status: "running" };
    }

    // Resultado pronto: pega a URL da saída de acordes e baixa o JSON.
    const outputName = process.env.MUSICAI_CHORDS_OUTPUT || "chords";
    const outUrl = job.result?.[outputName] ?? Object.values(job.result ?? {})[0];
    if (typeof outUrl !== "string") {
      return { status: "failed", error: "Music.ai sem URL de resultado de acordes" };
    }
    const payloadRes = await fetch(outUrl);
    if (!payloadRes.ok) {
      return { status: "failed", error: `Falha ao baixar acordes (${payloadRes.status})` };
    }
    const payload = await payloadRes.json();
    const sections = toSections(parseChordPayload(payload));
    if (sections.length === 0) {
      return { status: "failed", error: "Nenhum acorde detectado" };
    }
    return { status: "done", sections };
  }
}
