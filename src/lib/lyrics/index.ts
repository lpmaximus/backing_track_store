/**
 * Factory do provider de transcrição de letra (caminho 3). O resto do app
 * importa daqui.
 */
import type { LyricsProvider } from "./types";
import { ReplicateWhisperProvider } from "./replicate-whisper";

let instance: LyricsProvider | null = null;

export function getLyricsProvider(): LyricsProvider {
  if (!instance) instance = new ReplicateWhisperProvider();
  return instance;
}

export type * from "./types";
