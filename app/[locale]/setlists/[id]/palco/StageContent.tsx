"use client";

/**
 * Tela "Executar" — modo palco (Fase S3 / ADR-BTS-005, §6).
 *
 * Alto contraste e fonte grande de propósito: isto abre no celular pousado na
 * caixa de som, em palco escuro, e quem olha não vai apertar os olhos para ler
 * o tom da próxima música. Cores fixas (não usa os tokens claros do site) —
 * ver BRD-001: #0D0D0F/#FF9A00 são as cores oficiais da marca, e aqui é onde
 * fazem mais sentido: contraste máximo, sem depender do tema claro do site.
 *
 * A pré-carga em janela deslizante (o risco técnico real da ADR) vive em
 * useStageEngine.ts + stagePreload.ts — esta tela só consome o estado que o
 * motor expõe (fase, tempo, próxima música) e desenha.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/src/i18n/navigation";
import { useRouter } from "@/src/i18n/navigation";
import { useStageEngine, type StageSong } from "./useStageEngine";
import { CifraView, CifraText } from "@/app/[locale]/song/[slug]/CifraView";

const BG = "#0D0D0F";
const SURFACE = "#17171B";
const ACCENT = "#FF9A00";
const TEXT = "#FFFFFF";
const MUTED = "#9A9AA2";
const FONT = "'Montserrat', system-ui, -apple-system, sans-serif";

function formatTime(s: number) {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

type ApiSong = StageSong;

export default function StageContent({ setlistId }: { setlistId: string }) {
  const t = useTranslations("setlists");
  const [songs, setSongs] = useState<ApiSong[] | null>(null);
  const [setlistName, setSetlistName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(20);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [stageRes, setlistRes] = await Promise.all([
          fetch(`/api/setlists/${setlistId}/stage`),
          fetch(`/api/setlists/${setlistId}`),
        ]);
        if (stageRes.status === 401 || stageRes.status === 403) {
          if (!cancelled) setError(t("stageNoAccess"));
          return;
        }
        if (stageRes.status === 404) {
          if (!cancelled) setError(t("stageNotFound"));
          return;
        }
        const data = await stageRes.json();
        if (!stageRes.ok) throw new Error(data?.error ?? t("errStageLoad"));
        if (!cancelled) setSongs(data.songs ?? []);

        if (setlistRes.ok) {
          const sData = await setlistRes.json();
          if (!cancelled) setSetlistName(sData?.setlist?.name ?? "");
        }
      } catch {
        if (!cancelled) setError(t("stageLoadError"));
      }
    })();
    return () => { cancelled = true; };
  }, [setlistId, t]);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: BG, color: TEXT, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: FONT }}>
        <p style={{ fontSize: 18 }}>{error}</p>
        <Link href={{ pathname: "/setlists/[id]", params: { id: String(setlistId) } }} style={{ color: ACCENT, fontWeight: 700 }}>{t("backToSetlist")}</Link>
      </div>
    );
  }

  if (!songs) {
    return (
      <div style={{ minHeight: "100vh", background: BG, color: MUTED, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
        {t("stageLoading")}
      </div>
    );
  }

  if (songs.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: BG, color: TEXT, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: FONT }}>
        <p style={{ fontSize: 18, color: MUTED }}>{t("stageEmpty")}</p>
        <Link href={{ pathname: "/setlists/[id]", params: { id: String(setlistId) } }} style={{ color: ACCENT, fontWeight: 700 }}>{t("backToSetlist")}</Link>
      </div>
    );
  }

  return <StagePlayerReady setlistId={setlistId} setlistName={setlistName} songs={songs} fontSize={fontSize} setFontSize={setFontSize} />;
}

function StagePlayerReady({
  setlistId, setlistName, songs, fontSize, setFontSize,
}: {
  setlistId: string; setlistName: string; songs: ApiSong[]; fontSize: number; setFontSize: (n: number) => void;
}) {
  const t = useTranslations("setlists");
  const engine = useStageEngine(songs);
  const {
    currentIndex, currentSong, nextSong, phase, currentTime, duration, gapRemaining,
    loadError, total, currentReady, togglePlayPause, skipNext, skipPrev, skipGap,
  } = engine;
  // Só dá pra tocar quando o áudio da música atual estiver de fato pronto —
  // fora isso, apertar play só entra na fila (waitAndPlay, no motor) e o
  // botão precisa deixar isso visível, não parecer travado.
  const canPlay = currentReady || phase === "playing" || phase === "gap";
  const router = useRouter();

  // Atalhos de teclado: em palco escuro, achar o botão certo com o dedo é
  // mais difícil do que apertar espaço/seta — e Esc para sair é o padrão que
  // a tela cheia da cifra (SongPlayer.tsx) já usa.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { router.push({ pathname: "/setlists/[id]", params: { id: String(setlistId) } }); return; }
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.code === "Space") { e.preventDefault(); togglePlayPause(); }
      else if (e.key === "ArrowRight") { skipNext(); }
      else if (e.key === "ArrowLeft") { skipPrev(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, setlistId, togglePlayPause, skipNext, skipPrev]);

  const cifraRef = useRef<HTMLDivElement | null>(null);
  const anchorsRef = useRef<{ time: number; top: number }[]>([]);
  const followTargetRef = useRef(0);

  // Reconstrói o mapa tempo→posição sempre que a música ou a fonte mudam —
  // mesma técnica do modo Automático da página da música (SongPlayer.tsx).
  useEffect(() => {
    const el = cifraRef.current;
    if (!el) { anchorsRef.current = []; return; }
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-t]"));
    anchorsRef.current = nodes
      .map((n) => ({ time: Number(n.dataset.t), top: n.offsetTop }))
      .filter((a) => Number.isFinite(a.time))
      .sort((a, b) => a.time - b.time);
  }, [currentIndex, fontSize, currentSong?.chords, currentSong?.lyrics]);

  useEffect(() => {
    const el = cifraRef.current;
    const anchors = anchorsRef.current;
    if (!el || anchors.length === 0) { followTargetRef.current = 0; return; }
    let i = 0;
    for (let k = 0; k < anchors.length; k++) { if (anchors[k].time <= currentTime) i = k; else break; }
    const a = anchors[i];
    const b = anchors[i + 1];
    let top = a.top;
    if (b && b.time > a.time) {
      const f = Math.max(0, Math.min(1, (currentTime - a.time) / (b.time - a.time)));
      top = a.top + (b.top - a.top) * f;
    }
    followTargetRef.current = Math.max(0, top - el.clientHeight * 0.35);
  }, [currentTime]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = cifraRef.current;
      if (el) el.scrollTop += (followTargetRef.current - el.scrollTop) * 0.12;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const bigBtn = useCallback((onClick: () => void, label: string, primary = false, disabled = false) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: primary ? 92 : 64, height: primary ? 92 : 64, borderRadius: "50%",
        background: disabled ? "#2A2A30" : primary ? ACCENT : SURFACE,
        color: disabled ? "#5A5A62" : primary ? "#000" : TEXT,
        border: primary ? "none" : "2px solid #2A2A30", fontSize: primary ? 34 : 22,
        cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, opacity: disabled ? 0.6 : 1, transition: "opacity 0.2s, background 0.2s",
      }}
      aria-label={label}
      title={label}
    >
      {label}
    </button>
  ), []);

  if (!currentSong) return null;

  // CifraView/ChordDiagram (compartilhados com a página da música) usam as
  // variáveis CSS do tema CLARO do site (--text escuro, pensado p/ fundo
  // branco). Sem sobrescrever aqui, a linha "ativa" da cifra (que usa
  // var(--text)) fica quase preta sobre o fundo preto do palco — some da
  // tela. Redefinindo as mesmas variáveis neste escopo, tudo que os
  // componentes compartilhados desenham herda as cores certas para o palco.
  const stageVars = {
    "--bg": BG, "--surface": SURFACE, "--surface2": "#1F1F24", "--surface3": "#26262C",
    "--border": "#26262C", "--border2": "#33333A",
    "--text": TEXT, "--muted": MUTED, "--muted2": "#6B6B70",
    "--chord": ACCENT, "--accent": ACCENT, "--accent2": "#E68A00",
    "--primary": ACCENT, "--danger": "#ff6b6b", "--pro": ACCENT,
  } as CSSProperties;

  return (
    <div style={{ ...stageVars, height: "100vh", overflow: "hidden", background: BG, color: TEXT, fontFamily: FONT, display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: `1px solid #222226`, flexWrap: "wrap" }}>
        <Link href={{ pathname: "/setlists/[id]", params: { id: String(setlistId) } }} style={{ color: MUTED, fontSize: 14, fontWeight: 600 }}>{t("exitStage")}</Link>
        <span style={{ color: MUTED, fontSize: 14, marginLeft: 8 }}>{setlistName || t("setlistFallback")}</span>
        <span style={{ marginLeft: "auto", color: ACCENT, fontWeight: 800, fontSize: 16 }}>
          {currentIndex + 1} / {total}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 12 }}>
          <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} style={{ background: SURFACE, border: "1px solid #2A2A30", color: TEXT, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 700 }}>A-</button>
          <button onClick={() => setFontSize(Math.min(34, fontSize + 2))} style={{ background: SURFACE, border: "1px solid #2A2A30", color: TEXT, borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontWeight: 700 }}>A+</button>
        </div>
      </div>

      {/* Song header */}
      <div style={{ flexShrink: 0, padding: "20px 24px 8px", display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 900, margin: 0 }}>{currentSong.title}</h1>
        <span style={{ color: MUTED, fontSize: 18 }}>{currentSong.artist}</span>
        <span style={{ marginLeft: "auto", display: "flex", gap: 18, fontSize: 20, fontWeight: 700 }}>
          <span>{t("stageKey")} <strong style={{ color: ACCENT }}>{currentSong.key}</strong></span>
          <span>{currentSong.bpm} BPM</span>
        </span>
      </div>

      {loadError && (
        <div style={{ margin: "0 24px 8px", padding: "10px 16px", background: "rgba(255,90,90,0.12)", border: "1px solid rgba(255,90,90,0.35)", borderRadius: 8, color: "#ff8a8a", fontSize: 14 }}>
          ⚠ {loadError}
        </div>
      )}

      {/* Cifra — ocupa o resto da tela. minHeight:0 é necessário: sem ele, um
          item flex nunca encolhe abaixo do tamanho do próprio conteúdo, e
          "overflow:auto" não tem efeito — a página inteira cresce e empurra
          o transporte para fora da tela (era exatamente o bug relatado). */}
      <div
        ref={cifraRef}
        style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "8px 24px 24px", position: "relative" }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {(currentSong.chords && currentSong.chords.length > 0) || (currentSong.lyrics && currentSong.lyrics.length > 0) ? (
            <CifraView sections={currentSong.chords ?? []} lyrics={currentSong.lyrics} currentTime={currentTime} fontSize={fontSize} />
          ) : currentSong.cifraText ? (
            <CifraText text={currentSong.cifraText} fontSize={fontSize} />
          ) : (
            <p style={{ color: MUTED, fontStyle: "italic", textAlign: "center", marginTop: 60, fontSize }}>{t("stageNoChart")}</p>
          )}
        </div>
      </div>

      {/* Intervalo entre músicas */}
      {phase === "gap" && nextSong && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(13,13,15,0.94)", display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, zIndex: 50,
        }}>
          <p style={{ color: MUTED, fontSize: 20, letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>Intervalo</p>
          <p style={{ fontSize: 88, fontWeight: 900, color: ACCENT, margin: 0, fontVariantNumeric: "tabular-nums" }}>{gapRemaining}</p>
          <p style={{ fontSize: 22, color: TEXT, margin: 0 }}>
            {t.rich("stageNext", { title: nextSong.title, key: nextSong.key, bpm: nextSong.bpm, b: (c) => <strong>{c}</strong> })}
          </p>
          <button onClick={skipGap} style={{ background: ACCENT, color: "#000", border: "none", borderRadius: 10, padding: "12px 28px", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>
            Pular intervalo →
          </button>
        </div>
      )}

      {/* Transporte grande */}
      <div style={{ flexShrink: 0, borderTop: "1px solid #222226", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Progresso */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: MUTED, fontSize: 14, minWidth: 44, fontVariantNumeric: "tabular-nums" }}>{formatTime(currentTime)}</span>
          <div style={{ flex: 1, height: 6, background: "#232327", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: ACCENT, borderRadius: 3 }} />
          </div>
          <span style={{ color: MUTED, fontSize: 14, minWidth: 44, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{formatTime(duration)}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}>
          {bigBtn(skipPrev, "⏮")}
          {bigBtn(
            togglePlayPause,
            phase === "playing" ? "❚❚" : !canPlay ? "…" : "▶",
            true,
            !canPlay,
          )}
          {bigBtn(skipNext, "⏭")}
        </div>

        {!canPlay && (
          <p style={{ textAlign: "center", color: ACCENT, fontSize: 13, fontWeight: 600, margin: 0 }}>
            {t("stageBuffering")}
          </p>
        )}

        {canPlay && nextSong && phase !== "gap" && (
          <p style={{ textAlign: "center", color: MUTED, fontSize: 14, margin: 0 }}>
            A seguir: <strong style={{ color: TEXT }}>{nextSong.title}</strong> · Tom {nextSong.key} · {nextSong.bpm} BPM
          </p>
        )}
        {phase === "finished" && (
          <p style={{ textAlign: "center", color: ACCENT, fontSize: 16, fontWeight: 700, margin: 0 }}>
            {t("stageEnd")}
          </p>
        )}
      </div>
    </div>
  );
}
