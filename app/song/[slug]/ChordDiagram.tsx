"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// ─── Teoria musical básica ────────────────────────────────────────────────────
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SEMITONE: Record<string, number> = Object.fromEntries(SHARP_NAMES.map((n, i) => [n, i]));
const FLAT_TO_SHARP: Record<string, string> = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };

type CoreQuality = "maj" | "min" | "7" | "maj7" | "m7";

const QUALITY_SUFFIX: Record<CoreQuality, string> = {
  maj: "", min: "m", "7": "7", maj7: "maj7", m7: "m7",
};

function parseChord(symbol: string): { root: string; quality: CoreQuality; approx: boolean } | null {
  const m = symbol.trim().match(/^([A-G])([#b]?)(.*)$/);
  if (!m) return null;
  const [, letter, acc, rest] = m;
  let root = letter + acc;
  if (FLAT_TO_SHARP[root]) root = FLAT_TO_SHARP[root];
  if (!(root in SEMITONE)) root = letter;

  const q = rest.split("/")[0].replace(/\s+/g, "");

  let quality: CoreQuality;
  let approx = false;

  if (/^(maj7|M7|7M|Δ)/i.test(q))                       quality = "maj7";
  else if (/^(m7|min7|-7)/i.test(q))                     quality = "m7";
  else if (/^(m6|min6|m9|min9|m11|m13)/i.test(q))        { quality = "m7";  approx = true; }
  else if (/^(dim|°)/i.test(q))                          { quality = "min"; approx = true; }
  else if (/^(aug|\+)/i.test(q))                         { quality = "maj"; approx = true; }
  else if (/^(sus2|sus4|sus|6|9|11|13|add)/i.test(q))    { quality = "maj"; approx = true; }
  else if (/^(maj|M)(?!7)/i.test(q))                     quality = "maj";
  else if (/^(m|min|-)(?!aj)/i.test(q))                  quality = "min";
  else if (/^7/.test(q))                                 quality = "7";
  else                                                   quality = "maj";

  return { root, quality, approx };
}

// ─── Formas (shapes) de acorde ────────────────────────────────────────────────
// frets: 6 posições (Mi grave → Mi agudo). -1 = corda presa/abafada (X), 0 = corda solta (O),
// 1-4 = posição relativa dentro da janela mostrada (casa real = baseFret + posição - 1)
type ChordShape = {
  baseFret: number;
  frets: number[];
  barre?: { from: number; to: number; fret: number };
};

// Formas "E" (pestana com a 6ª corda como referência da fundamental)
const E_TEMPLATES: Record<CoreQuality, number[]> = {
  maj:  [0, 2, 2, 1, 0, 0],
  min:  [0, 2, 2, 0, 0, 0],
  "7":  [0, 2, 0, 1, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  m7:   [0, 2, 0, 0, 0, 0],
};

// Formas "A" (pestana com a 5ª corda como referência da fundamental, 6ª corda presa)
const A_TEMPLATES: Record<CoreQuality, number[]> = {
  maj:  [-1, 0, 2, 2, 2, 0],
  min:  [-1, 0, 2, 2, 1, 0],
  "7":  [-1, 0, 2, 0, 2, 0],
  maj7: [-1, 0, 2, 1, 2, 0],
  m7:   [-1, 0, 2, 0, 1, 0],
};

// Formas abertas "famosas" — sobrepõem a forma algorítmica quando existem
// (algoritmo E/A não produz as formas abertas clássicas de C, D e G)
const OPEN_OVERRIDES: Record<string, ChordShape> = {
  "C":     { baseFret: 1, frets: [-1, 3, 2, 0, 1, 0] },
  "C7":    { baseFret: 1, frets: [-1, 3, 2, 3, 1, 0] },
  "Cmaj7": { baseFret: 1, frets: [-1, 3, 2, 0, 0, 0] },
  "D":     { baseFret: 1, frets: [-1, -1, 0, 2, 3, 2] },
  "Dm":    { baseFret: 1, frets: [-1, -1, 0, 2, 3, 1] },
  "D7":    { baseFret: 1, frets: [-1, -1, 0, 2, 1, 2] },
  "Dmaj7": { baseFret: 1, frets: [-1, -1, 0, 2, 2, 2] },
  "Dm7":   { baseFret: 1, frets: [-1, -1, 0, 2, 1, 1] },
  "G":     { baseFret: 1, frets: [3, 2, 0, 0, 0, 3] },
  "G7":    { baseFret: 1, frets: [3, 2, 0, 0, 0, 1] },
  "Gmaj7": { baseFret: 1, frets: [3, 2, 0, 0, 0, 2] },
};

function buildFromTemplate(root: string, quality: CoreQuality, family: "E" | "A"): ChordShape {
  const template = family === "E" ? E_TEMPLATES[quality] : A_TEMPLATES[quality];
  const offset = (SEMITONE[root] - SEMITONE[family] + 12) % 12;

  const absFrets = template.map(t => (t === -1 ? -1 : t === 0 ? offset : offset + t));
  const baseFret = offset <= 1 ? 1 : offset;
  const frets = absFrets.map(f => (f === -1 ? -1 : f === 0 ? 0 : f - baseFret + 1));

  const barre = offset >= 1
    ? (family === "E" ? { from: 0, to: 5, fret: 1 } : { from: 1, to: 5, fret: 1 })
    : undefined;

  return { baseFret, frets, barre };
}

function sameShape(a: ChordShape, b: ChordShape) {
  return a.baseFret === b.baseFret && a.frets.length === b.frets.length && a.frets.every((f, i) => f === b.frets[i]);
}

function getChordVariations(symbol: string): { shapes: ChordShape[]; approx: boolean } {
  const parsed = parseChord(symbol);
  if (!parsed) return { shapes: [], approx: false };
  const { root, quality, approx } = parsed;

  const shapes: ChordShape[] = [];
  const overrideKey = root + QUALITY_SUFFIX[quality];
  if (OPEN_OVERRIDES[overrideKey]) shapes.push(OPEN_OVERRIDES[overrideKey]);

  const candidates = [buildFromTemplate(root, quality, "E"), buildFromTemplate(root, quality, "A")]
    .sort((a, b) => a.baseFret - b.baseFret);

  for (const s of candidates) {
    if (!shapes.some(existing => sameShape(existing, s))) shapes.push(s);
  }

  return { shapes, approx };
}

// ─── Diagrama (SVG) ───────────────────────────────────────────────────────────
const STRING_X = [14, 32, 50, 68, 86, 104];
const FRET_Y = [20, 46, 72, 98, 124];
const dotY = (rel: number) => (FRET_Y[rel - 1] + FRET_Y[rel]) / 2;

function ChordDiagram({ shape }: { shape: ChordShape }) {
  return (
    <svg viewBox="-14 0 132 142" width={124} height={143} style={{ display: "block", margin: "0 auto" }}>
      {STRING_X.map((x, i) => (
        <line key={`s${i}`} x1={x} y1={FRET_Y[0]} x2={x} y2={FRET_Y[FRET_Y.length - 1]} stroke="var(--muted2)" strokeWidth={1.3} />
      ))}
      {FRET_Y.map((y, i) => (
        <line key={`f${i}`} x1={STRING_X[0]} y1={y} x2={STRING_X[5]} y2={y}
          stroke={i === 0 && shape.baseFret === 1 ? "var(--text)" : "var(--muted2)"}
          strokeWidth={i === 0 && shape.baseFret === 1 ? 3 : 1.2} />
      ))}
      {shape.baseFret > 1 && (
        <text x={STRING_X[0] - 8} y={FRET_Y[0] + 17} fontSize={17} fill="var(--muted)" textAnchor="end" fontWeight={800}>
          {shape.baseFret}ª
        </text>
      )}
      {shape.barre && (
        <line
          x1={STRING_X[shape.barre.from]} y1={dotY(shape.barre.fret)}
          x2={STRING_X[shape.barre.to]} y2={dotY(shape.barre.fret)}
          stroke="var(--chord)" strokeWidth={10} strokeLinecap="round" opacity={0.85}
        />
      )}
      {shape.frets.map((f, i) => {
        if (f === 0) return <circle key={`o${i}`} cx={STRING_X[i]} cy={FRET_Y[0] - 10} r={5.5} fill="none" stroke="var(--text)" strokeWidth={1.6} />;
        if (f === -1) return <text key={`x${i}`} x={STRING_X[i]} y={FRET_Y[0] - 5} fontSize={15} fill="var(--muted2)" textAnchor="middle" fontWeight={800}>×</text>;
        return null;
      })}
      {shape.frets.map((f, i) => {
        if (f <= 0) return null;
        if (shape.barre && f === shape.barre.fret && i >= shape.barre.from && i <= shape.barre.to) return null;
        return <circle key={`d${i}`} cx={STRING_X[i]} cy={dotY(f)} r={7} fill="var(--chord)" />;
      })}
    </svg>
  );
}

// ─── Popover com variações ────────────────────────────────────────────────────
function ChordPopover({ name }: { name: string }) {
  const [variation, setVariation] = useState(0);
  const { shapes, approx } = useMemo(() => getChordVariations(name), [name]);

  if (shapes.length === 0) {
    return (
      <div style={popoverStyle}>
        <p style={{ fontWeight: 800, fontSize: 14, color: "var(--text)", margin: 0 }}>{name}</p>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: "8px 0 0" }}>Diagrama indisponível para este acorde.</p>
      </div>
    );
  }

  const shape = shapes[variation % shapes.length];

  return (
    <div style={popoverStyle}>
      <p style={{ fontWeight: 800, fontSize: 18, color: "var(--text)", margin: "0 0 4px" }}>{name}</p>
      {approx && <p style={{ color: "var(--muted2)", fontSize: 12, margin: "0 0 6px" }}>(forma aproximada)</p>}
      <ChordDiagram shape={shape} />
      {shapes.length > 1 && (
        <>
          <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 8 }}>
            {shapes.map((_, i) => (
              <button key={i} onClick={() => setVariation(i)} aria-label={`Variação ${i + 1}`}
                style={{
                  width: 7, height: 7, padding: 0, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: i === (variation % shapes.length) ? "var(--accent)" : "var(--border2)",
                }} />
            ))}
          </div>
          <button onClick={() => setVariation(v => (v + 1) % shapes.length)}
            style={{ marginTop: 7, background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 14, fontWeight: 700 }}>
            variar acorde
          </button>
        </>
      )}
    </div>
  );
}

const popoverStyle: React.CSSProperties = {
  position: "absolute", zIndex: 100, top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
  background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 12,
  padding: "12px 16px 14px", boxShadow: "0 12px 32px rgba(0,0,0,0.18)", minWidth: 140, textAlign: "center",
};

// ─── Token clicável (usado dentro da cifra) ───────────────────────────────────
type ChordTokenProps = {
  name: string;
  color: string;
  fontSize: number;
  fontWeight?: number;
  marginRight?: number;
};

export default function ChordToken({ name, color, fontSize, fontWeight = 700, marginRight = 14 }: ChordTokenProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <span
        onClick={() => setOpen(v => !v)}
        title="Ver diagrama do acorde"
        style={{
          color, fontWeight, fontSize, marginRight, cursor: "pointer",
          borderBottom: `1px dashed ${open ? color : "transparent"}`,
          transition: "color 0.3s, border-color 0.15s",
        }}
      >
        {name}
      </span>
      {open && <ChordPopover name={name} />}
    </span>
  );
}
