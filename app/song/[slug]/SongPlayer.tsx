"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import Comments from "./Comments";
import ChordToken from "./ChordDiagram";
import AddToSetlist from "./AddToSetlist";
import ChordEditor from "./ChordEditor";
import AdBanner from "@/app/components/AdBanner";
import type { Stem } from "./WavePlayer";

type LyricsWord = { text: string; start: number; end: number };
type LyricsLine = { time: number; text: string; words?: LyricsWord[] };

// WavePlayer usa APIs de browser — importar só no client
const WavePlayer = dynamic(() => import("./WavePlayer"), { ssr: false });

type ChordSection = {
  section: string;
  timecode: number;
  chords: string;
  times?: number[]; // tempo de cada acorde em `chords` (quando disponível)
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
  chordsStatus?: string | null;
  chordsSource?: string | null;
  lyrics?: LyricsLine[] | null;
  lyricsStatus?: string | null;
  lyricsSource?: string | null;
  published: boolean;
};

type Props = {
  song: Song;
  stems: Stem[];
  isPro?: boolean;
  // Trilha-guia da banda: instrumento do integrante. Quando definido, o player
  // vem com só essa trilha no ar (pré-muta as outras). Ver page.tsx (?solo=).
  soloInstrument?: string | null;
  // Renderizados pelo componente pai (Server Component) e passados como nó pronto —
  // SiteHeader usa auth()/db (Neon) e NÃO pode ser importado por um "use client",
  // senão o bundler leva neon() para o browser ("No database connection string...").
  header: ReactNode;
  footer: ReactNode;
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
                  ? <ChordToken key={j} name={p} color="var(--chord)" fontSize={fontSize} marginRight={10} />
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
          <div key={i} data-t={sec.timecode} style={{
            marginBottom: 18,
            padding: "10px 14px",
            borderRadius: 8,
            background: isActive ? "rgba(255,154,0,0.08)" : "transparent",
            border: isActive ? "1px solid rgba(255,154,0,0.25)" : "1px solid transparent",
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
                <ChordToken key={j} name={chord} color={isActive ? "var(--chord)" : "var(--muted)"} fontSize={fontSize} marginRight={14} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Cifra unificada: acordes SOBRE a letra (estilo CifraClub) ────────────────
type ChordEvent = { time: number; chord: string };

/** Achata as seções em eventos {tempo, acorde}. Usa `times` por acorde quando
 *  existe; senão distribui os acordes da seção uniformemente no tempo dela. */
function buildChordEvents(sections: ChordSection[]): ChordEvent[] {
  const events: ChordEvent[] = [];
  for (let s = 0; s < sections.length; s++) {
    const sec = sections[s];
    const tokens = sec.chords.split(" ").filter(Boolean);
    if (!tokens.length) continue;
    const t0 = sec.timecode;
    const t1 = s + 1 < sections.length ? sections[s + 1].timecode : t0 + tokens.length * 2;
    const times = Array.isArray(sec.times) && sec.times.length === tokens.length ? sec.times : null;
    tokens.forEach((chord, j) => {
      events.push({ time: times ? times[j] : t0 + ((t1 - t0) * j) / tokens.length, chord });
    });
  }
  return events.sort((a, b) => a.time - b.time);
}

/** Offset de caractere de cada palavra dentro do texto da linha (p/ ancorar acorde). */
function wordOffsets(text: string, words?: LyricsWord[]): { start: number; col: number }[] {
  if (!words?.length) return [];
  const res: { start: number; col: number }[] = [];
  let cursor = 0;
  for (const w of words) {
    const idx = text.indexOf(w.text, cursor);
    if (idx >= 0) { res.push({ start: w.start, col: idx }); cursor = idx + w.text.length; }
  }
  return res;
}

/** Monta a string da linha de acordes com cada acorde na sua coluna (sem sobrepor). */
function buildChordLine(placements: { col: number; chord: string }[]): string {
  let line = "";
  for (const p of [...placements].sort((a, b) => a.col - b.col)) {
    const col = p.col <= line.length ? line.length + (line ? 1 : 0) : p.col;
    while (line.length < col) line += " ";
    line += p.chord;
  }
  return line;
}

function CifraView({ sections, lyrics, currentTime, fontSize }: {
  sections: ChordSection[]; lyrics: LyricsLine[] | null; currentTime: number; fontSize: number;
}) {
  // Sem letra → visão de acordes por trecho (a de sempre).
  if (!lyrics || lyrics.length === 0) {
    return <ChordDisplay sections={sections} currentTime={currentTime} fontSize={fontSize} />;
  }

  const events = buildChordEvents(sections);
  const activeIdx = lyrics.reduce((best, l, i) => (l.time <= currentTime ? i : best), -1);

  return (
    <div style={{ fontFamily: "'Courier New', monospace", fontSize, lineHeight: 1.5 }}>
      {lyrics.map((line, i) => {
        const t0 = line.time;
        const t1 = i + 1 < lyrics.length ? lyrics[i + 1].time : Infinity;
        const inLine = events.filter(e => e.time >= t0 && e.time < t1);
        const woffs = wordOffsets(line.text, line.words);

        const placements = inLine.map(e => {
          let col: number;
          if (woffs.length) {
            let wo = woffs[0];
            for (const w of woffs) { if (w.start <= e.time) wo = w; else break; }
            col = wo.col;
          } else {
            const frac = t1 === Infinity ? 0 : Math.max(0, Math.min(1, (e.time - t0) / (t1 - t0)));
            col = Math.round(frac * Math.max(1, line.text.length));
          }
          return { col, chord: e.chord };
        });
        const chordLine = buildChordLine(placements);
        const isActive = i === activeIdx;

        return (
          <div key={i} data-t={t0} style={{ marginBottom: 12, padding: "2px 8px", borderRadius: 6, background: isActive ? "rgba(255,154,0,0.10)" : "transparent" }}>
            {chordLine.trim() && (
              <div style={{ whiteSpace: "pre", color: "var(--chord)", fontWeight: 700 }}>{chordLine}</div>
            )}
            <div style={{ whiteSpace: "pre", color: isActive ? "var(--text)" : "var(--muted)", fontWeight: isActive ? 700 : 400 }}>
              {line.text || " "}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SongPlayer({ song, stems, isPro = false, soloInstrument = null, header, footer }: Props) {
  const [currentTime, setCurrentTime]   = useState(0);
  const [autoScroll,  setAutoScroll]    = useState(false);
  const [autoFollow,  setAutoFollow]    = useState(false); // segue o andamento real da música
  const [scrollSpd,   setScrollSpd]     = useState(0.4);
  const [fontSize,    setFontSize]       = useState(14);
  const cifraRef = useRef<HTMLDivElement | null>(null);
  const prevFontRef = useRef(14); // guarda a fonte antes da tela cheia
  const anchorsRef = useRef<{ time: number; top: number }[]>([]); // âncoras tempo→posição (modo Automático)
  const followTargetRef = useRef(0);

  // ── Cifra colaborativa (Frentes C/D) ──
  const { status: authStatus } = useSession();
  const isAuth = authStatus === "authenticated";
  const [chords, setChords]             = useState<ChordSection[] | null>(song.chords);
  const [chordsStatus, setChordsStatus] = useState<string>(song.chordsStatus ?? "validated");
  const [editing, setEditing]           = useState(false);
  const [generating, setGenerating]     = useState(false);
  const [reported, setReported]         = useState(false);

  // ── Letra (Whisper/WhisperX no vocal + correção da comunidade) — fundida na cifra ──
  const [lyrics, setLyrics]                     = useState<LyricsLine[] | null>(song.lyrics ?? null);
  const [lyricsStatus, setLyricsStatus]         = useState<string>(song.lyricsStatus ?? "validated");
  const [generatingLyrics, setGeneratingLyrics] = useState(false);
  const [fullscreen, setFullscreen]             = useState(false);

  // Frente C: se ainda não há cifra, faz poll do endpoint que finaliza a
  // detecção automática (Music.ai é assíncrono). Só para usuário logado.
  useEffect(() => {
    if (!isAuth) return;
    if (chords && chords.length > 0) return;
    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      if (cancelled) return;
      tries++;
      try {
        const res = await fetch(`/api/chords/advance/${song.id}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.chords && data.chords.length > 0) {
            setChords(data.chords);
            setChordsStatus(data.chordsStatus ?? "draft");
            setGenerating(false);
            return;
          }
          if (!cancelled && (data.jobStatus === "none" || data.jobStatus === "failed")) {
            setGenerating(false);
            return;
          }
          if (!cancelled) setGenerating(true);
        }
      } catch { /* ignora e tenta de novo */ }
      if (!cancelled && tries < 40) setTimeout(tick, 5000);
      else if (!cancelled) setGenerating(false);
    };
    const t = setTimeout(tick, 1200);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id, isAuth]);

  // Letra: mesmo padrão de poll da cifra — finaliza a transcrição automática
  // (Whisper é assíncrono). Só para usuário logado e enquanto não há letra.
  useEffect(() => {
    if (!isAuth) return;
    if (lyrics && lyrics.length > 0) return;
    let cancelled = false;
    let tries = 0;
    const tick = async () => {
      if (cancelled) return;
      tries++;
      try {
        const res = await fetch(`/api/lyrics/advance/${song.id}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data.lyrics && data.lyrics.length > 0) {
            setLyrics(data.lyrics);
            setLyricsStatus(data.lyricsStatus ?? "draft");
            setGeneratingLyrics(false);
            return;
          }
          if (!cancelled && (data.jobStatus === "none" || data.jobStatus === "failed")) {
            setGeneratingLyrics(false);
            return;
          }
          if (!cancelled) setGeneratingLyrics(true);
        }
      } catch { /* ignora e tenta de novo */ }
      if (!cancelled && tries < 40) setTimeout(tick, 5000);
      else if (!cancelled) setGeneratingLyrics(false);
    };
    const t = setTimeout(tick, 1500);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song.id, isAuth]);

  async function reportCifra() {
    if (reported) return;
    setReported(true);
    try {
      await fetch(`/api/songs/${song.id}/chords/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "" }),
      });
    } catch { /* silencioso */ }
  }

  const hasChords = Boolean(chords && chords.length > 0);
  const isDraft = chordsStatus === "draft";
  const hasLyrics = Boolean(lyrics && lyrics.length > 0);
  const lyricsIsDraft = lyricsStatus === "draft";

  // Auto-scroll: enquanto `autoScroll` estiver ativo, rola o container da cifra
  // suavemente, na velocidade definida em `scrollSpd` (px por tick).
  useEffect(() => {
    if (!autoScroll) return;
    const el = cifraRef.current;
    if (!el) return;

    // Acumulador de fração: permite velocidades bem baixas (ex.: 0.1px/tick),
    // que o browser descartaria se somadas direto (scrollTop arredonda).
    let acc = 0;
    const id = setInterval(() => {
      acc += scrollSpd;
      const step = Math.floor(acc);
      if (step >= 1) { el.scrollTop += step; acc -= step; }
      // Chegou ao fim — para automaticamente.
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        setAutoScroll(false);
      }
    }, 50);

    return () => clearInterval(id);
  }, [autoScroll, scrollSpd]);

  // ── Modo Automático: rola seguindo o andamento REAL da música ──
  // Reconstrói o mapa tempo→posição (cada linha tem data-t = seu tempo).
  useEffect(() => {
    const el = cifraRef.current;
    if (!el) { anchorsRef.current = []; return; }
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-t]"));
    anchorsRef.current = nodes
      .map((n) => ({ time: Number(n.dataset.t), top: n.offsetTop }))
      .filter((a) => Number.isFinite(a.time))
      .sort((a, b) => a.time - b.time);
  }, [chords, lyrics, fontSize, fullscreen]);

  // A cada avanço do tempo, calcula a posição-alvo (interpola entre as linhas).
  useEffect(() => {
    if (!autoFollow) return;
    const el = cifraRef.current;
    const anchors = anchorsRef.current;
    if (!el || anchors.length === 0) return;
    let i = 0;
    for (let k = 0; k < anchors.length; k++) { if (anchors[k].time <= currentTime) i = k; else break; }
    const a = anchors[i];
    const b = anchors[i + 1];
    let top = a.top;
    if (b && b.time > a.time) {
      const f = Math.max(0, Math.min(1, (currentTime - a.time) / (b.time - a.time)));
      top = a.top + (b.top - a.top) * f;
    }
    // Mantém a linha atual a ~35% do topo da área visível.
    followTargetRef.current = Math.max(0, top - el.clientHeight * 0.35);
  }, [currentTime, autoFollow]);

  // Loop suave (rAF) que aproxima o scroll da posição-alvo enquanto o modo está ligado.
  useEffect(() => {
    if (!autoFollow) return;
    const el = cifraRef.current;
    if (!el) return;
    let raf = 0;
    const tick = () => {
      el.scrollTop += (followTargetRef.current - el.scrollTop) * 0.12;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoFollow]);

  // Atalho de teclado "A" para ligar/desligar o auto-scroll
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "a") return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      setAutoScroll(v => !v);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Esc sai do modo tela cheia.
  useEffect(() => {
    if (!fullscreen) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [fullscreen]);

  // Ao entrar na tela cheia, sobe a fonte pro máximo (24px); ao sair, restaura.
  // (fontSize fora das deps de propósito: deixa o A-/A+ ajustar durante a tela cheia.)
  useEffect(() => {
    if (fullscreen) { prevFontRef.current = fontSize; setFontSize(24); }
    else { setFontSize(prevFontRef.current); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);

  const handleAutoScrollToggle = () => {
    setAutoFollow(false);
    setAutoScroll(v => !v);
  };
  const handleAutoFollowToggle = () => {
    setAutoScroll(false);
    setAutoFollow(v => !v);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {header}

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
        </div>

        {/* ── Trilha-guia da banda: aviso de pré-mute ── */}
        {soloInstrument && isPro && stems.some(s => s.instrument === soloInstrument) && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(255,154,0,0.08)", border: "1px solid rgba(255,154,0,0.25)", borderRadius: 8, fontSize: 13, color: "var(--muted)" }}>
            <span style={{ fontSize: 16 }}>🎧</span>
            <span>Modo banda: sua trilha vem no ar e as demais entram silenciadas. Reative qualquer uma na mesa quando quiser.</span>
          </div>
        )}

        {/* ── Player WaveSurfer ── */}
        <WavePlayer
          audioUrl={song.audioUrl}
          stems={stems}
          isPro={isPro}
          soloInstrument={soloInstrument}
          songTitle={song.title}
          songArtist={song.artist}
          onTimeUpdate={setCurrentTime}
        />

        {/* ── Content: cifra + sidebar ── */}
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

          {/* Cifra panel */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={fullscreen
              ? { position: "fixed", inset: 0, zIndex: 1000, background: "var(--surface)", display: "flex", flexDirection: "column" }
              : { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
              {/* Toolbar */}
              <div style={{ borderBottom: "1px solid var(--border)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ background: "var(--accent)", color: "#000", border: "1px solid var(--border2)", borderRadius: 6, padding: "3px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>CIFRA</span>
                {(isDraft && hasChords) || (lyricsIsDraft && hasLyrics) ? (
                  <span style={{ background: "rgba(245,158,11,0.15)", color: "#b45309", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>● AUTOMÁTICA · não revisada</span>
                ) : hasChords ? (
                  <span style={{ background: "rgba(255,154,0,0.15)", color: "var(--accent)", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4 }}>● SINCRONIZADA</span>
                ) : null}
                {isPro && !editing && hasChords && (
                  <button onClick={() => setEditing(true)} style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer", color: "var(--text)", fontWeight: 600 }}>✎ Sugerir correção</button>
                )}
                {isAuth && hasChords && (
                  <button onClick={reportCifra} disabled={reported} style={{ background: "none", border: "none", color: reported ? "var(--accent)" : "var(--muted2)", fontSize: 12, cursor: reported ? "default" : "pointer", fontWeight: 600 }}>{reported ? "✓ Reportada" : "⚑ Reportar erro"}</button>
                )}
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => setFontSize(v => Math.max(11, v - 1))} style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer", color: "var(--text)", fontWeight: 600 }}>A-</button>
                  <span style={{ color: "var(--muted)", fontSize: 12, minWidth: 32, textAlign: "center" }}>{fontSize}px</span>
                  <button onClick={() => setFontSize(v => Math.min(24, v + 1))} style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer", color: "var(--text)", fontWeight: 600 }}>A+</button>
                  <button onClick={() => setFullscreen(v => !v)} title={fullscreen ? "Sair (Esc)" : "Tela cheia"} style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "3px 10px", fontSize: 13, cursor: "pointer", color: "var(--text)", fontWeight: 600 }}>{fullscreen ? "✕" : "⛶"}</button>
                </div>
              </div>
              {/* Content */}
              <div
                ref={cifraRef}
                style={{ padding: "20px 24px", overflow: "auto", ...(fullscreen ? { flex: 1, display: "flex", flexDirection: "column", alignItems: "center" } : { maxHeight: "calc(100vh - 280px)", minHeight: 520 }) }}
              >
                {editing
                  ? <ChordEditor
                      songId={song.id}
                      initial={chords ?? []}
                      onCancel={() => setEditing(false)}
                      onSaved={(secs) => { setChords(secs); setChordsStatus("validated"); setEditing(false); }}
                    />
                  : (hasChords || hasLyrics)
                    ? <CifraView sections={chords ?? []} lyrics={lyrics} currentTime={currentTime} fontSize={fontSize} />
                    : song.cifraText
                      ? <CifraText text={song.cifraText} fontSize={fontSize} />
                      : (generating || generatingLyrics)
                        ? <p style={{ color: "var(--muted)", fontStyle: "italic", textAlign: "center", marginTop: 40 }}>Gerando cifra automática… isso pode levar alguns minutos.</p>
                        : <p style={{ color: "var(--muted)", fontStyle: "italic", textAlign: "center", marginTop: 40 }}>Cifra não disponível.</p>
                }
              </div>
              {/* Controles flutuantes na tela cheia */}
              {fullscreen && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 14, background: "var(--surface)", flexWrap: "wrap" }}>
                  <button onClick={handleAutoFollowToggle} title="Acompanha o andamento real da música" style={{ background: autoFollow ? "var(--accent)" : "transparent", color: autoFollow ? "#000" : "var(--text)", border: `1.5px solid ${autoFollow ? "var(--accent)" : "var(--border2)"}`, borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    🎵 Automático
                  </button>
                  <button onClick={handleAutoScrollToggle} style={{ background: autoScroll ? "var(--accent)" : "transparent", color: autoScroll ? "#000" : "var(--text)", border: `1.5px solid ${autoScroll ? "var(--accent)" : "var(--border2)"}`, borderRadius: 8, padding: "8px 18px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    {autoScroll ? "⏸ Pausar" : "▶ Manual"}
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 160, maxWidth: 320, opacity: autoFollow ? 0.4 : 1 }}>
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>Lento</span>
                    <input type="range" min={0.1} max={3} step={0.1} value={scrollSpd} disabled={autoFollow} onChange={e => setScrollSpd(Number(e.target.value))} style={{ flex: 1 }} />
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>Rápido</span>
                    <span style={{ color: "var(--text)", fontSize: 12, fontWeight: 700, minWidth: 38 }}>{scrollSpd}x</span>
                  </div>
                  <button onClick={() => setFullscreen(false)} style={{ marginLeft: "auto", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", color: "var(--text)", fontWeight: 600 }}>✕ Sair (Esc)</button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ width: 210, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Auto-scroll */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", margin: "0 0 12px" }}>AUTO-SCROLL</p>
              <button
                onClick={handleAutoFollowToggle}
                title="Acompanha o andamento real da música — nem rápido nem devagar"
                style={{
                  background: autoFollow ? "var(--accent)" : "transparent",
                  color: autoFollow ? "#000" : "var(--text)",
                  border: `1.5px solid ${autoFollow ? "var(--accent)" : "var(--border2)"}`,
                  borderRadius: 8, width: "100%", padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 8, transition: "all 0.2s",
                }}
              >
                {autoFollow ? "🎵 Automático · ligado" : "🎵 Automático"}
              </button>
              <button
                onClick={handleAutoScrollToggle}
                style={{
                  background: autoScroll ? "var(--accent)" : "transparent",
                  color: autoScroll ? "#000" : "var(--text)",
                  border: `1.5px solid ${autoScroll ? "var(--accent)" : "var(--border2)"}`,
                  borderRadius: 8, width: "100%", padding: "9px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 14, transition: "all 0.2s",
                }}
              >
                {autoScroll ? "⏸ Pausar" : "▶ Manual"}
              </button>
              <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 6px" }}>Velocidade: <strong style={{ color: "var(--text)" }}>{scrollSpd}x</strong></p>
              <input type="range" min={0.1} max={3} step={0.1} value={scrollSpd} onChange={e => setScrollSpd(Number(e.target.value))} style={{ width: "100%" }} />
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
              <div style={{ background: "linear-gradient(135deg, #ffffff 0%, #fff4e0 100%)", border: "1px solid rgba(255,154,0,0.25)", borderRadius: 12, padding: 16, textAlign: "center" }}>
                <span className="pro-badge" style={{ display: "inline-block", marginBottom: 10 }}>PRO</span>
                <p style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.5, margin: "0 0 12px" }}>Stems, pitch shift e loop A-B</p>
                <Link href="/planos" className="btn-primary" style={{ padding: "8px 16px", fontSize: 12, display: "block" }}>
                  Testar grátis
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Banner publicitário (apenas Free, fora do player). Usa o isPro
            efetivo (inclui ProBand e integrante de banda), não só o role. */}
        {!isPro && <AdBanner variant="compact" />}

        {/* Comentarios */}
        <Comments songId={song.id} />
      </div>

      {footer}
    </div>
  );
}
