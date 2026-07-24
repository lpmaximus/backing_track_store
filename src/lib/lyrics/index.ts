/**
 * Factory do provider de transcrição de letra (caminho 3). O resto do app
 * importa daqui.
 *
 * Escolha por env `LYRICS_PROVIDER`:
 *   "whisperx" → WhisperXProvider (tempo por PALAVRA — necessário p/ cifra sobre
 *                a sílaba estilo CifraClub). Modelo público victor-upmeet/whisperx.
 *   "whisper"  → ReplicateWhisperProvider (tempo só por linha; padrão histórico).
 * Sem a env, mantém "whisper" para não mudar o comportamento atual sem querer.
 */
import type { LyricsProvider } from "./types";
import { ReplicateWhisperProvider } from "./replicate-whisper";
import { WhisperXProvider } from "./whisperx";

let instance: LyricsProvider | null = null;

function build(): LyricsProvider {
  const choice = (process.env.LYRICS_PROVIDER || "whisper").toLowerCase();
  switch (choice) {
    case "whisperx":
      return new WhisperXProvider();
    case "whisper":
    default:
      return new ReplicateWhisperProvider();
  }
}

export function getLyricsProvider(): LyricsProvider {
  if (!instance) instance = build();
  return instance;
}

export type * from "./types";
