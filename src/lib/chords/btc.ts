/**
 * Implementação BTC (Bi-directional Transformer for Chord Recognition) via
 * Replicate — alternativa caseira/barata ao Music.ai (Frente C).
 *
 * Roda um modelo BTC self-hosted no Replicate SOBRE O STEM DE HARMONIA já
 * isolado. Custo = só compute (~US$0,005/música), contra ~US$0,14 do Music.ai.
 * Mesmo padrão de POLLING do Whisper de letra (predição sem webhook, consultada
 * em /api/chords/advance) — não colide com o webhook de separação.
 *
 * Contrato de saída esperado do modelo (ver replicate/btc-chords/predict.py):
 *   preferível: JSON array [{ "start": <seg>, "end": <seg>, "chord": "C:maj" }, …]
 *   também aceito: texto .lab ("start end label" por linha) ou URL p/ um desses.
 * O parser é defensivo e normaliza os labels do BTU ("C:maj"→"C", "A:min"→"Am").
 *
 * Env vars:
 *   REPLICATE_API_TOKEN  — token da conta Replicate (já usado pela separação/letra)
 *   REPLICATE_BTC_VERSION — hash da versão do seu modelo BTC publicado no Replicate
 */
import type {
  ChordDetectionProvider,
  ChordDetectionSubmitResult,
  ChordPollResult,
  ChordMeta,
} from "./types";
import { toSections, type DetectedChord } from "./sections";

const API = "https://api.replicate.com/v1/predictions";

/** Converte um label do BTC ("C:maj", "A:min7", "G:maj/3") p/ cifra ("C", "Am7", "G"). */
function normalizeLabel(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "";
  // Ignora "sem acorde".
  const upper = trimmed.toUpperCase();
  if (upper === "N" || upper === "X" || upper === "N.C.") return "";

  // Descarta a inversão/baixo ("C:maj/3" → "C:maj") p/ manter o rótulo limpo.
  const base = trimmed.split("/")[0];
  const [root, quality] = base.split(":");
  if (!quality) return root; // já vem como "C" ou "Am"

  const map: Record<string, string> = {
    maj: "", major: "",
    min: "m", minor: "m",
    dim: "dim", aug: "aug",
    "6": "6", maj6: "6", min6: "m6",
    "7": "7", maj7: "maj7", min7: "m7", minmaj7: "m(maj7)",
    dim7: "dim7", hdim7: "m7b5",
    sus2: "sus2", sus4: "sus4",
    "9": "9", maj9: "maj9", min9: "m9",
  };
  const q = quality.toLowerCase();
  const suffix = q in map ? map[q] : quality;
  return root + suffix;
}

/** Faz parse de uma linha .lab: "start end label" ou "start label". */
function parseLabLine(line: string): DetectedChord | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const start = Number(parts[0]);
  const label = normalizeLabel(parts[parts.length - 1]);
  if (!Number.isFinite(start) || !label) return null;
  return { start, label };
}

/** Extrai [{start,label}] de JSON array, texto .lab, ou objeto {chords:[...]}. */
function parseBtcChords(data: unknown): DetectedChord[] {
  // Desembrulha { chords / result / segments / data / output: [...] }.
  let arr: unknown = data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    arr = o.chords ?? o.result ?? o.segments ?? o.data ?? o.output ?? [];
  }

  // Texto .lab inteiro.
  if (typeof arr === "string") {
    return arr
      .split(/\r?\n/)
      .map(parseLabLine)
      .filter((c): c is DetectedChord => c !== null);
  }

  if (!Array.isArray(arr)) return [];

  const out: DetectedChord[] = [];
  for (const item of arr) {
    if (typeof item === "string") {
      const parsed = parseLabLine(item);
      if (parsed) out.push(parsed);
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    let start: number;
    if (Array.isArray(o.timestamp)) start = Number(o.timestamp[0]);
    else start = Number(o.start ?? o.time ?? o.begin ?? 0);
    const raw = o.chord ?? o.label ?? o.value ?? o.name;
    const label = normalizeLabel(typeof raw === "string" ? raw : "");
    if (label && Number.isFinite(start)) out.push({ start, label });
  }
  return out;
}

/** Extrai bpm/tom/batidas do objeto de saída do BTC (quando presente). */
function extractMeta(data: unknown): ChordMeta | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined;
  const o = data as Record<string, unknown>;
  const meta: ChordMeta = {};
  const bpm = Number(o.bpm);
  if (Number.isFinite(bpm) && bpm > 0) meta.bpm = Math.round(bpm);
  if (typeof o.key === "string" && o.key.trim()) meta.key = o.key.trim();
  if (Array.isArray(o.beats)) {
    const beats = o.beats.map(Number).filter((n) => Number.isFinite(n));
    if (beats.length) meta.beats = beats;
  }
  return Object.keys(meta).length ? meta : undefined;
}

/** Se a saída for uma URL, baixa; tenta JSON e cai p/ texto (.lab). */
async function resolveOutput(output: unknown): Promise<unknown> {
  if (typeof output === "string" && /^https?:\/\//i.test(output.trim())) {
    const res = await fetch(output.trim());
    if (!res.ok) throw new Error(`Falha ao baixar saída BTC (${res.status})`);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  // Replicate às vezes devolve output como array de 1 elemento (a URL/arquivo).
  if (Array.isArray(output) && output.length === 1 && typeof output[0] === "string") {
    return resolveOutput(output[0]);
  }
  return output;
}

export class BTCChordProvider implements ChordDetectionProvider {
  readonly name = "btc";

  isConfigured(): boolean {
    return Boolean(process.env.REPLICATE_API_TOKEN && process.env.REPLICATE_BTC_VERSION);
  }

  async submit(audioUrl: string): Promise<ChordDetectionSubmitResult> {
    if (!this.isConfigured()) throw new Error("BTC (Replicate) não configurado");
    const res = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      // Sem webhook — consultado por polling em /api/chords/advance.
      body: JSON.stringify({
        version: process.env.REPLICATE_BTC_VERSION,
        input: { audio: audioUrl },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`BTC submit falhou (${res.status}): ${detail}`);
    }
    const data = (await res.json()) as { id: string };
    return { providerJobId: data.id };
  }

  async poll(providerJobId: string): Promise<ChordPollResult> {
    const res = await fetch(`${API}/${providerJobId}`, {
      headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
    });
    if (!res.ok) return { status: "failed", error: `BTC status ${res.status}` };

    const job = (await res.json()) as { status: string; output?: unknown; error?: string };
    if (job.status === "failed" || job.status === "canceled") {
      return { status: "failed", error: job.error ?? "BTC reportou falha" };
    }
    if (job.status !== "succeeded") return { status: "running" };

    try {
      const resolved = await resolveOutput(job.output);
      const sections = toSections(parseBtcChords(resolved));
      if (sections.length === 0) return { status: "failed", error: "Nenhum acorde detectado" };
      return { status: "done", sections, meta: extractMeta(resolved) };
    } catch (err) {
      return { status: "failed", error: String(err).slice(0, 300) };
    }
  }
}
