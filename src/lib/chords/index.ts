/**
 * Factory do provider de detecção de cifra. O resto do app importa daqui.
 *
 * Escolha do provider por env `CHORDS_PROVIDER`:
 *   "btc"      → BTCChordProvider (self-hosted no Replicate, ~US$0,005/música)
 *   "musicai"  → MusicAiChordProvider (padrão histórico, ~US$0,14/música)
 * Sem a env, mantém "musicai" para não mudar o comportamento atual sem querer.
 * Assim dá pra testar BTC lado a lado só trocando a variável de ambiente.
 */
import type { ChordDetectionProvider } from "./types";
import { MusicAiChordProvider } from "./musicai";
import { BTCChordProvider } from "./btc";

let instance: ChordDetectionProvider | null = null;

function build(): ChordDetectionProvider {
  const choice = (process.env.CHORDS_PROVIDER || "musicai").toLowerCase();
  switch (choice) {
    case "btc":
      return new BTCChordProvider();
    case "musicai":
    default:
      return new MusicAiChordProvider();
  }
}

export function getChordProvider(): ChordDetectionProvider {
  if (!instance) instance = build();
  return instance;
}

export type * from "./types";
