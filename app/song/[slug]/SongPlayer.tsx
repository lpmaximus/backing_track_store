"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";
import Comments from "./Comments";
import AddToSetlist from "./AddToSetlist";
import AdBanner from "@/app/components/AdBanner";
import type { Stem } from "./WavePlayer";

// WavePlayer usa APIs de browser — importar só no client
const WavePlayer = dynamic(() => import("./WavePlayer"), { ssr: false });

type ChordSection = {
  section: string;
  timecode: number;
  chords: string;
};

type Song = {
  id: number;
  slug: string;
  title: string;
  artist: string;
  genre: string;
  key: string;
  bpm: number;
  audioUrl: string | null;
  thumbnailUrl: string | null;
  duration: number;
  cifraText: string | null;
  chords: ChordSection[] | null;
  published: boolean;
};

type Props = {
  song: Song;
  stems: Stem[];
  isPro?: boolean;
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

// ─── Cifra texto legado ───────────────────────────────────────────────────────
function CifraText({ text, fontSize }: { text: string; fontSize: number }) {
  return (
    <div style={{ fontFamily: "'Courier New', monospace", fontSize, lineHeight: 2 }}>
      {text.split("\n").map((line, i) => {
        if (/^\[.+\]$/.test(line.trim())) {
          return <div key={i} style={{ color: "var(--accent)", fontWeight: 700, fontSize: fontSize - 1, letterSpacing: "0.06em", marginTop: 20, marginBottom: 4 }}>{line}</div>;
        }
        const chordPat = /^([A-G][b#]?(maj|min|m|M|dim|aug|sus|add)?[0-9]*(\/[A-G][b#]?)?(\s+|$))+$/;
        if (chordPat.test(line.trim()) && line.trim()) {
          return (
            <div key={i} style={{ marginBottom: 2 }}>
              {line.split(/(\s+)/).map((p, j) =>
                p.trim()
                  ? <span key={j} style={{ color: "var(--chord)", fontWeight: 700, marginRight: 10 }}>{p}</span>
                  : <span key={j}>{p}</span>
              )}
            </div>
          );
        }
        if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
        return <div key={i} style={{ color: "var(--muted)" }}>{line}</div>;
      })}
    </div>
  );
}

// ─── Cifra sincronizada ───────────────────────────────────────────────────────
function ChordDisplay({ sections, currentTime, fontSize }: { sections: ChordSection[]; currentTime: number; fontSize: number }) {
  const activeIdx = sections.reduce((best, sec, i) => sec.timecode <= currentTime ? i : best, 0);

  return (
    <div style={{ fontFamily: "'Courier New', monospace", fontSize, lineHeight: 2.2 }}>
      <style>{`@keyframes bts-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      {sections.map((sec, i) => {
        const isActive = i === activeIdx;
        return (
          <div key={i} style={{
            marginBottom: 18,
            padding: "10px 14px",
            borderRadius: 8,
            background: isActive ? "rgba(29,185,84,0.08)" : "transparent",
            border: isActive ? "1px solid rgba(29,185,84,0.25)" : "1px solid transparent",
            transition: "all 0.3s",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {isActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block", animation: "bts-pulse 1.2s infinite" }} />}
              <span style={{ color: isActive ? "var(--accent)" : "var(--muted2)", fontWeight: 700, fontSize: fontSize - 2, letterSpacing: "0.08em" }}>
                {sec.section.toUpperCase()}
              </span>
              <span style={{ color: "var(--muted2)", fontSize: 11, marginLeft: "auto" }}>{formatTime(sec.timecode)}</span>
            </div>
            <div>
              {sec.chords.split(" ").filter(Boolean).map((chord, j) => (
                <span key={j} style={{ color: isActive ? "var(--chord)" : "var(--muted)", fontWeight: 700, marginRight: 14, fontSize, transition: "color 0.3s" }}>
                  {chord}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SongPlayer({ song, stems, isPro = false }: Props) {
  const [currentTime, setCurrentTime]   = useState(0);
  const [autoScroll,  setAutoScroll]    = useState(false);
  const [scrollSpd,   setScrollSpd]     = useState(1);
  const [fontSize,    setFontSize]       = useState(14);
  const cifraRef = useState<HTMLDivElement | null>(null);
  const scrollIntervalRef = useState<ReturnType<typeof setInterval> | null>(null);

  // Auto-scroll effect
  const handleAutoScrollToggle = () => {
    setAutoScroll(v => !v);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <div style={{ flex: 1, maxWidth: 1200, margin: "0 auto", padding: "24px 24px 40px", width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Song header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", background: "var(--surface2)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>
            {song.thumbnailUrl
              ? <Image src={song.thumbnailUrl} alt={song.artist} width={72} height={72} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
              : "🎸"
            }
          </div>
          <div style={{ flex: 1 }}>
            <Link href="/" style={{ color: "var(--muted)", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
              ← Voltar ao catálogo
            </Link>
            <h1 style={{ fontWeight: 900, fontSize: 26, margin: "0 0 5px", color: "var(--text)" }}>{song.title}</h1>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
              {song.artist} · {song.genre} · Tom: <strong style={{ color: "var(--text)" }}>{song.key}</strong> · {song.bpm} BPM
            </p>
          </div>
          {isPro && (
            <span className="pro-badge" style={{ marginTop: 8 }}>PRO</span>
          )}
        </div>

        {/* ── Player WaveSurfer ── */}
        <WavePlayer
          audioUrl={song.audioUrl}
          stems={stems}
          isPro={isPro}
          songTitle={song.title}
          songArtist={song.artist}
          onTimeUpdate={setCurrentTime}
        />

        {/* ── Content: cifra + sidebar ── */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

          {/* Cifra panel */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              {/* Toolbar */}
              <div style={{ borderBottom: "1px solid var(--border)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)" }}>CIFRA</span>
                {song.chords && song.chords.length > 0 && (
                  <span style={{ background: "rgba(29,185,84,0.15)", color: "var(--accent)", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>
                    ● SINCRONIZADA
                  </span>
                )}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => setFontSize(v => Math.max(11, v - 1))} style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer", color: "var(--text)", fontWeight: 600 }}>A-</button>
                  <span style={{ color: "var(--muted)", fontSize: 12, minWidth: 32, textAlign: "center" }}>{fontSize}px</span>
                  <button onClick={() => setFontSize(v => Math.min(24, v + 1))} style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer", color: "var(--text)", fontWeight: 600 }}>A+</button>
                </div>
              </div>
              {/* Content */}
              <div
                ref={el => { (cifraRef as unknown as React.MutableRefObject<HTMLDivElement | null>).current = el; }}
                style={{ padding: "20px 24px", overflowY: "auto", maxHeight: "calc(100vh - 440px)", minHeight: 280 }}
              >
                {song.chords && song.chords.length > 0
                  ? <ChordDisplay sections={song.chords} currentTime={currentTime} fontSize={fontSize} />
                  : song.cifraText
                    ? <CifraText text={song.cifraText} fontSize={fontSize} />
                    : <p style={{ color: "var(--muted)", fontStyle: "italic", textAlign: "center", marginTop: 40 }}>Cifra não disponível.</p>
                }
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ width: 210, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Auto-scroll */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", margin: "0 0 12px" }}>AUTO-SCROLL</p>
              <button
                onClick={handleAutoScrollToggle}
                style={{
                  background: autoScroll ? "var(--accent)" : "transparent",
                  color: autoScroll ? "#000" : "var(--text)",
                  border: `1.5px solid ${autoScroll ? "var(--accent)" : "var(--border2)"}`,
                  borderRadius: 8, width: "100%", padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 14, transition: "all 0.2s",
                }}
              >
                {autoScroll ? "⏸ Pausar" : "▶ Iniciar"}
              </button>
              <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 6px" }}>Velocidade: <strong style={{ color: "var(--text)" }}>{scrollSpd}x</strong></p>
              <input type="range" min={0.5} max={5} step={0.5} value={scrollSpd} onChange={e => setScrollSpd(Number(e.target.value))} style={{ width: "100%" }} />
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted2)", fontSize: 11, marginTop: 4 }}>
                <span>Lento</span><span>Rápido</span>
              </div>
              <p style={{ color: "var(--muted2)", fontSize: 11, marginTop: 10 }}>
                Atalho: <kbd style={{ background: "var(--surface3)", border: "1px solid var(--border2)", padding: "1px 6px", borderRadius: 4, color: "var(--muted)" }}>A</kbd>
              </p>
            </div>

            {/* Info */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", margin: "0 0 12px" }}>INFORMAÇÕES</p>
              {[["Tom", song.key], ["BPM", String(song.bpm)], ["Gênero", song.genre]].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>{label}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Adicionar a setlist (Pro) */}
            {isPro && <AddToSetlist songId={song.id} />}

            {/* Pro upsell */}
            {!isPro && (
              <div style={{ background: "linear-gradient(135deg, #ffffff 0%, #eafbf1 100%)", border: "1px solid rgba(29,185,84,0.25)", borderRadius: 12, padding: 16, textAlign: "center" }}>
                <span className="pro-badge" style={{ display: "inline-block", marginBottom: 10 }}>PRO</span>
                <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5, margin: "0 0 12px" }}>Stems, pitch shift e loop A-B</p>
                <Link href="/planos" className="btn-primary" style={{ padding: "8px 16px", fontSize: 12, display: "block" }}>
                  Testar grátis
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Banner publicitário (apenas Free, fora do player) */}
        <AdBanner variant="compact" />

        {/* Comentarios */}
        <Comments songId={song.id} />
      </div>

      <SiteFooter />
    </div>
  );
}
