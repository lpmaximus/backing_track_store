/**
 * Contrato do provider de separação de stems (Fase 1.5).
 *
 * Nenhuma outra parte do código deve falar com o Replicate (ou futuro provider)
 * diretamente — sempre via esta interface. Trocar de provider = nova implementação,
 * zero mudança no resto do app.
 */

export interface SeparationSubmitInput {
  audioUrl: string; // URL pública do mix original no R2
  songId: number; // referência para reconciliar no webhook
  webhookUrl: string; // callback público que o provider vai chamar
}

export interface SeparationSubmitResult {
  providerJobId: string; // id da prediction no provider (idempotência do webhook)
}

/** Um stem separado, já no formato que a tabela `stems` espera. */
export interface SeparatedStem {
  instrument: string; // drums | bass | harmony | melody | vocal
  label: string; // rótulo PT-BR ("Bateria", "Baixo"…)
  audioUrl: string; // URL pública do stem
}

/** Payload já normalizado a partir do webhook cru do provider. */
export interface NormalizedSeparationWebhook {
  providerJobId: string;
  status: "done" | "failed" | "running";
  stems: SeparatedStem[];
  errorMessage?: string;
}

export interface SeparationProvider {
  readonly name: string;
  /** Inicia a separação (assíncrona). */
  submit(input: SeparationSubmitInput): Promise<SeparationSubmitResult>;
  /** Valida a assinatura do webhook. Retorna true se o payload é autêntico. */
  verifyWebhook(headers: Headers, rawBody: string): Promise<boolean>;
  /** Converte o corpo cru do webhook no formato normalizado. */
  parseWebhook(rawBody: string): NormalizedSeparationWebhook;
}
