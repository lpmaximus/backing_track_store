/**
 * Factory do provider de separação. O resto do app importa daqui,
 * nunca da implementação concreta.
 */
import type { SeparationProvider } from "./types";
import { ReplicateSeparationProvider } from "./replicate";

let instance: SeparationProvider | null = null;

export function getSeparationProvider(): SeparationProvider {
  if (!instance) {
    // Único provider na Fase 1.5. Para trocar, basta instanciar outra classe aqui.
    instance = new ReplicateSeparationProvider();
  }
  return instance;
}

export type * from "./types";
