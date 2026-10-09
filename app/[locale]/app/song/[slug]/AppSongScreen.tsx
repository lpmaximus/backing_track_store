"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/src/i18n/navigation";
import { track } from "@/app/track";
import { haptic, keepScreenOn } from "@/src/lib/native";
import type { Stem, Transport } from "@/app/[locale]/song/[slug]/WavePlayer";
import { CifraText, CifraView, formatTime, type ChordSection, type LyricsLine } from "@/app/[locale]/song/[slug]/CifraView";
import { IconBack, IconPause, IconPlay } from "../../_components/AppIcons";

// Motor de áudio do site (Web Audio + Tone). Só no cliente.
const WavePlayer = dynamic(() => import("@/app/[locale]/song/[slug]/WavePlayer"), { ssr: false });

type Song = {
  id: number;
  slug: string;
  title: string;
  artist: string;
  key: string;
  bpm: number;
  duration: number;
  audioUrl: string | null;
  chords: ChordSection[] | null;
  lyrics: LyricsLine[] | null;
  cifraText: string | null;
  projectMode: boolean;
};

type Tab = "faixas" | "cifra";

const SPEED_MIN = 0.5;
const SPEED_MAX = 1.25;
const PITCH_MIN = -6;
const PITCH_MAX = 6;

/**
 * Tela da música no app: abas Faixas | Cifra sobre UM motor de áudio.
 *
 * O WavePlayer fica montado nas duas abas (só escondido na Cifra) — trocar de
 * aba não pode parar a música nem recarregar os stems. Na aba Cifra o
 * transporte é o mini-player de baixo, que fala com o motor pelo transportRef.
 */
export default function AppSongScreen({ song, stems, isPro, initialTab }: {
  song: Song; stems: Stem[]; isPro: boolean; initialTab: Tab;
}) {
  const t = useTranslations("app.player");
  const ts = useTranslations("song");
  const router = useRouter();

  const [tab, setTab] = useState<Tab>(initialTab);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(song.duration || 0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [autoFollow, setAutoFollow] = useState(true);
  const transportRef = useRef<Transport | null>(null);

  // Tocando = o tempo andou há pouco. O motor não expõe "isPlaying", e ler do
  // relógio evita um segundo estado que poderia divergir do áudio real.
  const lastTick = useRef(0);
  const lastTime = useRef(0);
  const played = useRef(false);
  const onTime = useCallback((time: number) => {
    setCurrentTime(time);
    if (Math.abs(time - lastTime.current) > 0.001) lastTick.current = performance.now();
    lastTime.current = time;
    if (!played.current && time > 1) { played.current = true; track("play", { songId: song.id }); }
  }, [song.id]);
  useEffect(() => {
    const id = window.setInterval(() => setPlaying(performance.now() - lastTick.current < 450), 250);
    return () => window.clearInterval(id);
  }, []);

  // Tela acesa enquanto a música estiver aberta (no app nativo).
  useEffect(() => {
    let release: (() => void) | null = null;
    let alive = true;
    void keepScreenOn().then((fn) => { if (alive) release = fn; else fn(); });
    return () => { alive = false; release?.(); };
  }, []);

  const hasChords = !!(song.chords && song.chords.length) || !!(song.lyrics && song.lyrics.length);
  const hasCifra = hasChords || !!song.cifraText;
  useEffect(() => {
    if (tab === "cifra" && hasCifra) track("cifra", { songId: song.id });
  }, [tab, hasCifra, song.id]);

  function switchTab(next: Tab) {
    if (next === tab) return;
    void haptic();
    setTab(next);
  }

  async function togglePlay() {
    void haptic("medium");
    const tr = transportRef.current;
    if (!tr) return;
    if (playing) { tr.pause(); setPlaying(false); }
    else { await tr.play(); lastTick.current = performance.now(); setPlaying(true); }
  }
  function seekBy(delta: number) {
    const tr = transportRef.current;
    if (!tr) return;
    const max = duration || song.duration || Infinity;
    tr.seek(Math.max(0, Math.min(max, currentTime + delta)));
  }

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/app");
  }

  // ── Rolagem automática da cifra (segue o tempo real, como no site) ────────
  const cifraRef = useRef<HTMLDivElement | null>(null);
  const anchors = useRef<{ time: number; top: number }[]>([]);
  const target = useRef(0);
  useLayoutEffect(() => {
    const el = cifraRef.current;
    if (!el) { anchors.current = []; return; }
    anchors.current = Array.from(el.querySelectorAll<HTMLElement>("[data-t]"))
      .map((n) => ({ time: Number(n.dataset.t), top: n.offsetTop }))
      .filter((a) => Number.isFinite(a.time))
      .sort((a, b) => a.time - b.time);
  }, [tab, fontSize, song.chords, song.lyrics]);
  useEffect(() => {
    if (!autoFollow || tab !== "cifra") return;
    const el = cifraRef.current;
    const a = anchors.current;
    if (!el || a.length === 0) return;
    let i = 0;
    for (let k = 0; k < a.length; k++) { if (a[k].time <= currentTime) i = k; else break; }
    const cur = a[i];
    const nxt = a[i + 1];
    let top = cur.top;
    if (nxt && nxt.time > cur.time) {
      const f = Math.max(0, Math.min(1, (currentTime - cur.time) / (nxt.time - cur.time)));
      top = cur.top + (nxt.top - cur.top) * f;
    }
    target.current = Math.max(0, top - el.clientHeight * 0.3);
  }, [currentTime, autoFollow, tab]);
  useEffect(() => {
    if (!autoFollow || tab !== "cifra") return;
    const el = cifraRef.current;
    if (!el) return;
    let raf = 0;
    const tick = () => { el.scrollTop += (target.current - el.scrollTop) * 0.12; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoFollow, tab]);

  const total = duration || song.duration;
  const pitchLabel = pitch === 0 ? t("keyOriginal", { key: song.key }) : t("keyShift", { key: song.key, n: pitch > 0 ? `+${pitch}` : String(pitch) });

  return (
    <main
      className="app-screen app-screen--bare app-player"
      style={{
        gap: 12, paddingLeft: 16, paddingRight: 16,
        ...(tab === "cifra" ? { height: "100dvh", overflow: "hidden" } : null),
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="button" onClick={goBack} className="app-icon-btn" aria-label={t("back")}><IconBack /></button>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{song.title}</h1>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {t("meta", { key: song.key, bpm: song.bpm })}{total ? ` · ${formatTime(total)}` : ""}
          </div>
        </div>
        {/* Recursos que ainda vivem só no player completo (gravar take, pedal
            de loop, download, editar cifra) — a casca mobile deles é a próxima rodada. */}
        <Link href={{ pathname: "/song/[slug]", params: { slug: song.slug } }} className="app-icon-btn" aria-label={t("fullPlayer")}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" />
          </svg>
        </Link>
      </header>

      <div role="tablist" className="app-segmented">
        <button role="tab" type="button" aria-selected={tab === "faixas"} onClick={() => switchTab("faixas")}>{t("tabTracks")}</button>
        <button role="tab" type="button" aria-selected={tab === "cifra"} onClick={() => switchTab("cifra")}>{t("tabChords")}</button>
      </div>

      {/* Motor + mesa: sempre montado; na aba Cifra fica fora da tela. */}
      {/* Fora da tela, e não display:none: o WaveSurfer mede a largura do
          contêiner ao montar — escondido com display:none ele nasceria com 0px
          quando a música abre direto na aba Cifra. */}
      <section
        aria-label={t("tabTracks")}
        aria-hidden={tab !== "faixas"}
        inert={tab !== "faixas"}
        style={tab === "faixas"
          ? { display: "flex", flexDirection: "column", gap: 12 }
          : { display: "flex", flexDirection: "column", gap: 12, position: "absolute", left: -10000, top: 0, width: "min(608px, calc(100vw - 32px))", visibility: "hidden", pointerEvents: "none" }}
      >
        <WavePlayer
          audioUrl={song.audioUrl}
          stems={stems}
          isPro={isPro}
          songTitle={song.title}
          songArtist={song.artist}
          onTimeUpdate={onTime}
          onDurationReady={setDuration}
          onMixerTouch={() => track("mixer", { songId: song.id })}
          speed={speed}
          pitch={pitch}
          transportRef={transportRef}
          projectMode={song.projectMode}
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <Stepper
            label={t("key")}
            value={pitchLabel}
            locked={!isPro}
            onDown={() => setPitch((p) => Math.max(PITCH_MIN, p - 1))}
            onUp={() => setPitch((p) => Math.min(PITCH_MAX, p + 1))}
            downLabel={t("keyDown")} upLabel={t("keyUp")}
          />
          <Stepper
            label={t("speed")}
            value={`${speed.toFixed(2)}×`}
            locked={!isPro}
            onDown={() => setSpeed((s) => Math.max(SPEED_MIN, Math.round((s - 0.05) * 100) / 100))}
            onUp={() => setSpeed((s) => Math.min(SPEED_MAX, Math.round((s + 0.05) * 100) / 100))}
            downLabel={t("slower")} upLabel={t("faster")}
          />
        </div>
        {!isPro && (
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
            {ts("proSpeedPitch")}{" "}
            <Link href="/planos" style={{ color: "var(--accent)", fontWeight: 600 }}>{t("seePlans")}</Link>
          </p>
        )}
      </section>

      {tab === "cifra" && (
        <>
          <div
            ref={cifraRef}
            onTouchStart={() => autoFollow && setAutoFollow(false)}
            onWheel={() => autoFollow && setAutoFollow(false)}
            style={{ position: "relative", flex: 1, minHeight: 0, overflowY: "auto", overflowX: "auto", WebkitOverflowScrolling: "touch", padding: "4px 2px 24px" }}
          >
            {hasChords ? (
              <CifraView sections={song.chords ?? []} lyrics={song.lyrics} currentTime={currentTime} fontSize={fontSize} />
            ) : song.cifraText ? (
              <CifraText text={song.cifraText} fontSize={fontSize} />
            ) : (
              <div className="app-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.5, fontSize: 14 }}>{t("noChords")}</p>
                <Link href={{ pathname: "/song/[slug]", params: { slug: song.slug } }} className="app-btn app-btn--surface" style={{ height: 46 }}>
                  {t("openFull")}
                </Link>
              </div>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ height: 4, background: "var(--surface3)", borderRadius: 2, overflow: "hidden" }} aria-hidden="true">
              <div style={{ width: total ? `${Math.min(100, (currentTime / total) * 100)}%` : "0%", height: "100%", background: "var(--accent)" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" onClick={togglePlay} aria-label={playing ? ts("pause") : t("play")}
                style={{ width: 52, height: 52, borderRadius: 26, border: 0, background: "var(--accent)", color: "#0d0d0f", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                {playing ? <IconPause size={22} /> : <IconPlay size={24} />}
              </button>
              <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: "var(--muted)", minWidth: 40 }}>{formatTime(currentTime)}</div>
              <button type="button" onClick={() => { void haptic(); setAutoFollow((v) => !v); }} aria-pressed={autoFollow}
                style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 12, border: "1px solid var(--border2)", background: autoFollow ? "rgba(255,154,0,0.16)" : "transparent", color: autoFollow ? "var(--accent)" : "var(--muted)", font: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {autoFollow ? t("scrollAuto") : t("scrollManual")}
              </button>
              <button type="button" onClick={() => setFontSize((f) => Math.max(12, f - 1))} aria-label={t("fontDown")} style={smallBtn}>A−</button>
              <button type="button" onClick={() => setFontSize((f) => Math.min(28, f + 1))} aria-label={t("fontUp")} style={smallBtn}>A+</button>
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 18 }}>
              <button type="button" onClick={() => seekBy(-10)} style={textBtn}>{t("back10")}</button>
              <Link href={{ pathname: "/song/[slug]", params: { slug: song.slug } }} style={{ ...textBtn, color: "var(--accent)" }}>{t("fixChart")}</Link>
              <button type="button" onClick={() => seekBy(10)} style={textBtn}>{t("fwd10")}</button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

const smallBtn: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 12, border: "1px solid var(--border2)", background: "var(--surface)",
  color: "var(--text)", font: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0,
};
const textBtn: React.CSSProperties = {
  font: "inherit", display: "inline-flex", alignItems: "center", background: "none", border: "none", padding: "8px 4px", minHeight: 44,
  color: "var(--muted)", fontSize: 13, fontWeight: 600, cursor: "pointer",
};

function Stepper({ label, value, locked, onDown, onUp, downLabel, upLabel }: {
  label: string; value: string; locked: boolean; onDown: () => void; onUp: () => void; downLabel: string; upLabel: string;
}) {
  const btn: React.CSSProperties = {
    width: 40, height: 40, borderRadius: 10, border: 0, background: "var(--surface3)", color: "var(--text)",
    font: "inherit", fontSize: 18, cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.45 : 1, flexShrink: 0,
  };
  return (
    <div className="app-card" style={{ borderRadius: 14, padding: "10px 10px 10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)" }}>
        {label.toUpperCase()}{locked && <span style={{ color: "var(--accent)", marginLeft: 6 }}>PRO</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button type="button" onClick={onDown} disabled={locked} aria-label={downLabel} style={btn}>−</button>
          <button type="button" onClick={onUp} disabled={locked} aria-label={upLabel} style={btn}>+</button>
        </div>
      </div>
    </div>
  );
}
