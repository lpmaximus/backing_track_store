"use client";

import type * as React from "react";
import { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";

export type Stem = {
  id: number;
  instrument: string;
  label: string | null;
  audioUrl: string;
};

type Props = {
  audioUrl: string | null;
  stems: Stem[];
  isPro?: boolean;
  // Trilha-guia da banda: se definido e existir um stem com esse instrumento,
  // o player inicia com todas as outras trilhas mutadas (soft — o membro pode
  // reativar qualquer uma). Ver page.tsx / SongPlayer.
  soloInstrument?: string | null;
  songTitle: string;
  songArtist: string;
  onTimeUpdate?: (t: number) => void;
  onDurationReady?: (d: number) => void;
  // Velocidade e pitch são controlados pelo SongPlayer (controles ficam na
  // coluna direita). O player só LÊ esses valores pra o motor de áudio.
  speed?: number;
  pitch?: number;
};

// ─── Aparência por instrumento ────────────────────────────────────────────────
// "harmony" é o stem residual (tudo que não é bateria/baixo/vocal/guitarra —
// hoje predominantemente teclado/outros instrumentos). Precisa de ícone, cor
// e rótulo PRÓPRIOS e diferentes de "guitar", senão as duas faixas ficam
// visualmente idênticas na mesa de mixagem (foi exatamente o bug reportado:
// "2 guitarras" — era o stem de harmonia sendo forçado a se passar por guitarra).
const STEM_ICONS: Record<string, string> = {
  drums: "🥁", bass: "🎸", guitar: "🎸", harmony: "🎹", melody: "🎺", vocal: "🎤",
};
// Rótulo exibido por instrumento — por padrão usa o label do banco
// (`s.label`); só sobrescreve aqui se precisar de um nome fixo diferente.
const STEM_LABELS: Record<string, string> = {};
const STEM_COLORS: Record<string, string> = {
  vocal: "#3aa3ff", drums: "#7c5cff", bass: "#22d3b0",
  harmony: "#8b5cf6", melody: "#ea580c", guitar: "#f59e0b",
};
const DEFAULT_COLOR = "#8a8a8c";

function colorFor(instrument: string) { return STEM_COLORS[instrument] ?? DEFAULT_COLOR; }
function iconFor(instrument: string) { return STEM_ICONS[instrument] ?? "🎵"; }

function formatTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

// ─── Peaks a partir de um AudioBuffer ─────────────────────────────────────────
// Reduz o buffer a `samples` picos normalizados (0..1) para desenhar a onda.
function computePeaks(buffer: AudioBuffer, samples: number): number[] {
  const ch = buffer.getChannelData(0);
  const block = Math.max(1, Math.floor(ch.length / samples));
  const peaks = new Array<number>(samples).fill(0);
  let max = 0;
  for (let i = 0; i < samples; i++) {
    let m = 0;
    const start = i * block;
    for (let j = 0; j < block; j++) {
      const v = Math.abs(ch[start + j] ?? 0);
      if (v > m) m = v;
    }
    peaks[i] = m;
    if (m > max) max = m;
  }
  if (max > 0) for (let i = 0; i < samples; i++) peaks[i] /= max;
  return peaks;
}

// Combina vários arrays de peaks num só (média) — usado no modo mix.
function mergePeaks(list: number[][]): number[] {
  if (list.length === 0) return [];
  const n = list[0].length;
  const out = new Array<number>(n).fill(0);
  for (const p of list) for (let i = 0; i < n; i++) out[i] += p[i] ?? 0;
  let max = 0;
  for (let i = 0; i < n; i++) { out[i] /= list.length; if (out[i] > max) max = out[i]; }
  if (max > 0) for (let i = 0; i < n; i++) out[i] /= max;
  return out;
}

// ─── Onda em canvas ───────────────────────────────────────────────────────────
const WaveCanvas = memo(function WaveCanvas({
  peaks, color, height, dimmed,
}: { peaks: number[]; color: string; height: number; dimmed: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || peaks.length === 0) return;
    const W = 1000, H = height;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = color;
    const barW = W / peaks.length;
    const gap = barW > 3 ? 1 : 0;
    for (let i = 0; i < peaks.length; i++) {
      const bh = Math.max(1, peaks[i] * (H - 2));
      ctx.fillRect(i * barW, (H - bh) / 2, Math.max(1, barW - gap), bh);
    }
  }, [peaks, color, height]);
  return (
    <canvas
      ref={ref}
      style={{ width: "100%", height, display: "block", opacity: dimmed ? 0.22 : 1, transition: "opacity 0.2s" }}
    />
  );
});

// ─── Tipos internos do motor ──────────────────────────────────────────────────
type ToneMod = typeof import("tone");
type Track = { key: string; instrument: string; label: string; audioUrl: string };

type Engine = {
  Tone: ToneMod;
  players: Record<string, import("tone").Player>;
  vols: Record<string, import("tone").Volume>;
  master: import("tone").Volume;
  pitch: import("tone").PitchShift;
  duration: number;
  offset: number;      // posição de áudio (s) no último play/seek
  ctxStart: number;    // Tone.now() no último play
  playing: boolean;
  pitchActive: boolean;
};

export default function WavePlayer({
  audioUrl, stems, isPro = false, soloInstrument = null, songTitle, songArtist, onTimeUpdate, onDurationReady, speed = 1, pitch = 0,
}: Props) {
  // Faixas de áudio a carregar. Com stems, cada stem é uma faixa; senão, o mix.
  const tracks: Track[] = useMemo(() => {
    if (stems.length > 0) {
      return stems.map(s => ({
        key: s.instrument,
        instrument: s.instrument,
        label: STEM_LABELS[s.instrument] ?? s.label ?? s.instrument,
        audioUrl: s.audioUrl,
      }));
    }
    if (audioUrl) return [{ key: "mix", instrument: "mix", label: songTitle, audioUrl }];
    return [];
  }, [stems, audioUrl, songTitle]);

  // Multitrack visível só para PRO com stems separados.
  const showMultitrack = isPro && stems.length > 0;
  const hasAudio = tracks.length > 0;

  const engineRef = useRef<Engine | null>(null);
  const rafRef = useRef<number | null>(null);

  const [ready,     setReady]     = useState(false);
  const [playing,   setPlaying]   = useState(false);
  const [current,   setCurrent]   = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [volume,    setVolume]    = useState(0.85);
  // speed/pitch agora vêm por prop (controlados pelo SongPlayer / coluna direita).
  const [trackVol,  setTrackVol]  = useState<Record<string, number>>({});
  const [muted,     setMuted]     = useState<Record<string, boolean>>({});
  const [soloed,    setSoloed]    = useState<Record<string, boolean>>({});
  const [peaks,     setPeaks]     = useState<Record<string, number[]>>({});
  const [mixPeaks,  setMixPeaks]  = useState<number[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryKey,  setRetryKey]  = useState(0);
  const [loop,      setLoop]      = useState(false); // repetir a música até parar

  // Refs espelho para uso dentro do loop de animação / callbacks
  const speedRef = useRef(speed);   useEffect(() => { speedRef.current = speed; }, [speed]);
  const durRef   = useRef(0);       useEffect(() => { durRef.current = duration; }, [duration]);
  const loopRef  = useRef(false);   useEffect(() => { loopRef.current = loop; }, [loop]);

  const posNow = useCallback(() => {
    const e = engineRef.current;
    if (!e) return 0;
    return e.playing ? e.offset + (e.Tone.now() - e.ctxStart) * speedRef.current : e.offset;
  }, []);

  // ── Carga do motor Tone.js ──────────────────────────────────────────────────
  useEffect(() => {
    if (!hasAudio) return;
    let destroyed = false;
    setReady(false);
    setLoadError(null);

    (async () => {
      const Tone = await import("tone");
      if (destroyed) return;

      const master = new Tone.Volume(Tone.gainToDb(0.85));
      const pitchNode = new Tone.PitchShift({ pitch: 0, windowSize: 0.1 });
      master.toDestination(); // pitch começa bypassado (0 st)

      const players: Record<string, import("tone").Player> = {};
      const vols: Record<string, import("tone").Volume> = {};
      let failed = false;

      await Promise.all(tracks.map(t => new Promise<void>(resolve => {
        const vol = new Tone.Volume(0);
        vol.connect(master);
        vols[t.key] = vol;
        const player = new Tone.Player({
          url: t.audioUrl,
          onload: () => resolve(),
          onerror: () => { failed = true; resolve(); },
        });
        player.connect(vol);
        players[t.key] = player;
      })));

      if (destroyed) { Object.values(players).forEach(p => p.dispose()); return; }
      if (failed) { setLoadError("Não foi possível carregar o áudio desta música."); return; }

      // Duração + peaks
      let dur = 0;
      const pk: Record<string, number[]> = {};
      const res = showMultitrack ? 240 : 500;
      for (const t of tracks) {
        const buf = players[t.key].buffer.get() as AudioBuffer | undefined;
        if (buf) {
          dur = Math.max(dur, buf.duration);
          pk[t.key] = computePeaks(buf, res);
        }
      }

      engineRef.current = {
        Tone, players, vols, master, pitch: pitchNode,
        duration: dur, offset: 0, ctxStart: 0, playing: false, pitchActive: false,
      };
      setPeaks(pk);
      setMixPeaks(mergePeaks(Object.values(pk)));
      setDuration(dur);
      setReady(true);
      onDurationReady?.(dur);
    })();

    return () => {
      destroyed = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const e = engineRef.current;
      if (e) {
        Object.values(e.players).forEach(p => { try { p.stop(); } catch {} p.dispose(); });
        Object.values(e.vols).forEach(v => v.dispose());
        e.master.dispose();
        e.pitch.dispose();
      }
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, retryKey]);

  // ── Loop de posição ───────────────────────────────────────────────────────
  const startRaf = useCallback(() => {
    const tick = () => {
      const e = engineRef.current;
      if (!e) return;
      const pos = posNow();
      if (pos >= durRef.current && durRef.current > 0) {
        if (loopRef.current) {
          // Repetir: reinicia do zero sem parar (o scroll Automático volta ao topo sozinho).
          e.offset = 0;
          const at = e.Tone.now() + 0.02;
          Object.values(e.players).forEach(p => { p.playbackRate = speedRef.current; try { p.stop(); } catch {} p.start(at, 0); });
          e.ctxStart = at;
          setCurrent(0); onTimeUpdate?.(0);
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        // fim: para e volta ao início
        Object.values(e.players).forEach(p => { try { p.stop(); } catch {} });
        e.playing = false; e.offset = 0;
        setPlaying(false); setCurrent(0); onTimeUpdate?.(0);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        return;
      }
      setCurrent(pos);
      onTimeUpdate?.(pos);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [posNow, onTimeUpdate]);

  // ── Pitch/velocidade → nó PitchShift ──────────────────────────────────────
  // playbackRate r desloca o tom em +12·log2(r); compensamos para manter o tom.
  const applyPitch = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    const effective = pitch - 12 * Math.log2(speed);
    e.pitch.pitch = effective;
    const shouldBeActive = Math.abs(effective) > 0.01;
    if (shouldBeActive && !e.pitchActive) {
      e.master.disconnect();
      e.master.connect(e.pitch);
      e.pitch.toDestination();
      e.pitchActive = true;
    } else if (!shouldBeActive && e.pitchActive) {
      e.master.disconnect();
      e.pitch.disconnect();
      e.master.toDestination();
      e.pitchActive = false;
    }
  }, [pitch, speed]);

  useEffect(() => { applyPitch(); }, [applyPitch]);

  // ── Transporte ────────────────────────────────────────────────────────────
  const play = useCallback(async () => {
    const e = engineRef.current;
    if (!e) return;
    await e.Tone.start();
    const at = e.Tone.now() + 0.05;
    Object.values(e.players).forEach(p => {
      p.playbackRate = speedRef.current;
      try { p.stop(); } catch {}
      p.start(at, e.offset);
    });
    e.ctxStart = at;
    e.playing = true;
    setPlaying(true);
    startRaf();
  }, [startRaf]);

  const pause = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    e.offset = posNow();
    Object.values(e.players).forEach(p => { try { p.stop(); } catch {} });
    e.playing = false;
    setPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, [posNow]);

  const togglePlay = useCallback(() => {
    if (!engineRef.current) return;
    if (engineRef.current.playing) pause(); else play();
  }, [play, pause]);

  const seek = useCallback((t: number) => {
    const e = engineRef.current;
    if (!e) return;
    const clamped = Math.max(0, Math.min(t, e.duration));
    const wasPlaying = e.playing;
    Object.values(e.players).forEach(p => { try { p.stop(); } catch {} });
    e.offset = clamped;
    setCurrent(clamped);
    onTimeUpdate?.(clamped);
    if (wasPlaying) {
      const at = e.Tone.now() + 0.05;
      Object.values(e.players).forEach(p => p.start(at, clamped));
      e.ctxStart = at;
    }
  }, [onTimeUpdate]);

  // Re-ancora a velocidade sem cortar o áudio.
  useEffect(() => {
    const e = engineRef.current;
    if (!e) { applyPitch(); return; }
    if (e.playing) {
      e.offset = posNow();
      const at = e.Tone.now() + 0.05;
      Object.values(e.players).forEach(p => { try { p.stop(); } catch {} p.playbackRate = speed; p.start(at, e.offset); });
      e.ctxStart = at;
    } else {
      Object.values(e.players).forEach(p => { p.playbackRate = speed; });
    }
    applyPitch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  // ── Volumes / mute / solo ─────────────────────────────────────────────────
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    e.master.volume.value = e.Tone.gainToDb(volume);
  }, [volume, ready]);

  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    const anySolo = Object.values(soloed).some(Boolean);
    for (const t of tracks) {
      const v = e.vols[t.key];
      if (!v) continue;
      const on = anySolo ? !!soloed[t.key] : !muted[t.key];
      const g = trackVol[t.key] ?? 1;
      v.volume.value = on ? e.Tone.gainToDb(Math.max(0.0001, g)) : -Infinity;
    }
  }, [muted, soloed, trackVol, tracks, ready]);

  // ── Trilha-guia da banda (pré-mute) ───────────────────────────────────────
  // Quando o player abre via setlist da banda com ?solo=<instrumento>, muta
  // todas as trilhas exceto a do integrante — uma única vez, quando fica pronto.
  // É soft: o membro pode reativar qualquer trilha na mesa depois.
  const soloAppliedRef = useRef(false);
  useEffect(() => {
    if (soloAppliedRef.current) return;
    if (!ready || !soloInstrument) return;
    const hasTrack = tracks.some(t => t.key === soloInstrument);
    if (!hasTrack) return;
    setMuted(Object.fromEntries(tracks.filter(t => t.key !== soloInstrument).map(t => [t.key, true])));
    soloAppliedRef.current = true;
  }, [ready, soloInstrument, tracks]);

  // ── Atalho espaço ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement) return;
      if (ev.code === "Space") { ev.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay]);

  // M e S são mutuamente exclusivos por faixa: ligar um desliga o outro.
  const toggleMute = (k: string) => {
    setMuted(p => ({ ...p, [k]: !p[k] }));
    setSoloed(p => (p[k] ? { ...p, [k]: false } : p));
  };
  const toggleSolo = (k: string) => {
    setSoloed(p => ({ ...p, [k]: !p[k] }));
    setMuted(p => (p[k] ? { ...p, [k]: false } : p));
  };

  const pct = duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;
  const anySolo = Object.values(soloed).some(Boolean);

  // Pula `delta` segundos a partir da posição atual (avançar/voltar).
  const skip = (delta: number) => seek(posNow() + delta);

  const proGate = (label: string) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
      background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
      borderRadius: 8, fontSize: 13, color: "var(--muted)",
    }}>
      <span className="pro-badge">PRO</span>
      <span>{label} disponível no plano Pro.</span>
      <a href="/planos" style={{ color: "var(--accent)", fontWeight: 700, marginLeft: "auto" }}>Testar grátis</a>
    </div>
  );

  // Clique-para-seek numa área de onda.
  const onWaveClick = (ev: React.MouseEvent<HTMLDivElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const frac = (ev.clientX - rect.left) / rect.width;
    seek(frac * duration);
  };

  const PlayButton = (
    <button onClick={togglePlay} disabled={!ready && hasAudio}
      style={{
        width: 42, height: 42, borderRadius: "50%",
        background: ready || !hasAudio ? "var(--accent)" : "var(--surface3)",
        color: "#000", border: "none", fontSize: 17, cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
      title="Espaço"
    >
      {!ready && hasAudio ? "..." : playing ? "❚❚" : "▶"}
    </button>
  );

  const LoopButton = (
    <button onClick={() => setLoop(v => !v)} disabled={!ready} aria-label="Repetir" title="Repetir a música até parar"
      style={{
        width: 34, height: 34, borderRadius: "50%",
        background: loop ? "var(--accent)" : "var(--surface2)",
        border: `1px solid ${loop ? "var(--accent)" : "var(--border2)"}`,
        color: loop ? "#000" : (ready ? "var(--text)" : "var(--muted2)"),
        fontSize: 14, fontWeight: 700, cursor: ready ? "pointer" : "default",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      🔁
    </button>
  );

  const skipBtn = (delta: number, label: string, aria: string) => (
    <button onClick={() => skip(delta)} disabled={!ready} aria-label={aria} title={aria}
      style={{
        width: 34, height: 34, borderRadius: "50%",
        background: "var(--surface2)", border: "1px solid var(--border2)",
        color: ready ? "var(--text)" : "var(--muted2)", fontSize: 12, fontWeight: 700,
        cursor: ready ? "pointer" : "default",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ─── Painel principal ─── */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>

        {/* Estados especiais */}
        {!hasAudio ? (
          <div style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14 }}>
            Sem base disponível para esta música.
          </div>
        ) : loadError ? (
          <div style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--danger)", fontSize: 13 }}>
            <span>⚠ {loadError}</span>
            <button onClick={() => setRetryKey(k => k + 1)}
              style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer", color: "var(--text)", fontWeight: 600 }}>
              Tentar novamente
            </button>
          </div>
        ) : showMultitrack ? (
          /* ─── Modo multitrack (Moises) ─── */
          <>
            {/* Barra de transporte */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              {skipBtn(-10, "«", "Voltar 10 segundos")}
              {PlayButton}
              {skipBtn(10, "»", "Avançar 10 segundos")}
              {LoopButton}
              <span style={{ color: "var(--muted)", fontSize: 12, fontFamily: "var(--font-mono, monospace)", minWidth: 92 }}>
                {formatTime(current)} / {formatTime(duration)}
              </span>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>Volume Master</span>
                <input type="range" min={0} max={1} step={0.05} value={volume}
                  onChange={e => setVolume(Number(e.target.value))} style={{ width: 84 }} aria-label="Volume Master" />
              </div>
            </div>

            {/* Faixas + playhead */}
            <div style={{ position: "relative" }}>
              {tracks.map(t => {
                const on = anySolo ? !!soloed[t.key] : !muted[t.key];
                const isMuted = !!muted[t.key];
                const isSolo = !!soloed[t.key];
                const g = trackVol[t.key] ?? 1;
                return (
                  <div key={t.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 16px", borderBottom: "1px solid var(--border)" }}>
                    {/* M / S */}
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button onClick={() => toggleMute(t.key)} aria-label={`Mudo ${t.label}`}
                        style={{ width: 26, height: 26, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                          background: isMuted ? "var(--danger)" : "var(--surface2)",
                          border: `1px solid ${isMuted ? "var(--danger)" : "var(--border2)"}`,
                          color: isMuted ? "#fff" : "var(--muted)" }}>M</button>
                      <button onClick={() => toggleSolo(t.key)} aria-label={`Solo ${t.label}`}
                        style={{ width: 26, height: 26, borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer",
                          background: isSolo ? "var(--pro)" : "var(--surface2)",
                          border: `1px solid ${isSolo ? "var(--pro)" : "var(--border2)"}`,
                          color: isSolo ? "#000" : "var(--muted)" }}>S</button>
                    </div>
                    {/* ícone + nome */}
                    <div style={{ width: 118, display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
                      <span style={{ fontSize: 17, opacity: on ? 1 : 0.4 }}>{iconFor(t.instrument)}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: on ? "var(--text)" : "var(--muted2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</span>
                    </div>
                    {/* volume da faixa */}
                    <input type="range" min={0} max={1} step={0.02} value={g}
                      onChange={e => setTrackVol(p => ({ ...p, [t.key]: Number(e.target.value) }))}
                      style={{ width: 64, flexShrink: 0 }} aria-label={`Volume ${t.label}`} />
                    {/* onda (clique = seek) */}
                    <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={onWaveClick}>
                      <WaveCanvas peaks={peaks[t.key] ?? []} color={colorFor(t.instrument)} height={40} dimmed={!on} />
                    </div>
                  </div>
                );
              })}
              {/* Playhead alinhado ao início real da coluna de ondas:
                  pad 16 + M/S 56 + gap 10 + nome 118 + gap 10 + vol 64 + gap 10 = 284px;
                  o percurso vai de 284px até (100% - 16px de pad direito). */}
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `calc(284px + (100% - 300px) * ${pct} / 100)`, width: 2, background: "var(--accent)", pointerEvents: "none", opacity: ready ? 1 : 0 }} />
            </div>
          </>
        ) : (
          /* ─── Modo single (mix) ─── */
          <>
            <div style={{ padding: "14px 18px 0" }}>
              <div style={{ position: "relative", cursor: "pointer", opacity: ready ? 1 : 0.3, transition: "opacity 0.3s" }} onClick={onWaveClick}>
                <WaveCanvas peaks={mixPeaks} color="var(--accent)" height={56} dimmed={false} />
                <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pct}%`, width: 2, background: "var(--accent)", pointerEvents: "none" }} />
              </div>
            </div>
            <div style={{ padding: "12px 18px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "var(--muted)", fontSize: 12, minWidth: 36, textAlign: "right" }}>{formatTime(current)}</span>
                <div style={{ flex: 1, position: "relative", height: 4 }}>
                  <div style={{ height: "100%", borderRadius: 2, background: "var(--surface3)", overflow: "hidden" }}>
                    <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: "var(--accent)", borderRadius: 2 }} />
                  </div>
                  <input type="range" min={0} max={duration || 0} step={0.1} value={current}
                    onChange={e => seek(Number(e.target.value))}
                    style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", height: "100%" }} aria-label="Posição" />
                </div>
                <span style={{ color: "var(--muted)", fontSize: 12, minWidth: 36 }}>{formatTime(duration)}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {skipBtn(-10, "«", "Voltar 10 segundos")}
                {PlayButton}
                {skipBtn(10, "»", "Avançar 10 segundos")}
              {LoopButton}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{songTitle}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>{songArtist}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>Vol</span>
                  <input type="range" min={0} max={1} step={0.05} value={volume}
                    onChange={e => setVolume(Number(e.target.value))} style={{ width: 72 }} aria-label="Volume" />
                </div>
                <kbd style={{ background: "var(--surface2)", border: "1px solid var(--border2)", padding: "3px 8px", borderRadius: 5, fontSize: 11, color: "var(--muted2)", flexShrink: 0 }}>Espaço</kbd>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Velocidade e Pitch foram movidos pra a coluna direita (SongPlayer). */}

      {/* Gate de stems para quem não é PRO */}
      {!isPro && stems.length > 0 && proGate("Faixas isoladas (bateria, baixo, guitarra, vocal)")}

    </div>
  );
}
