"use client";

/**
 * Cifra unificada (acordes sobre a letra, estilo CifraClub) — extraída de
 * SongPlayer.tsx para reuso no modo palco (Fase S3 / ADR-BTS-005).
 *
 * Por que um módulo à parte: o modo palco (StagePlayer) precisa exatamente da
 * mesma renderização de cifra que a página da música — incluindo o fallback
 * para cifra em texto legado e para "sem cifra ainda" — para tocar em
 * sequência várias músicas sem duplicar ~170 linhas de lógica de
 * posicionamento de acorde.
 *
 * ─── O que mudou (correção do editor) ───────────────────────────────────────
 * Antes, saber se uma linha de acordes tinha sido POSICIONADA por uma pessoa era
 * adivinhado a partir do espaçamento da string (`isPositional`). Como o próprio
 * editor sugere "D C D7" — espaço simples —, toda correção manual caía no ramo
 * "saída automática" e tinha os acordes REDISTRIBUÍDOS por tempo: o acorde que a
 * pessoa pôs na linha 5 reaparecia nas linhas 3, 6 e 8. Agora o editor grava
 * `aligned: true` e o vínculo linha→acorde é respeitado. O `isPositional` fica
 * só como leitura de cifras salvas antes desta correção.
 */

import ChordToken from "./ChordDiagram";

export type ChordSection = {
  section: string;
  timecode: number;
  chords: string;
  times?: number[]; // tempo de cada acorde em `chords` (quando disponível)
  aligned?: boolean; // string posicionada por uma pessoa — renderiza literal
};

export type LyricsWord = { text: string; start: number; end: number };
export type LyricsLine = { time: number; text: string; words?: LyricsWord[] };

export function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

// ─── Reconhecimento de acorde ─────────────────────────────────────────────────
/**
 * Aceita a notação internacional E a brasileira. A regex antiga só admitia a
 * qualidade ANTES do número, então "C7M", "A9M", "B5+", "G4/7" e "E7/9" — a
 * escrita corrente no Brasil — eram rejeitadas. No editor isso rebaixava a linha
 * inteira a letra (era o "B5+  C5" que apareceu no campo de letra).
 */
const CHORD_RE =
  /^(?:[A-G][#b]?(?:m|min|M|maj|Δ|°|º|dim|aug|sus)?(?:[#b]?\d{1,2}[+\-#b]?|[+-])*(?:M|maj)?(?:\([^()]{0,10}\))*(?:sus\d?|add\d{1,2})*(?:\/(?:[A-G][#b]?|\d{1,2}))?)$/;

/** Marcações de cifra que não são acorde: compasso, repetição, "sem acorde". */
const MARKER_RE = /^(?:N\.?C\.?|\||\|{1,2}:|:\|{1,2}|%|\d{1,2}\s*[xX]|[xX]\d{1,2}|\[[^\]]*\])$/;

/** É um acorde de verdade (ganha diagrama e cor de acorde)? */
export function isChordToken(token: string): boolean {
  return CHORD_RE.test(token.trim());
}

/**
 * É acorde OU marcação legítima de cifra (não deve virar letra)?
 * Tolera as barras de compasso do formato CifraClub — "|A|", "|:", ":|" — que
 * antes derrubavam a linha inteira para o campo de letra.
 */
export function isChordLineToken(token: string): boolean {
  const t = token.trim();
  if (!t) return false;
  if (CHORD_RE.test(t) || MARKER_RE.test(t)) return true;
  const core = t.replace(/^[|:]+/, "").replace(/[|:]+$/, "");
  return core !== t && (core === "" || CHORD_RE.test(core) || MARKER_RE.test(core));
}

/** Uma linha inteira é linha de acordes? (todos os tokens passam) */
export function isChordLine(line: string): boolean {
  const toks = line.trim().split(/\s+/).filter(Boolean);
  return toks.length > 0 && toks.every(isChordLineToken);
}

/**
 * Desenha um token da cifra. Só acorde de verdade vira ChordToken (com diagrama);
 * "[Intro]", "|A|" e "3X" viram texto simples — antes eles eram renderizados como
 * se fossem acordes, com direito a diagrama de violão para "3X".
 */
function Token({ name, color, fontSize, marginRight }: { name: string; color: string; fontSize: number; marginRight: number }) {
  if (isChordToken(name)) {
    return <ChordToken name={name} color={color} fontSize={fontSize} marginRight={marginRight} />;
  }
  return (
    <span style={{ color: "var(--muted2)", fontSize: fontSize - 1, marginRight, fontWeight: 600 }}>{name}</span>
  );
}

// ─── Cifra texto legado ───────────────────────────────────────────────────────
export function CifraText({ text, fontSize }: { text: string; fontSize: number }) {
  return (
    <div style={{ fontFamily: "'Courier New', monospace", fontSize, lineHeight: 2 }}>
      {text.split("\n").map((line, i) => {
        if (/^\[.+\]$/.test(line.trim())) {
          return <div key={i} style={{ color: "var(--accent)", fontWeight: 700, fontSize: fontSize - 1, letterSpacing: "0.06em", marginTop: 20, marginBottom: 4 }}>{line}</div>;
        }
        if (isChordLine(line) && line.trim()) {
          return (
            <div key={i} style={{ marginBottom: 2 }}>
              {line.split(/(\s+)/).map((p, j) =>
                p.trim()
                  ? <Token key={j} name={p} color="var(--chord)" fontSize={fontSize} marginRight={10} />
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
  const ordered = [...sections].sort((a, b) => a.timecode - b.timecode);
  const activeIdx = ordered.reduce((best, sec, i) => sec.timecode <= currentTime ? i : best, 0);

  return (
    <div style={{ fontFamily: "'Courier New', monospace", fontSize, lineHeight: 2.2 }}>
      <style>{`@keyframes bts-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      {ordered.map((sec, i) => {
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
                <Token key={j} name={chord} color={isActive ? "var(--chord)" : "var(--muted)"} fontSize={fontSize} marginRight={14} />
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
  // Ordena por TEMPO antes de calcular a janela. A rota de correção gravava a
  // cifra na ordem em que chegou (a letra ela ordenava), então bastava usar o
  // "⏱ capturar" fora de ordem para o fim da janela vir do elemento errado do
  // array — a diferença ficava negativa e os acordes andavam para trás.
  const ordered = [...sections].sort((a, b) => a.timecode - b.timecode);
  const events: ChordEvent[] = [];
  for (let s = 0; s < ordered.length; s++) {
    const sec = ordered[s];
    const tokens = sec.chords.split(" ").filter(Boolean);
    if (!tokens.length) continue;
    const t0 = sec.timecode;
    const t1 = s + 1 < ordered.length ? ordered[s + 1].timecode : t0 + tokens.length * 2;
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

/**
 * Cifra salva ANTES da correção do editor não tem `aligned`. Nesses casos ainda
 * dá pra inferir pelo espaçamento (recuo ou 2+ espaços = alguém posicionou).
 */
const isPositional = (s: string) => /^\s/.test(s) || /\s{2,}/.test(s);
const isAlignedSection = (sec: ChordSection) => sec.aligned === true || isPositional(sec.chords);

/** Tolerância p/ casar o tempo de uma seção com o de uma linha da letra. */
const MATCH_TOLERANCE = 0.2;

function ChordRow({ placed, fontSize }: { placed: { col: number; chord: string }[]; fontSize: number }) {
  if (placed.length === 0) return null;
  return (
    <div style={{ position: "relative", whiteSpace: "pre", height: Math.round(fontSize * 1.5) }}>
      {placed.map((p, k) => (
        <span key={k} style={{ position: "absolute", left: `${p.col}ch`, bottom: 0 }}>
          <Token name={p.chord} color="var(--chord)" fontSize={fontSize} marginRight={0} />
        </span>
      ))}
    </div>
  );
}

function SectionLabel({ label, fontSize }: { label: string; fontSize: number }) {
  if (!label) return null;
  return (
    <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: fontSize - 2, letterSpacing: "0.08em", marginTop: 14, marginBottom: 2 }}>
      {label.toUpperCase()}
    </div>
  );
}

export function CifraView({ sections, lyrics, currentTime, fontSize }: {
  sections: ChordSection[]; lyrics: LyricsLine[] | null; currentTime: number; fontSize: number;
}) {
  // Sem letra → visão de acordes por trecho (a de sempre).
  if (!lyrics || lyrics.length === 0) {
    return <ChordDisplay sections={sections} currentTime={currentTime} fontSize={fontSize} />;
  }

  const ordered = [...lyrics].sort((a, b) => a.time - b.time);

  // Seções POSICIONADAS mandam sobre as AUTO: são a correção de uma pessoa e
  // devem aparecer exatamente onde ela pôs. Casadas por proximidade de tempo em
  // vez de igualdade de string — arredondamento não pode desfazer o vínculo.
  const alignedSecs = sections.filter(isAlignedSection).sort((a, b) => a.timecode - b.timecode);
  const autoSections = sections.filter((s) => !isAlignedSection(s));
  const usedAligned = new Set<number>();

  /** Pega a seção posicionada mais próxima daquele tempo e a consome. */
  function alignedFor(time: number): ChordSection | undefined {
    let bestIdx = -1;
    let bestDelta = MATCH_TOLERANCE;
    for (let idx = 0; idx < alignedSecs.length; idx++) {
      if (usedAligned.has(idx)) continue;
      const delta = Math.abs(alignedSecs[idx].timecode - time);
      if (delta <= bestDelta) { bestIdx = idx; bestDelta = delta; }
    }
    if (bestIdx < 0) return undefined;
    usedAligned.add(bestIdx);
    return alignedSecs[bestIdx];
  }

  const events = buildChordEvents(autoSections);
  const activeIdx = ordered.reduce((best, l, i) => (l.time <= currentTime ? i : best), -1);

  const rows = ordered.map((line, i) => {
    const t0 = line.time;
    const t1 = i + 1 < ordered.length ? ordered[i + 1].time : Infinity;

    const aligned = alignedFor(t0);
    let placed: { col: number; chord: string }[];
    if (aligned) {
      placed = parseAligned(aligned.chords); // posição EXATA que a pessoa salvou
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
    return { kind: "line" as const, time: t0, text: line.text, section: aligned?.section ?? "", placed, index: i };
  });

  // Seções posicionadas que não casaram com nenhuma linha (trecho instrumental
  // salvo sem letra). Antes elas eram silenciosamente engolidas pela linha de
  // cima; agora ganham uma linha própria, na posição certa do tempo.
  const orphans = alignedSecs
    .filter((_, idx) => !usedAligned.has(idx))
    .map((sec) => ({ kind: "orphan" as const, time: sec.timecode, text: "", section: sec.section, placed: parseAligned(sec.chords), index: -1 }));

  const all = [...rows, ...orphans].sort((a, b) => a.time - b.time);

  return (
    <div style={{ fontFamily: "'Courier New', monospace", fontSize, lineHeight: 1.5 }}>
      {all.map((row, k) => {
        const isActive = row.kind === "line" && row.index === activeIdx;
        return (
          <div key={k}>
            <SectionLabel label={row.section} fontSize={fontSize} />
            <div data-t={row.time} style={{ marginBottom: 12, padding: "2px 8px", borderRadius: 6, background: isActive ? "rgba(255,154,0,0.10)" : "transparent" }}>
              <ChordRow placed={row.placed} fontSize={fontSize} />
              <div style={{ whiteSpace: "pre", color: isActive ? "var(--text)" : "var(--muted)", fontWeight: isActive ? 700 : 400 }}>
                {row.text || " "}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
