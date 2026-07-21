/**
 * Factory do provider de detecção de cifra. O resto do app importa daqui.
 */
import type { ChordDetectionProvider } from "./types";
import { MusicAiChordProvider } from "./musicai";

let instance: ChordDetectionProvider | null = null;

export function getChordProvider(): ChordDetectionProvider {
  if (!instance) instance = new MusicAiChordProvider();
  return instance;
}

export type * from "./types";
