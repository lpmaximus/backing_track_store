"use client";

import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useSession } from "next-auth/react";
import Comments from "./Comments";
import AddToSetlist from "./AddToSetlist";
import CifraEditor from "./CifraEditor";
import Metronome from "./Metronome";
import AdBanner from "@/app/components/AdBanner";
import type { Stem } from "./WavePlayer";
import type { ResolvedStem } from "@/src/lib/mix";
import { CifraView, CifraText, type ChordSection, type LyricsLine } from "./CifraView";
import { track } from "@/app/track";

// WavePlayer usa APIs de browser — importar só no client
const WavePlayer = dynamic(() => import("./WavePlayer"), { ssr: false });

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
  beats?: number[] | null;
  published: boolean;
};

type Props = {
  song: Song;
  stems: Stem[];
  isPro?: boolean;
  // Trilha-guia da banda: instrumento do integrante. Quando definido, o player
  // vem com só essa trilha no ar (pré-muta as outras). Ver page.tsx (?solo=).
  soloInstrument?: string | null;
  // Trecho a estudar vindo da escalação do ensaio (S1 / ADR-BTS-005). Só
  // repassa ao WavePlayer, que faz o loop A–B. Ver page.tsx (?loop=).
  loopStart?: number | null;
  loopEnd?: number | null;
  // Mixagem resolvida do setlist (S2 / ADR-BTS-005). Vem pronta do servidor,
  // já com as três camadas aplicadas. Null = música aberta fora de um setlist.
  setlistMix?: ResolvedStem[] | null;
  setlistName?: string | null;
  setlistTranspose?: number;
  setlistSpeed?: number;
  // Renderizados pelo componente pai (Server Component) e passados como nó pronto —
  // SiteHeader usa auth()/db (Neon) e NÃO pode ser importado por um "use client",
  // senão o bundler leva neon() para o browser ("No database connection string...").
  header: ReactNode;
  footer: ReactNode;
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SongPlayer({
  song, stems, isPro = false, soloInstrument = null, loopStart = null, loopEnd = null,
  setlistMix = null, setlistName = null, setlistTranspose = 0, setlistSpeed = 1,
  header, footer,
}: Props) {
  const [currentTime, setCurrentTime]   = useState(0);
  // Analytics de produto: o primeiro segundo de áudio que roda conta como "play".
  // Evita marcar quem só abriu a página e saiu. Ver src/lib/activity.ts.
  const playedRef = useRef(false);
  const handleTimeUpdate = useCallback((t: number) => {
    setCurrentTime(t);
    if (!playedRef.current && t > 1) {
      playedRef.current = true;
      track("play", { songId: song.id });
    }
  }, [song.id]);
  const [autoScroll,  setAutoScroll]    = useState(false);
  const [autoFollow,  setAutoFollow]    = useState(false); // segue o andamento real da música
  const [scrollSpd,   setScrollSpd]     = useState(0.4);
  const [fontSize,    setFontSize]       = useState(14);
  const router = useRouter();
  const goBack = () => {
    // Volta pra página anterior; se a pessoa caiu direto na música (sem histórico
    // interno — link compartilhado), cai no catálogo.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  };
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
  // Tom e velocidade nascem do preparo do setlist quando a música é aberta por
  // ele (S2). O usuário continua livre para mexer nos dois depois.
  const [speed, setSpeed]                       = useState(setlistSpeed);
  const [pitch, setPitch]                       = useState(setlistTranspose);
  const [metronome, setMetronome]               = useState(false);

  // Analytics de produto: cifra/letra disponíveis na tela e modo palco (tela cheia).
  useEffect(() => {
    if (chords && chords.length > 0) track("cifra", { songId: song.id });
  }, [chords, song.id]);
  useEffect(() => {
    if (lyrics && lyrics.length > 0) track("letra", { songId: song.id });
  }, [lyrics, song.id]);
  useEffect(() => {
    if (fullscreen) track("stage_mode", { songId: song.id });
  }, [fullscreen, song.id]);

  const [songKey, setSongKey]                   = useState(song.key ?? "");
  const [songBpm, setSongBpm]                   = useState(song.bpm ? String(song.bpm) : "");

  // Batidas do metrônomo: usa as detectadas se houver; senão gera uma grade
  // regular a partir do BPM + duração (stem de harmonia não produz beats sozinho).
  const beats = useMemo(() => {
    if (song.beats && song.beats.length > 0) return song.beats;
    const bpm = Number(songBpm) || song.bpm || 0;
    if (bpm <= 0 || !song.duration) return [];
    const step = 60 / bpm;
    return Array.from({ length: Math.floor(song.duration / step) }, (_, i) => Math.round(i * step * 1000) / 1000);
  }, [song.beats, song.duration, song.bpm, songBpm]);

  async function saveMeta(patch: { key?: string; bpm?: number }) {
    try {
      await fetch(`/api/songs/${song.id}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch { /* silencioso */ }
  }

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
            <button onClick={goBack} style={{ background: "none", border: "none", padding: 0, color: "var(--muted)", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 8, cursor: "pointer" }}>
              ← Voltar
            </button>
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
            <span><strong>Ouvir como é:</strong> sua trilha vem no ar e as demais entram silenciadas, para aprender a parte. Reative qualquer uma na mesa quando quiser.</span>
          </div>
        )}

        {/* ── Mixagem do setlist aplicada (S2) ──
            Sempre visível quando há mix: é a diferença entre "o som mudou" e
            "o som mudou porque o líder preparou assim". */}
        {setlistMix && isPro && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "rgba(255,154,0,0.08)", border: "1px solid rgba(255,154,0,0.25)", borderRadius: 8, fontSize: 13, color: "var(--muted)", flexWrap: "wrap" }}>
            <span style={{ fontSize: 16 }}>🎚️</span>
            <span>
              Mixagem {setlistName ? <>do setlist <strong>{setlistName}</strong></> : "do setlist"} aplicada
              {setlistMix.some(m => m.source === "auto") && <> · sua trilha entra mutada para você tocar junto</>}
              {setlistTranspose !== 0 && <> · tom {setlistTranspose > 0 ? `+${setlistTranspose}` : setlistTranspose}</>}
              {setlistSpeed !== 1 && <> · {setlistSpeed.toFixed(2)}× de velocidade</>}
              .
            </span>
            <Link href={`/song/${song.slug}`} style={{ color: "var(--accent)", fontWeight: 600, marginLeft: "auto" }}>
              usar o mix original
            </Link>
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
          onTimeUpdate={handleTimeUpdate}
          onMixerTouch={() => track("mixer", { songId: song.id })}
          speed={speed}
          pitch={pitch}
          loopStart={loopStart}
          loopEnd={loopEnd}
          initialMix={setlistMix}
        />
        <Metronome beats={beats} currentTime={currentTime} enabled={metronome} />

        {/* ── Content: cifra + sidebar (empilha em telas estreitas — .player-content) ── */}
        <div className="player-content" style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

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
                {isPro && !editing && (
                  <button onClick={() => setEditing(true)} style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "3px 10px", fontSize: 12, cursor: "pointer", color: "var(--text)", fontWeight: 600 }}>✎ Corrigir letra/cifra</button>
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
                style={{ position: "relative", padding: "20px 24px", overflow: "auto", ...(fullscreen ? { flex: 1, display: "flex", flexDirection: "column", alignItems: "center" } : { maxHeight: "calc(100vh - 280px)", minHeight: 520 }) }}
              >
                {editing
                  ? <CifraEditor
                      songId={song.id}
                      initialLyrics={lyrics ?? []}
                      initialChords={chords ?? []}
                      currentTime={currentTime}
                      onCancel={() => setEditing(false)}
                      onSaved={(ls, cs) => { setLyrics(ls); setLyricsStatus("validated"); setChords(cs); setChordsStatus("validated"); setEditing(false); }}
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
          <div className="player-sidebar" style={{ width: 210, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>

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

            {/* Prática: velocidade + pitch + metrônomo */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", margin: "0 0 12px" }}>PRÁTICA</p>
              {isPro ? (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                      <span>Velocidade</span><strong style={{ color: "var(--text)" }}>{speed.toFixed(2)}x</strong>
                    </div>
                    <input type="range" min={0.5} max={1.25} step={0.05} value={speed} onChange={e => setSpeed(Number(e.target.value))} style={{ width: "100%" }} aria-label="Velocidade" />
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                      <span>Tom (pitch)</span><strong style={{ color: "var(--text)" }}>{pitch > 0 ? `+${pitch}` : pitch} st</strong>
                    </div>
                    <input type="range" min={-6} max={6} step={1} value={pitch} onChange={e => setPitch(Number(e.target.value))} style={{ width: "100%" }} aria-label="Pitch" />
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 12, color: "var(--muted2)", margin: 0 }}>Velocidade e pitch são recursos Pro.</p>
              )}
              <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12 }}>
                {beats.length > 0 ? (
                  <>
                    <button onClick={() => setMetronome(v => !v)}
                      style={{ background: metronome ? "var(--accent)" : "transparent", color: metronome ? "#000" : "var(--text)", border: `1.5px solid ${metronome ? "var(--accent)" : "var(--border2)"}`, borderRadius: 8, width: "100%", padding: "8px 0", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.2s" }}>
                      {metronome ? "🥁 Metrônomo · ligado" : "🥁 Metrônomo"}
                    </button>
                    <p style={{ fontSize: 11, color: "var(--muted2)", margin: "6px 0 0" }}>Dá play — o clique segue a música.</p>
                  </>
                ) : (
                  <p style={{ fontSize: 11, color: "var(--muted2)", margin: 0 }}>Metrônomo: batidas ainda não detectadas nesta música.</p>
                )}
              </div>
            </div>

            {/* Info */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px" }}>
                <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", margin: 0 }}>INFORMAÇÕES</p>
                {isPro && <span style={{ fontSize: 10, color: "var(--muted2)" }}>· clique p/ corrigir</span>}
              </div>
              {(() => {
                const rowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 } as const;
                const labelStyle = { color: "var(--muted)", fontSize: 13 } as const;
                const valStyle = { fontWeight: 700, fontSize: 13, color: "var(--text)" } as const;
                const inputStyle = { width: 76, textAlign: "right" as const, fontWeight: 700, fontSize: 13, color: "var(--text)", background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "3px 8px", outline: "none" };
                return (
                  <>
                    <div style={rowStyle}>
                      <span style={labelStyle}>Tom</span>
                      {isPro
                        ? <input value={songKey} onChange={e => setSongKey(e.target.value)} onBlur={() => saveMeta({ key: songKey })} placeholder="?" style={inputStyle} aria-label="Tom" />
                        : <span style={valStyle}>{songKey || "?"}</span>}
                    </div>
                    <div style={rowStyle}>
                      <span style={labelStyle}>BPM</span>
                      {isPro
                        ? <input value={songBpm} inputMode="numeric" onChange={e => setSongBpm(e.target.value.replace(/[^0-9]/g, ""))} onBlur={() => songBpm && saveMeta({ bpm: Number(songBpm) })} placeholder="0" style={inputStyle} aria-label="BPM" />
                        : <span style={valStyle}>{songBpm || "0"}</span>}
                    </div>
                    <div style={rowStyle}>
                      <span style={labelStyle}>Gênero</span>
                      <span style={valStyle}>{song.genre}</span>
                    </div>
                  </>
                );
              })()}
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
