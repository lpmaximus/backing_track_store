"use client";

/**
 * Motor de execução contínua do modo palco (Fase S3 / ADR-BTS-005, §6).
 *
 * Toca o setlist inteiro em sequência: enquanto a música N está no ar, os
 * stems da N+1 já estão carregados na memória (Tone.Player pronto, sem play),
 * e os da N-1 já foram descartados — é a regra exata do ADR ("carrega N+1,
 * descarta N-1"), decidida por computePreloadActions (stagePreload.ts), o
 * módulo testado ANTES de qualquer linha de Tone.js entrar em cena.
 *
 * Este hook reaproveita o desenho de motor do WavePlayer (players/vols/master/
 * pitch por faixa, offset+ctxStart para calcular posição, playbackRate para
 * velocidade com correção de pitch) — a diferença é que aqui há N desses
 * motores, um por música, geridos por índice, e a troca de um para o outro é
 * automática (fim de música → intervalo → próxima).
 *
 * Wake lock: o modo palco existe para tocar sem tirar as mãos do instrumento;
 * a tela apagar no meio do show é o oposto do que a funcionalidade promete.
 * Pedido ao entrar em "playing", liberado ao pausar/sair, e pedido de novo se
 * o navegador o revogar sozinho ao voltar de outro app (visibilitychange).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { computePreloadActions } from "@/src/lib/stagePreload";
import type { ResolvedStem } from "@/src/lib/mix";

export type StageStem = { instrument: string; label: string | null; audioUrl: string };

export type StageSong = {
  setlistSongId: number;
  position: number;
  songId: number;
  slug: string;
  title: string;
  artist: string;
  key: string;
  bpm: number;
  duration: number;
  thumbnailUrl: string | null;
  transposeSemitones: number;
  speed: number;
  gapSeconds: number;
  stems: StageStem[];
  mix: ResolvedStem[];
  cifraText: string | null;
  chords: { section: string; timecode: number; chords: string; times?: number[] }[] | null;
  lyrics: { time: number; text: string; words?: { text: string; start: number; end: number }[] }[] | null;
};

export type StagePhase = "idle" | "loading" | "playing" | "paused" | "gap" | "finished";

type ToneMod = typeof import("tone");

type SongBuffer = {
  Tone: ToneMod;
  players: Record<string, import("tone").Player>;
  vols: Record<string, import("tone").Volume>;
  master: import("tone").Volume;
  pitch: import("tone").PitchShift;
  duration: number;
  offset: number;
  ctxStart: number;
  playing: boolean;
  pitchActive: boolean;
  ready: boolean;
  failed: boolean;
};

const AHEAD = 1; // janela deslizante: só a próxima música fica pré-carregada

function disposeBuffer(buf: SongBuffer | undefined) {
  if (!buf) return;
  Object.values(buf.players).forEach((p) => { try { p.stop(); } catch { /* já parado */ } p.dispose(); });
  Object.values(buf.vols).forEach((v) => v.dispose());
  try { buf.master.dispose(); } catch { /* noop */ }
  try { buf.pitch.dispose(); } catch { /* noop */ }
}

export function useStageEngine(songs: StageSong[]) {
  const total = songs.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<StagePhase>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [gapRemaining, setGapRemaining] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Contador sem outro propósito além de forçar um novo render quando um
  // buffer termina de carregar — "ready" mora numa ref (buffersRef), então o
  // React não sabe sozinho que precisa recalcular `currentReady` abaixo. Sem
  // isto, o botão de play só atualizava a aparência quando outra coisa (fase,
  // erro) também mudava de estado.
  const [, setLoadTick] = useState(0);

  const buffersRef = useRef<Map<number, SongBuffer>>(new Map());
  const loadingRef = useRef<Set<number>>(new Set());
  const rafRef = useRef<number | null>(null);
  const gapTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const phaseRef = useRef<StagePhase>("idle");
  const currentIndexRef = useRef(0);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  // ── Wake lock ──────────────────────────────────────────────────────────────
  const requestWakeLock = useCallback(async () => {
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<WakeLockSentinel> } }).wakeLock.request("screen");
      }
    } catch { /* navegador sem suporte, ou permissão negada — segue sem travar a tela */ }
  }, []);
  const releaseWakeLock = useCallback(() => {
    try { wakeLockRef.current?.release(); } catch { /* já liberado */ }
    wakeLockRef.current = null;
  }, []);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible" && phaseRef.current === "playing" && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [requestWakeLock]);

  // ── Carga de uma música (stems → Tone.Player) ─────────────────────────────
  const loadSong = useCallback(async (index: number) => {
    if (index < 0 || index >= total) return;
    if (buffersRef.current.has(index) || loadingRef.current.has(index)) return;
    const song = songs[index];
    if (!song || song.stems.length === 0) return;
    loadingRef.current.add(index);

    const Tone = await import("tone");
    const master = new Tone.Volume(Tone.gainToDb(0.85));
    const pitchNode = new Tone.PitchShift({ pitch: 0, windowSize: 0.1 });
    master.toDestination();

    const players: Record<string, import("tone").Player> = {};
    const vols: Record<string, import("tone").Volume> = {};
    let failed = false;

    await Promise.all(song.stems.map((s) => new Promise<void>((resolve) => {
      const vol = new Tone.Volume(0);
      vol.connect(master);
      vols[s.instrument] = vol;
      const player = new Tone.Player({
        url: s.audioUrl,
        onload: () => resolve(),
        onerror: () => { failed = true; resolve(); },
      });
      player.connect(vol);
      players[s.instrument] = player;
    })));

    let dur = 0;
    for (const s of song.stems) {
      const buf = players[s.instrument]?.buffer.get() as AudioBuffer | undefined;
      if (buf) dur = Math.max(dur, buf.duration);
    }

    // Mixagem resolvida do servidor (3 camadas) aplicada uma vez, na carga —
    // no palco não há mesa pessoal por música: o preparo já veio pronto.
    for (const m of song.mix) {
      const v = vols[m.stemKey];
      if (!v) continue;
      const on = m.state !== "mute";
      v.volume.value = on ? Tone.gainToDb(Math.max(0.0001, m.volume / 100)) : -Infinity;
    }
    // "solo": se alguma faixa está em solo, as demais (sem solo) mutam.
    const anySolo = song.mix.some((m) => m.state === "solo");
    if (anySolo) {
      for (const m of song.mix) {
        const v = vols[m.stemKey];
        if (!v) continue;
        v.volume.value = m.state === "solo" ? Tone.gainToDb(Math.max(0.0001, m.volume / 100)) : -Infinity;
      }
    }

    const buffer: SongBuffer = {
      Tone, players, vols, master, pitch: pitchNode,
      duration: dur, offset: 0, ctxStart: 0, playing: false, pitchActive: false,
      ready: !failed, failed,
    };
    buffersRef.current.set(index, buffer);
    loadingRef.current.delete(index);
    setLoadTick((t) => t + 1); // ver comentário no state acima

    if (index === currentIndexRef.current) {
      if (failed) setLoadError("Não foi possível carregar o áudio desta música.");
      else setLoadError(null);
    }
  }, [songs, total]);

  // ── Janela deslizante: recalcula a cada troca de índice ───────────────────
  const applyPreloadWindow = useCallback((index: number) => {
    const loadedAndLoading = new Set<number>([...buffersRef.current.keys(), ...loadingRef.current]);
    const { toLoad, toDispose } = computePreloadActions(loadedAndLoading, index, total, { ahead: AHEAD });
    for (const i of toDispose) {
      disposeBuffer(buffersRef.current.get(i));
      buffersRef.current.delete(i);
    }
    for (const i of toLoad) loadSong(i);
  }, [loadSong, total]);

  useEffect(() => {
    applyPreloadWindow(currentIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, total]);

  // Limpa tudo ao desmontar (sair do modo palco).
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (gapTimerRef.current) clearInterval(gapTimerRef.current);
      if (waitTimerRef.current) clearInterval(waitTimerRef.current);
      for (const buf of buffersRef.current.values()) disposeBuffer(buf);
      buffersRef.current.clear();
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  // ── Transporte da música atual ────────────────────────────────────────────
  const posNow = useCallback((buf: SongBuffer) => {
    const song = songs[currentIndexRef.current];
    const speed = song?.speed ?? 1;
    return buf.playing ? buf.offset + (buf.Tone.now() - buf.ctxStart) * speed : buf.offset;
  }, [songs]);

  const applyPitch = useCallback((buf: SongBuffer, transposeSemitones: number, speed: number) => {
    const effective = transposeSemitones - 12 * Math.log2(speed || 1);
    buf.pitch.pitch = effective;
    const shouldBeActive = Math.abs(effective) > 0.01;
    if (shouldBeActive && !buf.pitchActive) {
      buf.master.disconnect(); buf.master.connect(buf.pitch); buf.pitch.toDestination(); buf.pitchActive = true;
    } else if (!shouldBeActive && buf.pitchActive) {
      buf.master.disconnect(); buf.pitch.disconnect(); buf.master.toDestination(); buf.pitchActive = false;
    }
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  const advance = useCallback(() => {
    stopRaf();
    const nextIndex = currentIndexRef.current + 1;
    if (nextIndex >= total) {
      setPhase("finished");
      releaseWakeLock();
      return;
    }
    // Continuar tocando sozinho é o ponto central do modo palco — sem isto, a
    // troca de música só atualiza a tela e a próxima fica esperando o usuário
    // apertar play de novo (mesma classe de bug do "play não sai som").
    wantsAutoplayRef.current = true;
    setCurrentIndex(nextIndex);
    setCurrentTime(0);
    // playBuffer(nextIndex) é chamado pelo efeito que observa currentIndex,
    // via waitAndPlay — logo abaixo.
  }, [stopRaf, total, releaseWakeLock]);

  const startGap = useCallback((seconds: number) => {
    setPhase("gap");
    setGapRemaining(seconds);
    if (gapTimerRef.current) clearInterval(gapTimerRef.current);
    gapTimerRef.current = setInterval(() => {
      setGapRemaining((s) => {
        if (s <= 1) {
          if (gapTimerRef.current) clearInterval(gapTimerRef.current);
          advance();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }, [advance]);

  const skipGap = useCallback(() => {
    if (gapTimerRef.current) clearInterval(gapTimerRef.current);
    advance();
  }, [advance]);

  const tick = useCallback(() => {
    const buf = buffersRef.current.get(currentIndexRef.current);
    const song = songs[currentIndexRef.current];
    if (!buf || !song) return;
    const pos = posNow(buf);

    if (pos >= buf.duration && buf.duration > 0) {
      Object.values(buf.players).forEach((p) => { try { p.stop(); } catch { /* noop */ } });
      buf.playing = false;
      setCurrentTime(buf.duration);
      if (song.gapSeconds > 0) startGap(song.gapSeconds);
      else advance();
      return;
    }
    setCurrentTime(pos);
    rafRef.current = requestAnimationFrame(tick);
  }, [posNow, songs, startGap, advance]);

  const playBuffer = useCallback((index: number) => {
    const buf = buffersRef.current.get(index);
    const song = songs[index];
    if (!buf || !song || !buf.ready) return false;
    applyPitch(buf, song.transposeSemitones, song.speed);
    const at = buf.Tone.now() + 0.05;
    Object.values(buf.players).forEach((p) => {
      p.playbackRate = song.speed || 1;
      try { p.stop(); } catch { /* noop */ }
      p.start(at, buf.offset);
    });
    buf.ctxStart = at;
    buf.playing = true;
    setPhase("playing");
    stopRaf();
    rafRef.current = requestAnimationFrame(tick);
    return true;
  }, [songs, applyPitch, stopRaf, tick]);

  // Espera a música ficar pronta (ou falhar) e então dá play — chamada tanto
  // por play() quanto pela troca de índice (skipNext/skipPrev/goTo). Fica num
  // ref, não num efeito preso a [currentIndex]: um efeito só reage a MUDANÇA
  // de índice, e não disparava quando o usuário apertava play na MESMA música
  // que já estava carregando — é o bug do "play não sai som, fica carregando
  // pra sempre" (a música terminava de carregar em segundo plano, mas nada
  // acionava o playBuffer depois).
  const wantsAutoplayRef = useRef(false);
  const waitAndPlay = useCallback((index: number) => {
    if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
    const buf = buffersRef.current.get(index);
    if (buf?.ready) {
      wantsAutoplayRef.current = false;
      playBuffer(index);
      return;
    }
    if (buf?.failed) {
      wantsAutoplayRef.current = false;
      setLoadError("Não foi possível carregar o áudio desta música.");
      return;
    }
    setPhase("loading");
    loadSong(index); // no-op se já estiver carregando (guard em loadSong)
    waitTimerRef.current = setInterval(() => {
      if (index !== currentIndexRef.current) {
        // o usuário pulou para outra música enquanto esta ainda carregava.
        if (waitTimerRef.current) clearInterval(waitTimerRef.current);
        waitTimerRef.current = null;
        return;
      }
      const b = buffersRef.current.get(index);
      if (b?.ready) {
        if (waitTimerRef.current) clearInterval(waitTimerRef.current);
        waitTimerRef.current = null;
        wantsAutoplayRef.current = false;
        playBuffer(index);
      } else if (b?.failed) {
        if (waitTimerRef.current) clearInterval(waitTimerRef.current);
        waitTimerRef.current = null;
        wantsAutoplayRef.current = false;
        setLoadError("Não foi possível carregar o áudio desta música.");
      }
    }, 300);
  }, [playBuffer, loadSong]);

  // Navegação (skipNext/skipPrev/goTo) muda o índice enquanto se está tocando
  // — aqui sim faz sentido reagir à mudança, para a próxima música dar play
  // sozinha assim que estiver pronta.
  useEffect(() => {
    if (!wantsAutoplayRef.current) return;
    waitAndPlay(currentIndex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // ── Ações públicas ─────────────────────────────────────────────────────────
  const play = useCallback(async () => {
    const Tone = await import("tone");
    await Tone.start();
    requestWakeLock();
    setLoadError(null);
    wantsAutoplayRef.current = true;
    waitAndPlay(currentIndex);
  }, [currentIndex, requestWakeLock, waitAndPlay]);

  const pause = useCallback(() => {
    stopRaf();
    if (gapTimerRef.current) clearInterval(gapTimerRef.current);
    if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
    const buf = buffersRef.current.get(currentIndex);
    if (buf) {
      buf.offset = posNow(buf);
      Object.values(buf.players).forEach((p) => { try { p.stop(); } catch { /* noop */ } });
      buf.playing = false;
    }
    wantsAutoplayRef.current = false;
    setPhase("paused");
    releaseWakeLock();
  }, [currentIndex, posNow, stopRaf, releaseWakeLock]);

  const togglePlayPause = useCallback(() => {
    if (phase === "playing" || phase === "gap") pause();
    else play();
  }, [phase, play, pause]);

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= total) return;
    stopRaf();
    if (gapTimerRef.current) clearInterval(gapTimerRef.current);
    if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
    const cur = buffersRef.current.get(currentIndex);
    if (cur) { Object.values(cur.players).forEach((p) => { try { p.stop(); } catch { /* noop */ } }); cur.playing = false; cur.offset = 0; }
    const wasPlaying = phase === "playing" || phase === "gap" || phase === "loading";
    setCurrentIndex(index);
    setCurrentTime(0);
    setGapRemaining(0);
    wantsAutoplayRef.current = wasPlaying;
    if (!wasPlaying) setPhase("paused");
  }, [currentIndex, phase, stopRaf]);

  const skipNext = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex]);
  const skipPrev = useCallback(() => goTo(currentIndex - 1), [goTo, currentIndex]);

  const stop = useCallback(() => {
    stopRaf();
    if (gapTimerRef.current) clearInterval(gapTimerRef.current);
    if (waitTimerRef.current) { clearInterval(waitTimerRef.current); waitTimerRef.current = null; }
    for (const buf of buffersRef.current.values()) disposeBuffer(buf);
    buffersRef.current.clear();
    releaseWakeLock();
    setPhase("idle");
    setCurrentIndex(0);
    setCurrentTime(0);
  }, [stopRaf, releaseWakeLock]);

  const currentSong = songs[currentIndex] ?? null;
  const nextSong = songs[currentIndex + 1] ?? null;
  const currentReady = buffersRef.current.get(currentIndex)?.ready ?? false;

  return {
    total,
    currentIndex,
    currentSong,
    nextSong,
    phase,
    currentTime,
    duration: currentSong?.duration ?? 0,
    gapRemaining,
    loadError,
    currentReady,
    play,
    pause,
    togglePlayPause,
    skipNext,
    skipPrev,
    skipGap,
    stop,
  };
}
