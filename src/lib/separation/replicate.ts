/**
 * Implementação Replicate (Demucs) do SeparationProvider.
 *
 * Usa fetch nativo — não precisa do SDK `replicate` (evita dependência extra e
 * problemas de instalação). Assíncrono nativo: iniciamos uma "prediction" e o
 * Replicate chama nosso webhook quando termina.
 *
 * Variáveis de ambiente:
 *   REPLICATE_API_TOKEN       — token da conta Replicate
 *   REPLICATE_DEMUCS_VERSION  — hash da versão do modelo Demucs a usar
 *   REPLICATE_WEBHOOK_SECRET  — secret (whsec_...) para validar a assinatura
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  SeparationProvider,
  SeparationSubmitInput,
  SeparationSubmitResult,
  NormalizedSeparationWebhook,
  SeparatedStem,
} from "./types";

const API = "https://api.replicate.com/v1/predictions";

// Mapa saída-do-Demucs → (instrument, label PT-BR).
// Ajustar conforme o modelo escolhido no Replicate.
//
// Usamos model_name=htdemucs_6s (ver submit() abaixo), que separa 6 stems:
// vocals, drums, bass, guitar, piano, other. Guitarra ganha stem próprio.
// "piano" é OMITIDO de propósito: o modelo de 6 stems extrai o teclado de
// dentro do "outros", mas sem remixar os dois de volta (não fazemos isso —
// exigiria processar áudio no servidor) o teclado simplesmente não aparece
// na faixa reconstruída. Decisão aceita: só a guitarra fica isolada, o
// teclado deixa de ser ouvido nas músicas que tiverem esse instrumento.
const STEM_MAP: Record<string, { instrument: string; label: string }> = {
  vocals: { instrument: "vocal", label: "Vocal" },
  drums: { instrument: "drums", label: "Bateria" },
  bass: { instrument: "bass", label: "Baixo" },
  guitar: { instrument: "guitar", label: "Guitarra" },
  other: { instrument: "harmony", label: "Harmonia" },
};

function mapStems(output: unknown): SeparatedStem[] {
  // Demucs no Replicate costuma devolver um objeto { vocals, drums, bass, other }
  // com URLs. Parse defensivo para tolerar variações do modelo.
  const stems: SeparatedStem[] = [];
  if (output && typeof output === "object" && !Array.isArray(output)) {
    for (const [rawKey, value] of Object.entries(output as Record<string, unknown>)) {
      const key = rawKey.toLowerCase();
      if (typeof value === "string" && STEM_MAP[key]) {
        stems.push({ ...STEM_MAP[key], audioUrl: value });
      }
    }
  }
  return stems;
}

export class ReplicateSeparationProvider implements SeparationProvider {
  readonly name = "replicate_demucs";

  async submit(input: SeparationSubmitInput): Promise<SeparationSubmitResult> {
    const token = process.env.REPLICATE_API_TOKEN;
    const version = process.env.REPLICATE_DEMUCS_VERSION;
    if (!token || !version) {
      throw new Error("REPLICATE_API_TOKEN / REPLICATE_DEMUCS_VERSION não configurados");
    }

    const res = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version,
        // htdemucs_6s em vez do padrão htdemucs (4 stems) — é o que faz o
        // modelo devolver "guitar" como stem separado (ver STEM_MAP acima).
        input: { audio: input.audioUrl, model_name: "htdemucs_6s" },
        webhook: input.webhookUrl,
        webhook_events_filter: ["completed"],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Replicate submit falhou (${res.status}): ${detail}`);
    }

    const data = (await res.json()) as { id: string };
    return { providerJobId: data.id };
  }

  /**
   * Verifica a assinatura no padrão de webhooks do Replicate (svix):
   * base string = `${webhook-id}.${webhook-timestamp}.${body}`,
   * HMAC-SHA256 com o secret (base64 após "whsec_"), comparado ao header
   * `webhook-signature` (pode conter vários "v1,<sig>" separados por espaço).
   */
  async verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
    const secret = process.env.REPLICATE_WEBHOOK_SECRET;
    if (!secret) return false;

    const id = headers.get("webhook-id");
    const timestamp = headers.get("webhook-timestamp");
    const signatureHeader = headers.get("webhook-signature");
    if (!id || !timestamp || !signatureHeader) return false;

    const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    const signedContent = `${id}.${timestamp}.${rawBody}`;
    const expected = createHmac("sha256", secretBytes)
      .update(signedContent)
      .digest("base64");

    // O header traz uma ou mais assinaturas: "v1,<b64> v1,<b64> ..."
    const provided = signatureHeader
      .split(" ")
      .map((part) => part.split(",")[1])
      .filter(Boolean);

    const expBuf = Buffer.from(expected);
    return provided.some((sig) => {
      const sigBuf = Buffer.from(sig);
      return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
    });
  }

  parseWebhook(rawBody: string): NormalizedSeparationWebhook {
    const payload = JSON.parse(rawBody) as {
      id: string;
      status: string;
      output?: unknown;
      error?: string;
    };

    let status: NormalizedSeparationWebhook["status"] = "running";
    if (payload.status === "succeeded") status = "done";
    else if (payload.status === "failed" || payload.status === "canceled") status = "failed";

    return {
      providerJobId: payload.id,
      status,
      stems: status === "done" ? mapStems(payload.output) : [],
      errorMessage: payload.error,
    };
  }
}
