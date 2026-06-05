"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Song = {
  id: string;
  slug: string;
  title: string;
  artist: string;
  genre: string;
  key: string;
  bpm: number;
  audioFile: string;
  duration: number;
  cifra: string;
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function parseCifra(text: string) {
  // Parse cifra text into styled spans
  return text.split("\n").map((line, i) => {
    // Section headers like [Verso], [Refrão]
    if (/^\[.+\]$/.test(line.trim())) {
      return (
        <div key={i} className="cifra-section" style={{ color: "#60a5fa", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 20, marginBottom: 4 }}>
          {line}
        </div>
      );
    }
    // Chord lines: lines where most tokens look like chords
    const chordPattern = /^([A-G][b#]?(maj|min|m|M|dim|aug|sus|add)?[0-9]*(\/[A-G][b#]?)?(\s+|$))+$/;
    if (chordPattern.test(line.trim()) && line.trim().length > 0) {
      const parts = line.split(/(\s+)/);
      return (
        <div key={i} style={{ marginBottom: 2 }}>
          {parts.map((p, j) =>
            p.trim() ? (
              <span key={j} style={{ color: "#f59e0b", fontWeight: 700, marginRight: 12 }}>
                {p}
              </span>
            ) : (
              <span key={j}>{p}</span>
            )
          )}
        </div>
      );
    }
    // Empty line
    if (!line.trim()) {
      return <div key={i} style={{ height: 8 }} />;
    }
    // Lyrics / regular text
    return (
      <div key={i} style={{ color: "#d4d4d4", lineHeight: 1.8 }}>
        {line}
      </div>
    );
  });
}

export default function SongPlayer({ song }: { song: Song }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const cifraRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(song.duration);
  const [volume, setVolume] = useState(0.8);
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(1);
  const [fontSize, setFontSize] = useState(15);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Audio controls
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [isPlaying]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Number(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onDuration = () => setDuration(audio.duration || song.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.volume = volume;
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) {
      scrollTimerRef.current = setInterval(() => {
        if (cifraRef.current) {
          cifraRef.current.scrollTop += scrollSpeed;
        }
      }, 50);
    } else {
      if (scrollTimerRef.current) clearInterval(scrollTimerRef.current);
    }
    return () => {
      if (scrollTimerRef.current) clearInterval(scrollTimerRef.current);
    };
  }, [autoScroll, scrollSpeed]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.code === "KeyA") setAutoScroll((v) => !v);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay]);

  const hasAudio = !!song.audioFile;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }} className="sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/" style={{ color: "var(--muted)", fontSize: 22, lineHeight: 1 }} className="hover:opacity-70 transition-opacity">
            ←
          </Link>
          <div className="flex-1 min-w-0">
            <h1 style={{ color: "var(--text)" }} className="font-bold text-base truncate leading-tight">
              {song.title}
            </h1>
            <p style={{ color: "var(--muted)" }} className="text-sm">
              {song.artist} · {song.genre} · Tom: {song.key} · {song.bpm} BPM
            </p>
          </div>
          <button
            onClick={() => setShowDownloadModal(true)}
            style={{ background: "var(--surface2)", color: "var(--muted)", border: "1px solid var(--border)" }}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm hover:opacity-80 transition-opacity"
          >
            ⬇ Download
          </button>
        </div>
      </header>

      {/* Main — two column on desktop */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-5xl mx-auto w-full px-4 py-6 gap-6">
        {/* Cifra */}
        <div className="flex-1 min-w-0 flex flex-col" style={{ minHeight: 0 }}>
          {/* Cifra toolbar */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span style={{ color: "var(--muted)", fontSize: 13 }} className="font-semibold uppercase tracking-wider">
              Cifra
            </span>
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setFontSize((v) => Math.max(11, v - 1))}
                style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
                className="w-7 h-7 rounded text-sm hover:opacity-80 transition-opacity"
                title="Diminuir fonte"
              >
                A-
              </button>
              <span style={{ color: "var(--muted)", fontSize: 12, minWidth: 30, textAlign: "center" }}>{fontSize}px</span>
              <button
                onClick={() => setFontSize((v) => Math.min(24, v + 1))}
                style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)" }}
                className="w-7 h-7 rounded text-sm hover:opacity-80 transition-opacity"
                title="Aumentar fonte"
              >
                A+
              </button>
            </div>
          </div>

          {/* Cifra content */}
          <div
            ref={cifraRef}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: "20px 24px",
              flex: 1,
              overflowY: "auto",
              fontFamily: "Courier New, monospace",
              fontSize: fontSize,
              lineHeight: 1.8,
              maxHeight: "calc(100vh - 280px)",
              minHeight: 300,
              scrollBehavior: "smooth",
            }}
          >
            <div style={{ whiteSpace: "pre-wrap" }}>
              {parseCifra(song.cifra)}
            </div>
          </div>
        </div>

        {/* Right panel: auto-scroll controls */}
        <div className="lg:w-56 flex flex-row lg:flex-col gap-4 lg:gap-3">
          {/* Auto-scroll */}
          <div
            style={{
              background: "var(--surface)",
              border: `1px solid ${autoScroll ? "#f59e0b66" : "var(--border)"}`,
              borderRadius: 12,
              padding: 16,
              flex: 1,
              transition: "border-color 0.2s",
            }}
          >
            <p style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              Auto-Scroll
            </p>
            <button
              onClick={() => setAutoScroll((v) => !v)}
              style={{
                background: autoScroll ? "#f59e0b" : "var(--surface2)",
                color: autoScroll ? "#000" : "var(--text)",
                border: `1px solid ${autoScroll ? "#f59e0b" : "var(--border)"}`,
                width: "100%",
                padding: "8px 0",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                marginBottom: 12,
                transition: "all 0.2s",
              }}
            >
              {autoScroll ? "⏸ Pausar" : "▶ Iniciar"}
            </button>

            <p style={{ color: "var(--muted)", fontSize: 12, marginBottom: 6 }}>
              Velocidade: <strong style={{ color: "var(--text)" }}>{scrollSpeed}x</strong>
            </p>
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.5}
              value={scrollSpeed}
              onChange={(e) => setScrollSpeed(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#f59e0b" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: 11, marginTop: 2 }}>
              <span>Lento</span><span>Rápido</span>
            </div>
            <p style={{ color: "var(--muted)", fontSize: 11, marginTop: 12 }}>
              Atalho: <kbd style={{ background: "var(--surface2)", border: "1px solid var(--border)", padding: "1px 5px", borderRadius: 3, fontSize: 11 }}>A</kbd>
            </p>
          </div>

          {/* Song info card */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              padding: 16,
              flex: 1,
            }}
          >
            <p style={{ color: "var(--muted)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              Informações
            </p>
            {[
              { label: "Tom", value: song.key },
              { label: "BPM", value: song.bpm },
              { label: "Gênero", value: song.genre },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>{label}</span>
                <span style={{ color: "var(--text)", fontSize: 13, fontWeight: 600 }}>{value}</span>
              </div>
            ))}
            <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "10px 0" }} />
            <button
              onClick={() => setShowDownloadModal(true)}
              style={{
                background: "var(--surface2)",
                color: "var(--muted)",
                border: "1px solid var(--border)",
                width: "100%",
                padding: "8px 0",
                borderRadius: 8,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              ⬇ Baixar Base
            </button>
          </div>
        </div>
      </div>

      {/* Audio Player Bar */}
      <div
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          position: "sticky",
          bottom: 0,
          zIndex: 50,
        }}
      >
        {song.audioFile && (
          <audio ref={audioRef} src={`/audio/${song.audioFile}`} preload="auto" />
        )}

        <div className="max-w-5xl mx-auto px-4 py-3">
          {!hasAudio ? (
            <div className="flex items-center justify-center gap-2 py-1">
              <span style={{ color: "var(--muted)", fontSize: 14 }}>
                🎧 Base ainda não carregada — faça upload pelo painel admin
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Progress */}
              <div className="flex items-center gap-2">
                <span style={{ color: "var(--muted)", fontSize: 12, minWidth: 36, textAlign: "right" }}>
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  style={{ flex: 1, accentColor: "#f59e0b" }}
                />
                <span style={{ color: "var(--muted)", fontSize: 12, minWidth: 36 }}>
                  {formatTime(duration)}
                </span>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-4">
                {/* Play/Pause */}
                <button
                  onClick={togglePlay}
                  style={{
                    background: "#f59e0b",
                    color: "#000",
                    border: "none",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    fontSize: 16,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                  title="Space"
                >
                  {isPlaying ? "⏸" : "▶"}
                </button>

                {/* Song name */}
                <div className="flex-1 min-w-0">
                  <p style={{ color: "var(--text)", fontSize: 14, fontWeight: 600 }} className="truncate">
                    {song.title}
                  </p>
                  <p style={{ color: "var(--muted)", fontSize: 12 }} className="truncate">
                    {song.artist}
                  </p>
                </div>

                {/* Volume */}
                <div className="hidden sm:flex items-center gap-2">
                  <span style={{ color: "var(--muted)", fontSize: 14 }}>🔊</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={handleVolume}
                    style={{ width: 80, accentColor: "#f59e0b" }}
                  />
                </div>

                {/* Auto-scroll toggle */}
                <button
                  onClick={() => setAutoScroll((v) => !v)}
                  style={{
                    background: autoScroll ? "#f59e0b22" : "var(--surface2)",
                    color: autoScroll ? "#f59e0b" : "var(--muted)",
                    border: `1px solid ${autoScroll ? "#f59e0b66" : "var(--border)"}`,
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    cursor: "pointer",
                    fontWeight: 600,
                    transition: "all 0.2s",
                  }}
                >
                  {autoScroll ? "📜 Scroll ON" : "📜 Scroll"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Download Modal */}
      {showDownloadModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
          onClick={() => setShowDownloadModal(false)}
        >
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 16,
              padding: 32,
              maxWidth: 420,
              width: "100%",
              textAlign: "center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎵</div>
            <h2 style={{ color: "var(--text)", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
              Download disponível na assinatura
            </h2>
            <p style={{ color: "var(--muted)", fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
              Acesse o download ilimitado de todas as bases e cifras com nossa assinatura mensal.
            </p>
            <button
              style={{
                background: "#f59e0b",
                color: "#000",
                border: "none",
                padding: "12px 32px",
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 15,
                cursor: "pointer",
                width: "100%",
                marginBottom: 10,
              }}
            >
              Assinar agora — em breve!
            </button>
            <button
              onClick={() => setShowDownloadModal(false)}
              style={{
                background: "transparent",
                color: "var(--muted)",
                border: "none",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
