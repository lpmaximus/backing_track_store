"use client";

/**
 * Cifra unificada (acordes sobre a letra, estilo CifraClub) — extraída de
 * SongPlayer.tsx para reuso no modo palco (Fase S3 / ADR-BTS-005).
 *
 * Por que um módulo à parte: o modo palco (StagePlayer) precisa exatamente da
 * mesma renderização de cifra que a página da música — incluindo o fallback
 * para cifra em texto legado e para "sem cifra ainda" — para tocar em
 * sequência várias músicas sem duplicar ~170 linhas de lógica de
 * posicionamento de acorde. SongPlayer.tsx foi atualizado para importar daqui
 * em vez de definir tudo localmente; o comportamento não mudou.
 */

import ChordToken from "./ChordDiagram";

export type ChordSection = {
  section: string;
  timecode: number;
  chords: string;
  times?: number[]; // tempo de cada acorde em `chords` (quando disponível)
};

export type LyricsWord = { text: string; start: number; end: number };
export type LyricsLine = { time: number; text: string; words?: LyricsWord[] };

export function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

// ─── Cifra texto legado ───────────────────────────────────────────────────────
export function CifraText({ text, fontSize }: { text: string; fontSize: number }) {
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

// ─── Cifra sincronizada (sem letra: acordes por trecho) ───────────────────────
export function ChordDisplay({ sections, currentTime, fontSize }: { sections: ChordSection[]; currentTime: number; fontSize: number }) {
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

/** Posiciona cada acorde na sua coluna (em nº de caracteres), empurrando pra
 *  direita se sobrepor. Colunas em `ch` alinham com a letra monoespaçada. */
function layoutChords(placements: { col: number; chord: string }[]): { col: number; chord: string }[] {
  const out: { col: number; chord: string }[] = [];
  let cursor = 0;
  for (const p of [...placements].sort((a, b) => a.col - b.col)) {
    const col = Math.max(p.col, cursor);
    out.push({ col, chord: p.chord });
    cursor = col + p.chord.length + 1; // +1 = espaço mínimo entre acordes
  }
  return out;
}

/** Lê uma linha de acordes POSICIONADA (com espaçamento) → {col,chord} por coluna. */
function parseAligned(chordLine: string): { col: number; chord: string }[] {
  const out: { col: number; chord: string }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chordLine)) !== null) out.push({ col: m.index, chord: m[0] });
  return out;
}
/** Linha foi posicionada pelo usuário (recuo/gaps) vs. lista simples "Bm E". */
function isPositional(chordLine: string): boolean {
  return /^\s/.test(chordLine) || /\s{2,}/.test(chordLine);
}
const timeKey = (t: number) => t.toFixed(1);

export function CifraView({ sections, lyrics, currentTime, fontSize }: {
  sections: ChordSection[]; lyrics: LyricsLine[] | null; currentTime: number; fontSize: number;
}) {
  // Sem letra → visão de acordes por trecho (a de sempre).
  if (!lyrics || lyrics.length === 0) {
    return <ChordDisplay sections={sections} currentTime={currentTime} fontSize={fontSize} />;
  }

  // Seções POSICIONADAS (editadas: espaçamento preservado, alinhadas ao tempo da
  // linha) mandam sobre as AUTO (lista "Bm E", posicionadas por tempo).
  const alignedByTime = new Map<string, string>();
  const autoSections: ChordSection[] = [];
  for (const sec of sections) {
    if (isPositional(sec.chords)) alignedByTime.set(timeKey(sec.timecode), sec.chords);
    else autoSections.push(sec);
  }
  const events = buildChordEvents(autoSections);
  const activeIdx = lyrics.reduce((best, l, i) => (l.time <= currentTime ? i : best), -1);

  return (
    <div style={{ fontFamily: "'Courier New', monospace", fontSize, lineHeight: 1.5 }}>
      {lyrics.map((line, i) => {
        const t0 = line.time;
        const t1 = i + 1 < lyrics.length ? lyrics[i + 1].time : Infinity;

        const aligned = alignedByTime.get(timeKey(t0));
        let placed: { col: number; chord: string }[];
        if (aligned) {
          placed = parseAligned(aligned); // posição EXATA que o usuário salvou
        } else {
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
          placed = layoutChords(placements);
        }
        const isActive = i === activeIdx;

        return (
          <div key={i} data-t={t0} style={{ marginBottom: 12, padding: "2px 8px", borderRadius: 6, background: isActive ? "rgba(255,154,0,0.10)" : "transparent" }}>
            {placed.length > 0 && (
              <div style={{ position: "relative", whiteSpace: "pre", height: Math.round(fontSize * 1.5) }}>
                {placed.map((p, k) => (
                  <span key={k} style={{ position: "absolute", left: `${p.col}ch`, bottom: 0 }}>
                    <ChordToken name={p.chord} color="var(--chord)" fontSize={fontSize} marginRight={0} />
                  </span>
                ))}
              </div>
            )}
            <div style={{ whiteSpace: "pre", color: isActive ? "var(--text)" : "var(--muted)", fontWeight: isActive ? 700 : 400 }}>
              {line.text || " "}
            </div>
          </div>
        );
      })}
    </div>
  );
}
