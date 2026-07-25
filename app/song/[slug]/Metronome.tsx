"use client";

/**
 * Metrônomo sincronizado: toca um clique em cada batida (`beats`, tempos em s),
 * seguindo o `currentTime` real do player — então acompanha velocidade, pausa,
 * seek e loop automaticamente. Sem lib: Web Audio API (oscilador curto).
 * Acentua a cada 4ª batida (assume 4/4). Não renderiza nada.
 */
import { useEffect, useRef } from "react";

export default function Metronome({
  beats, currentTime, enabled, volume = 0.6,
}: {
  beats: number[];
  currentTime: number;
  enabled: boolean;
  volume?: number;
}) {
  const ctxRef = useRef<AudioContext | null>(null);
  const idxRef = useRef(0);
  const lastRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    if (!ctxRef.current && typeof window !== "undefined" && "AudioContext" in window) {
      ctxRef.current = new AudioContext();
    }
    ctxRef.current?.resume().catch(() => {});
  }, [enabled]);

  useEffect(() => {
    if (!enabled || beats.length === 0) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const t = currentTime;

    // Seek/loop pra trás → recalcula o índice da próxima batida.
    if (t < lastRef.current - 0.25) {
      let i = 0;
      while (i < beats.length && beats[i] < t) i++;
      idxRef.current = i;
    }
    lastRef.current = t;

    // Toca as batidas que já passaram desde o último frame (sem "rajada" em seek).
    while (idxRef.current < beats.length && beats[idxRef.current] <= t) {
      const bi = idxRef.current;
      if (t - beats[bi] < 0.2) click(ctx, bi % 4 === 0, volume);
      idxRef.current++;
    }
  }, [currentTime, enabled, beats, volume]);

  return null;
}

function click(ctx: AudioContext, accent: boolean, volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = accent ? 1600 : 1050;
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(volume * (accent ? 1 : 0.65), now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.06);
}
