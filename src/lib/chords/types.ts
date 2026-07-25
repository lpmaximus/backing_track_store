/**
 * Contrato do provider de detecção de cifra (Fase 1.5, Frente C).
 *
 * Diferente da separação (Replicate, webhook), o Music.ai trabalha por FILA
 * ASSÍNCRONA com POLLING: você cria um job e fica consultando o status até
 * terminar. Por isso a interface tem `poll` em vez de `parseWebhook`.
 */

export interface ChordSection {
  section: string; // rótulo do trecho ("Verso", "Refrão"… ou vazio p/ auto)
  timecode: number; // segundos a partir do início
  chords: string; // "Am G F E"
  times?: number[]; // tempo (s) de cada acorde em `chords` — p/ cifra sobre a sílaba
}

export interface ChordDetectionSubmitResult {
  providerJobId: string;
}

/** Metadados extras que alguns providers detectam junto (BTC: bpm/tom/batidas). */
export interface ChordMeta {
  bpm?: number;
  key?: string;
  beats?: number[]; // tempos (s) de cada batida — p/ o metrônomo
}

export type ChordPollResult =
  | { status: "running" }
  | { status: "done"; sections: ChordSection[]; meta?: ChordMeta }
  | { status: "failed"; error: string };

export interface ChordDetectionProvider {
  readonly name: string;
  /** true se as env vars necessárias estão presentes. */
  isConfigured(): boolean;
  /** Cria o job de detecção sobre a URL de áudio dada. */
  submit(audioUrl: string): Promise<ChordDetectionSubmitResult>;
  /** Consulta o job; devolve running/done(seções)/failed. */
  poll(providerJobId: string): Promise<ChordPollResult>;
}
