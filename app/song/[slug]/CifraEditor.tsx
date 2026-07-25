"use client";

/**
 * Editor unificado de letra + cifra (correção pela comunidade).
 * Dois modos: "Linhas" (estruturado, preserva o tempo de cada linha → highlight e
 * auto-scroll seguem funcionando) e "Texto" (livre, estilo CifraClub — acordes
 * sobre a letra; ao salvar, re-sincroniza os tempos por ordem de linha).
 * Salva nos endpoints existentes: PATCH /songs/:id/lyrics e /songs/:id/chords.
 */
import { useState } from "react";

type LyricsLine = { time: number; text: string };
type ChordSection = { section: string; timecode: number; chords: string; times?: number[] };
type Row = { time: number; text: string; chords: string };

const CHORD_RE = /^[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|M|º|°|\+)?\d*(?:\([^)]*\))?(?:sus\d)?(?:\/[A-G][#b]?)?$/;
function isChordLine(line: string): boolean {
  const toks = line.trim().split(/\s+/).filter(Boolean);
  return toks.length > 0 && toks.every((t) => CHORD_RE.test(t));
}

const isPositional = (s: string) => /^\s/.test(s) || /\s{2,}/.test(s);

/** Monta a string da linha de acordes posicionando cada um na sua coluna. */
function assembleChordLine(placements: { col: number; chord: string }[]): string {
  let line = "";
  let cursor = 0;
  for (const p of [...placements].sort((a, b) => a.col - b.col)) {
    const col = Math.max(p.col, cursor);
    while (line.length < col) line += " ";
    line += p.chord;
    cursor = col + p.chord.length + 1;
  }
  return line;
}

/** Junta letra + cifra em linhas unificadas {tempo, texto, acordes POSICIONADOS}. */
function buildRows(lyrics: LyricsLine[], chords: ChordSection[]): Row[] {
  // Seções já POSICIONADAS (editadas) são preservadas; as AUTO viram eventos por tempo.
  const alignedByTime = new Map<string, string>();
  const autoSections: ChordSection[] = [];
  for (const sec of chords) {
    if (isPositional(sec.chords)) alignedByTime.set(sec.timecode.toFixed(1), sec.chords);
    else autoSections.push(sec);
  }
  const events: { time: number; chord: string }[] = [];
  for (let s = 0; s < autoSections.length; s++) {
    const toks = autoSections[s].chords.split(" ").filter(Boolean);
    const t0 = autoSections[s].timecode;
    const t1 = s + 1 < autoSections.length ? autoSections[s + 1].timecode : t0 + toks.length * 2;
    const times = autoSections[s].times && autoSections[s].times!.length === toks.length ? autoSections[s].times! : null;
    toks.forEach((c, j) => events.push({ time: times ? times[j] : t0 + ((t1 - t0) * j) / toks.length, chord: c }));
  }
  events.sort((a, b) => a.time - b.time);

  if (lyrics.length) {
    return lyrics.map((l, i) => {
      const t0 = l.time;
      const aligned = alignedByTime.get(t0.toFixed(1));
      if (aligned) return { time: l.time, text: l.text, chords: aligned };
      const t1 = i + 1 < lyrics.length ? lyrics[i + 1].time : Infinity;
      const inLine = events.filter((e) => e.time >= t0 && e.time < t1);
      const placements = inLine.map((e) => {
        const frac = t1 === Infinity ? 0 : Math.max(0, Math.min(1, (e.time - t0) / (t1 - t0)));
        return { col: Math.round(frac * Math.max(1, l.text.length)), chord: e.chord };
      });
      return { time: l.time, text: l.text, chords: assembleChordLine(placements) };
    });
  }
  if (chords.length) return chords.map((c) => ({ time: c.timecode, text: "", chords: c.chords }));
  return [{ time: 0, text: "", chords: "" }];
}

function rowsToText(rows: Row[]): string {
  return rows.map((r) => (r.chords.trim() ? `${r.chords}\n${r.text}` : r.text)).join("\n\n");
}

/** Faz parse do texto livre; reatribui tempos por ordem (mantém os antigos quando existem). */
function textToRows(text: string, prev: Row[]): Row[] {
  const out: Row[] = [];
  let pending = "";
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    if (!raw.trim()) continue;
    if (isChordLine(raw)) pending = raw.replace(/\s+$/, ""); // preserva o recuo (posição)
    else { out.push({ time: 0, text: raw.replace(/\s+$/, ""), chords: pending }); pending = ""; }
  }
  if (pending) out.push({ time: 0, text: "", chords: pending });
  let last = 0;
  return out.map((r, i) => {
    const time = prev[i] ? prev[i].time : last + 2;
    last = time;
    return { ...r, time };
  });
}

export default function CifraEditor({
  songId, initialLyrics, initialChords, currentTime, onSaved, onCancel,
}: {
  songId: number;
  initialLyrics: LyricsLine[];
  initialChords: ChordSection[];
  currentTime: number;
  onSaved: (lyrics: LyricsLine[], chords: ChordSection[]) => void;
  onCancel: () => void;
}) {
  // Padrão = Texto (área simples estilo CifraClub); Linhas fica pra ajuste fino/sincronia.
  const [mode, setMode] = useState<"linhas" | "texto">("texto");
  const [rows, setRows] = useState<Row[]>(() => buildRows(initialLyrics, initialChords));
  const [text, setText] = useState(() => rowsToText(buildRows(initialLyrics, initialChords)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function switchMode(m: "linhas" | "texto") {
    if (m === mode) return;
    if (m === "texto") setText(rowsToText(rows));
    else setRows((prev) => textToRows(text, prev));
    setMode(m);
  }

  const updateRow = (i: number, patch: Partial<Row>) => setRows((p) => p.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = (i: number) => setRows((p) => { const c = [...p]; c.splice(i + 1, 0, { time: (p[i]?.time ?? 0) + 2, text: "", chords: "" }); return c; });
  const removeRow = (i: number) => setRows((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : p));
  const grabTime = (i: number) => updateRow(i, { time: Math.round(currentTime * 10) / 10 });

  async function save() {
    if (saving) return;
    const finalRows = mode === "texto" ? textToRows(text, rows) : rows;
    const lyrics = finalRows.filter((r) => r.text.trim()).map((r) => ({ time: Number(r.time) || 0, text: r.text.trim() }));
    const chords = finalRows.filter((r) => r.chords.trim()).map((r) => ({ section: "", timecode: Number(r.time) || 0, chords: r.chords.replace(/\s+$/, "") }));
    setSaving(true); setError("");
    try {
      const [rl, rc] = await Promise.all([
        fetch(`/api/songs/${songId}/lyrics`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lyrics }) }),
        fetch(`/api/songs/${songId}/chords`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chords }) }),
      ]);
      if (!rl.ok || !rc.ok) { setError("Erro ao salvar. Tente de novo."); return; }
      onSaved(lyrics.sort((a, b) => a.time - b.time), chords);
    } catch { setError("Erro de conexão. Tente novamente."); } finally { setSaving(false); }
  }

  const tabBtn = (m: "linhas" | "texto", label: string) => (
    <button onClick={() => switchMode(m)} style={{
      background: mode === m ? "var(--accent)" : "var(--surface2)", color: mode === m ? "#000" : "var(--muted)",
      border: "1px solid var(--border2)", borderRadius: 6, padding: "4px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
    }}>{label}</button>
  );

  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <p style={{ fontWeight: 700, fontSize: 12, letterSpacing: "0.08em", color: "var(--muted)", margin: 0 }}>CORRIGIR LETRA + CIFRA</p>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>{tabBtn("texto", "Texto")}{tabBtn("linhas", "Linhas + sincronia")}</div>
      </div>

      {mode === "linhas" ? (
        <>
          <p style={{ color: "var(--muted2)", fontSize: 12, margin: "0 0 12px" }}>
            Corrija o texto de cada linha e os acordes dela. O ⏱ fixa o tempo da linha no ponto atual da música (útil pra ajustar a sincronia).
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "42vh", overflowY: "auto" }}>
            {rows.map((r, i) => (
              <div key={i} style={{ border: "1px solid var(--border2)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                <input value={r.chords} onChange={(e) => updateRow(i, { chords: e.target.value })} placeholder="Acordes da linha (ex: D C D7)"
                  style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, color: "var(--chord)", padding: "6px 9px", borderRadius: 7, border: "1px solid var(--border2)", background: "var(--surface2)", fontSize: 13, outline: "none" }} />
                <input value={r.text} onChange={(e) => updateRow(i, { text: e.target.value })} placeholder="Letra da linha"
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)", fontSize: 14, outline: "none" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted2)" }}>
                  <span>t = {Number(r.time).toFixed(1)}s</span>
                  <button onClick={() => grabTime(i)} title="Fixar no tempo atual da música" style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "2px 8px", cursor: "pointer", color: "var(--text)", fontSize: 12 }}>⏱ capturar</button>
                  <button onClick={() => addRow(i)} title="Adicionar linha abaixo" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 16 }}>＋</button>
                  <button onClick={() => removeRow(i)} title="Remover linha" style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--muted2)", fontSize: 18 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p style={{ color: "var(--muted2)", fontSize: 12, margin: "0 0 10px" }}>
            Formato CifraClub: a linha de <strong style={{ color: "var(--chord)" }}>acordes</strong> vem em cima, a linha da <strong>letra</strong> logo abaixo, e uma linha em branco separa cada trecho. Os tempos são reaproveitados por ordem ao salvar.
          </p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
            style={{ width: "100%", height: "42vh", fontFamily: "'Courier New', monospace", fontSize: 14, lineHeight: 1.5, padding: 12, borderRadius: 10, border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)", outline: "none", boxSizing: "border-box", whiteSpace: "pre" }} />
        </>
      )}

      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: "12px 0 0" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onCancel} style={{ background: "none", border: "1px solid var(--border2)", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "var(--text)" }}>Cancelar</button>
        <button onClick={save} disabled={saving} className="btn-primary" style={{ padding: "8px 20px", fontSize: 13, opacity: saving ? 0.6 : 1 }}>{saving ? "Salvando..." : "Salvar correção"}</button>
      </div>
    </div>
  );
}
