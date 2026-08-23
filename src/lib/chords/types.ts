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
  /**
   * true = a string `chords` foi POSICIONADA por uma pessoa (o espaçamento é a
   * posição sobre a letra) e deve ser renderizada literalmente naquela linha.
   * Antes isso era adivinhado a partir do espaçamento da string, o que fazia
   * "D C D7" (espaço simples, o exemplo do próprio editor) ser tratado como
   * saída automática e ter os acordes redistribuídos por tempo — embaralhando
   * a correção manual. Agora o editor marca explicitamente.
   */
  aligned?: boolean;
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
  // `meta` também na falha: bpm/tom/batidas são calculados na MESMA execução do
  // detector e não dependem de a cifra ter saído. Descartá-los junto com a cifra
  // era o motivo de "Tom ?" e "BPM 0" nas músicas em que a detecção falhava.
  | { status: "failed"; error: string; meta?: ChordMeta };

export interface ChordDetectionProvider {
  readonly name: string;
  /** true se as env vars necessárias estão presentes. */
  isConfigured(): boolean;
  /** Cria o job de detecção sobre a URL de áudio dada. */
  submit(audioUrl: string): Promise<ChordDetectionSubmitResult>;
  /** Consulta o job; devolve running/done(seções)/failed. */
  poll(providerJobId: string): Promise<ChordPollResult>;
}
