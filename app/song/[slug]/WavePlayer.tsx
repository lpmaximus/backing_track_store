"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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
  songTitle: string;
  songArtist: string;
  onTimeUpdate?: (t: number) => void;
  onDurationReady?: (d: number) => void;
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

const STEM_ICONS: Record<string, string> = {
  drums: "🥁", bass: "🎸", guitar: "🎵", harmony: "🎹", melody: "🎤",
};

export default function WavePlayer({
  audioUrl, stems, isPro = false, songTitle, songArtist, onTimeUpdate, onDurationReady,
}: Props) {
  const waveRef = useRef<HTMLDivElement>(null);
  const wsRef   = useRef<import("wavesurfer.js").default | null>(null);

  const [ready,     setReady]     = useState(false);
  const [playing,   setPlaying]   = useState(false);
  const [current,   setCurrent]   = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [volume,    setVolume]    = useState(0.85);
  const [speed,     setSpeed]     = useState(1);
  const [pitch,     setPitch]     = useState(0);
  const [stemMuted, setStemMuted] = useState<Record<string, boolean>>({});

  // WaveSurfer init
  useEffect(() => {
    if (!waveRef.current || !audioUrl) return;
    let ws: import("wavesurfer.js").default;
    let destroyed = false;

    (async () => {
      const WaveSurfer = (await import("wavesurfer.js")).default;
      ws = WaveSurfer.create({
        container: waveRef.current!,
        waveColor: "#3a3a3a",
        progressColor: "#1db954",
        cursorColor: "#1db954",
        cursorWidth: 2,
        height: 56,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        normalize: true,
        backend: "WebAudio",
      });

      ws.on("ready", () => {
        if (destroyed) return;
        const d = ws.getDuration();
        setDuration(d);
        setReady(true);
        onDurationReady?.(d);
        ws.setVolume(volume);
      });

      ws.on("timeupdate", (t: number) => {
        if (destroyed) return;
        setCurrent(t);
        onTimeUpdate?.(t);
      });

      ws.on("play",   () => { if (!destroyed) setPlaying(true); });
      ws.on("pause",  () => { if (!destroyed) setPlaying(false); });
      ws.on("finish", () => { if (!destroyed) setPlaying(false); });

      await ws.load(audioUrl);
      wsRef.current = ws;
    })();

    return () => {
      destroyed = true;
      ws?.destroy();
      wsRef.current = null;
    };
  }, [audioUrl]); // eslint-disable-line

  useEffect(() => { wsRef.current?.setVolume(volume); }, [volume]);

  useEffect(() => {
    if (!isPro) return;
    wsRef.current?.setPlaybackRate(speed, true);
  }, [speed, isPro]);

  const togglePlay = useCallback(() => { wsRef.current?.playPause(); }, []);

  const seek = useCallback((t: number) => {
    const dur = wsRef.current?.getDuration() ?? 0;
    if (dur > 0) wsRef.current?.seekTo(t / dur);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay]);

  const proGate = (label: string) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "10px 14px",
      background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
      borderRadius: 8, fontSize: 13, color: "var(--muted)",
    }}>
      <span className="pro-badge">PRO</span>
      <span>{label} disponivel no plano Pro.</span>
      <a href="/planos" style={{ color: "var(--accent)", fontWeight: 700, marginLeft: "auto" }}>Testar gratis</a>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Waveform panel */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px 0" }}>
          {!audioUrl ? (
            <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 14 }}>
              Sem base disponivel para esta musica.
            </div>
          ) : (
            <div ref={waveRef} style={{ opacity: ready ? 1 : 0.3, transition: "opacity 0.3s" }} />
          )}
        </div>

        <div style={{ padding: "12px 18px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Progress */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--muted)", fontSize: 12, minWidth: 36, textAlign: "right" }}>{formatTime(current)}</span>
            <div style={{ flex: 1, position: "relative", height: 4 }}>
              <div style={{ height: "100%", borderRadius: 2, background: "var(--surface3)", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, width: `${duration > 0 ? (current / duration) * 100 : 0}%`, background: "var(--accent)", borderRadius: 2 }} />
              </div>
              <input type="range" min={0} max={duration} step={0.5} value={current}
                onChange={e => seek(Number(e.target.value))}
                style={{ position: "absolute", inset: 0, width: "100%", opacity: 0, cursor: "pointer", height: "100%" }} />
            </div>
            <span style={{ color: "var(--muted)", fontSize: 12, minWidth: 36 }}>{formatTime(duration)}</span>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={togglePlay} disabled={!ready && !!audioUrl}
              style={{
                width: 42, height: 42, borderRadius: "50%",
                background: ready || !audioUrl ? "var(--accent)" : "var(--surface3)",
                color: "#000", border: "none", fontSize: 17, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}
              title="Espaco"
            >
              {!ready && audioUrl ? "..." : playing ? "||" : ">"}
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{songTitle}</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>{songArtist}</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Vol</span>
              <input type="range" min={0} max={1} step={0.05} value={volume}
                onChange={e => setVolume(Number(e.target.value))} style={{ width: 72 }} />
            </div>

            <kbd style={{ background: "var(--surface2)", border: "1px solid var(--border2)", padding: "3px 8px", borderRadius: 5, fontSize: 11, color: "var(--muted2)", flexShrink: 0 }}>Espaco</kbd>
          </div>
        </div>
      </div>

      {/* Speed control */}
      {isPro ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)" }}>VELOCIDADE</span>
            <span className="pro-badge">PRO</span>
            <span style={{ marginLeft: "auto", color: "var(--text)", fontWeight: 700, fontSize: 14 }}>{speed}x</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>0.75x</span>
            <input type="range" min={0.75} max={1.25} step={0.05} value={speed}
              onChange={e => setSpeed(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ color: "var(--muted)", fontSize: 12 }}>1.25x</span>
            <button onClick={() => setSpeed(1)}
              style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "var(--muted)", fontWeight: 600 }}>
              Reset
            </button>
          </div>
        </div>
      ) : proGate("Controle de velocidade (0.75x - 1.25x)")}

      {/* Pitch shift */}
      {isPro ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)" }}>PITCH SHIFT</span>
            <span className="pro-badge">PRO</span>
            <span style={{ marginLeft: "auto", color: "var(--text)", fontWeight: 700, fontSize: 14 }}>
              {pitch > 0 ? `+${pitch}` : pitch} st
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>-6</span>
            <input type="range" min={-6} max={6} step={1} value={pitch}
              onChange={e => setPitch(Number(e.target.value))} style={{ flex: 1 }} />
            <span style={{ color: "var(--muted)", fontSize: 12 }}>+6</span>
            <button onClick={() => setPitch(0)}
              style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "var(--muted)", fontWeight: 600 }}>
              Reset
            </button>
          </div>
          <p style={{ color: "var(--muted2)", fontSize: 11, margin: "8px 0 0" }}>Pitch shift via Tone.js em desenvolvimento.</p>
        </div>
      ) : proGate("Pitch shift em tempo real")}

      {/* Stems */}
      {isPro && stems.length > 0 ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)" }}>STEMS</span>
            <span className="pro-badge">PRO</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
            {stems.map(stem => {
              const muted = stemMuted[stem.instrument] ?? false;
              return (
                <button key={stem.id}
                  onClick={() => setStemMuted(prev => ({ ...prev, [stem.instrument]: !muted }))}
                  style={{
                    background: muted ? "var(--surface2)" : "rgba(29,185,84,0.12)",
                    border: muted ? "1px solid var(--border2)" : "1px solid rgba(29,185,84,0.3)",
                    borderRadius: 8, padding: "10px 12px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s",
                  }}
                >
                  <span style={{ fontSize: 20, opacity: muted ? 0.3 : 1 }}>{STEM_ICONS[stem.instrument] ?? "🎵"}</span>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: muted ? "var(--muted)" : "var(--text)" }}>
                      {stem.label ?? stem.instrument}
                    </div>
                    <div style={{ fontSize: 11, color: muted ? "var(--muted2)" : "var(--accent)" }}>
                      {muted ? "Mudo" : "Ativo"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : !isPro ? proGate("Stems individuais (bateria, baixo, guitarra, harmonia)") : null}

    </div>
  );
}
