/**
 * Contrato do provider de transcrição de letra (caminho 3).
 *
 * Roda sobre o STEM DE VOCAL já separado pelo Demucs — voz isolada transcreve
 * muito melhor e é barata. Como o Music.ai (cifra), trabalha por POLLING:
 * cria a predição e consulta o status até terminar. A letra automática nasce
 * como rascunho e é refinada pela comunidade (mesmo modelo da cifra).
 */

export interface LyricsWord {
  text: string;  // a palavra
  start: number; // segundos — início da palavra
  end: number;   // segundos — fim da palavra
}

export interface LyricsLine {
  time: number; // segundos a partir do início (início da linha)
  text: string; // texto da linha cantada
  words?: LyricsWord[]; // tempo por palavra (WhisperX) — permite cifra sobre a sílaba
}

export interface LyricsSubmitResult {
  providerJobId: string;
}

export type LyricsPollResult =
  | { status: "running" }
  | { status: "done"; lines: LyricsLine[] }
  | { status: "failed"; error: string };

export interface LyricsProvider {
  readonly name: string;
  /** true se as env vars necessárias estão presentes. */
  isConfigured(): boolean;
  /** Cria o job de transcrição sobre a URL do stem de vocal. */
  submit(vocalUrl: string): Promise<LyricsSubmitResult>;
  /** Consulta o job; devolve running/done(linhas)/failed. */
  poll(providerJobId: string): Promise<LyricsPollResult>;
}
