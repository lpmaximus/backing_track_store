"use client";

/**
 * Editor unificado de letra + cifra (correção pela comunidade).
 * Dois modos: "Linhas" (estruturado, preserva o tempo de cada linha → highlight e
 * auto-scroll seguem funcionando) e "Texto" (livre, estilo CifraClub — acordes
 * sobre a letra).
 *
 * ─── O que estava quebrado ──────────────────────────────────────────────────
 * 1. Os tempos eram reatribuídos POR POSIÇÃO na lista (`prev[i].time`). Juntar,
 *    dividir ou apagar uma linha — que é exatamente o que se faz ao corrigir uma
 *    transcrição ruim — deslocava a sincronia de tudo dali pra frente.
 *    Agora as linhas são casadas PELO TEXTO: linha que não mudou mantém o tempo
 *    exato, e linha nova recebe tempo interpolado entre as vizinhas.
 * 2. A regex de acorde não aceitava a notação brasileira (C7M, A9M, B5+, G4/7).
 *    Um token reprovado rebaixava a LINHA INTEIRA a letra — era o "B5+  C5" que
 *    aparecia no campo de letra. A regex agora mora no CifraView e é a mesma que
 *    a tela de leitura usa.
 * 3. O que era salvo não era o que a tela lia: gravávamos "estes acordes são
 *    desta linha" e a CifraView redistribuía tudo por tempo. Agora cada seção vai
 *    com `aligned: true` e o vínculo é respeitado.
 * 4. Cabeçalho [Intro] virava linha de letra. Agora vira `section`.
 * 5. Letra e cifra iam em dois PATCH paralelos, sem transação — um podia gravar
 *    e o outro falhar. Agora é uma requisição só (/api/songs/:id/cifra).
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import { isChordLine } from "./CifraView";

type LyricsWord = { text: string; start: number; end: number };
type LyricsLine = { time: number; text: string; words?: LyricsWord[] };
type ChordSection = { section: string; timecode: number; chords: string; times?: number[]; aligned?: boolean };
type Row = { id: number; time: number; text: string; chords: string; section: string };

/** Mesma precisão usada para casar cifra com letra (0,1s). */
const r1 = (n: number) => Math.round(n * 10) / 10;

let rowSeq = 0;
const nextId = () => ++rowSeq;

const SECTION_RE = /^\[([^\]]{1,40})\]$/;
const isPositional = (s: string) => /^\s/.test(s) || /\s{2,}/.test(s);
const isAlignedSection = (sec: ChordSection) => sec.aligned === true || isPositional(sec.chords);

/** Texto normalizado p/ casar linhas entre a versão antiga e a nova. */
const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

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

/** Coluna (em caracteres) de cada palavra da linha — p/ ancorar o acorde. */
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

/** Junta letra + cifra em linhas unificadas {tempo, texto, acordes POSICIONADOS}. */
function buildRows(lyrics: LyricsLine[], chords: ChordSection[]): Row[] {
  const alignedSecs = chords.filter(isAlignedSection).sort((a, b) => a.timecode - b.timecode);
  const autoSections = chords.filter((s) => !isAlignedSection(s)).sort((a, b) => a.timecode - b.timecode);
  const used = new Set<number>();

  const events: { time: number; chord: string }[] = [];
  for (let s = 0; s < autoSections.length; s++) {
    const toks = autoSections[s].chords.split(" ").filter(Boolean);
    if (!toks.length) continue;
    const t0 = autoSections[s].timecode;
    const t1 = s + 1 < autoSections.length ? autoSections[s + 1].timecode : t0 + toks.length * 2;
    const times = autoSections[s].times && autoSections[s].times!.length === toks.length ? autoSections[s].times! : null;
    toks.forEach((c, j) => events.push({ time: times ? times[j] : t0 + ((t1 - t0) * j) / toks.length, chord: c }));
  }
  events.sort((a, b) => a.time - b.time);

  function takeAligned(time: number): ChordSection | undefined {
    let bestIdx = -1;
    let bestDelta = 0.2;
    for (let i = 0; i < alignedSecs.length; i++) {
      if (used.has(i)) continue;
      const d = Math.abs(alignedSecs[i].timecode - time);
      if (d <= bestDelta) { bestIdx = i; bestDelta = d; }
    }
    if (bestIdx < 0) return undefined;
    used.add(bestIdx);
    return alignedSecs[bestIdx];
  }

  const ordered = [...lyrics].sort((a, b) => a.time - b.time);
  const rows: Row[] = [];

  if (ordered.length) {
    ordered.forEach((l, i) => {
      const t0 = l.time;
      const aligned = takeAligned(t0);
      if (aligned) {
        rows.push({ id: nextId(), time: r1(t0), text: l.text, chords: aligned.chords, section: aligned.section || "" });
        return;
      }
      const t1 = i + 1 < ordered.length ? ordered[i + 1].time : Infinity;
      const inLine = events.filter((e) => e.time >= t0 && e.time < t1);
      const woffs = wordOffsets(l.text, l.words);
      const placements = inLine.map((e) => {
        let col: number;
        if (woffs.length) {
          let wo = woffs[0];
          for (const w of woffs) { if (w.start <= e.time) wo = w; else break; }
          col = wo.col;
        } else {
          const frac = t1 === Infinity ? 0 : Math.max(0, Math.min(1, (e.time - t0) / (t1 - t0)));
          col = Math.round(frac * Math.max(1, l.text.length));
        }
        return { col, chord: e.chord };
      });
      rows.push({ id: nextId(), time: r1(t0), text: l.text, chords: assembleChordLine(placements), section: "" });
    });
    // Trecho instrumental salvo sem letra: vira linha própria em vez de sumir.
    alignedSecs.forEach((sec, i) => {
      if (used.has(i)) return;
      rows.push({ id: nextId(), time: r1(sec.timecode), text: "", chords: sec.chords, section: sec.section || "" });
    });
    return rows.sort((a, b) => a.time - b.time);
  }

  if (chords.length) {
    return [...chords]
      .sort((a, b) => a.timecode - b.timecode)
      .map((c) => ({ id: nextId(), time: r1(c.timecode), text: "", chords: c.chords, section: c.section || "" }));
  }
  return [{ id: nextId(), time: 0, text: "", chords: "", section: "" }];
}

function rowsToText(rows: Row[]): string {
  const out: string[] = [];
  let lastSection = "";
  for (const r of rows) {
    if (r.section && r.section !== lastSection) { out.push(`[${r.section}]`); lastSection = r.section; }
    out.push(r.chords.trim() ? `${r.chords}\n${r.text}` : r.text);
  }
  return out.join("\n\n");
}

/**
 * Reatribui os tempos casando as linhas PELO TEXTO (não pela posição). Linha que
 * o usuário não mexeu mantém o tempo exato; linha nova recebe tempo interpolado
 * entre as âncoras vizinhas. É o que impede que juntar ou apagar uma linha
 * desloque a sincronia da música inteira.
 */
function reassignTimes(rows: Row[], prev: Row[]): Row[] {
  const times: (number | null)[] = rows.map(() => null);
  const LOOKAHEAD = 12;
  let cursor = 0;
  for (let i = 0; i < rows.length; i++) {
    const key = norm(rows[i].text);
    if (!key) continue;
    for (let j = cursor; j < prev.length && j < cursor + LOOKAHEAD; j++) {
      if (norm(prev[j].text) === key) { times[i] = prev[j].time; cursor = j + 1; break; }
    }
  }

  const known: { t: number; i: number }[] = [];
  times.forEach((t, i) => { if (t !== null) known.push({ t, i }); });

  // Nenhuma âncora (letra reescrita do zero): distribui no mesmo intervalo.
  if (known.length === 0) {
    const base = prev.length ? prev[0].time : 0;
    const span = prev.length > 1 ? prev[prev.length - 1].time - prev[0].time : 0;
    const step = rows.length > 1 && span > 0 ? span / (rows.length - 1) : 2;
    return rows.map((r, i) => ({ ...r, time: r1(base + step * i) }));
  }

  const out = rows.map((r, i) => ({ ...r, time: times[i] ?? 0 }));
  const first = known[0];
  const last = known[known.length - 1];
  const avg = known.length > 1
    ? Math.max(0.5, (last.t - first.t) / Math.max(1, last.i - first.i))
    : 2;

  for (let i = first.i - 1; i >= 0; i--) out[i].time = r1(Math.max(0, first.t - avg * (first.i - i)));
  for (let k = 0; k + 1 < known.length; k++) {
    const a = known[k];
    const b = known[k + 1];
    const gaps = b.i - a.i;
    for (let i = a.i + 1; i < b.i; i++) out[i].time = r1(a.t + ((b.t - a.t) * (i - a.i)) / gaps);
  }
  for (let i = last.i + 1; i < out.length; i++) out[i].time = r1(last.t + avg * (i - last.i));

  for (let i = 1; i < out.length; i++) {
    if (out[i].time <= out[i - 1].time) out[i].time = r1(out[i - 1].time + 0.1);
  }
  return out;
}

/** Faz parse do texto livre em linhas, reconhecendo [Seção] e linha de acordes. */
function textToRows(text: string, prev: Row[]): Row[] {
  const out: Row[] = [];
  let pendingChords = "";
  let section = "";
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const sec = trimmed.match(SECTION_RE);
    if (sec) { section = sec[1].trim(); continue; }        // [Intro] é seção, não letra
    if (isChordLine(raw)) { pendingChords = raw.replace(/\s+$/, ""); continue; } // preserva o recuo
    out.push({ id: nextId(), time: 0, text: raw.replace(/\s+$/, ""), chords: pendingChords, section });
    pendingChords = "";
    section = "";
  }
  // Acordes sem letra embaixo (trecho instrumental) continuam sendo uma linha.
  if (pendingChords) out.push({ id: nextId(), time: 0, text: "", chords: pendingChords, section });
  if (out.length === 0) return prev.length ? prev : [{ id: nextId(), time: 0, text: "", chords: "", section: "" }];
  return reassignTimes(out, prev);
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
  const t = useTranslations("song");
  const tc = useTranslations("common");
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
  const addRow = (i: number) => setRows((p) => {
    const c = [...p];
    const before = p[i]?.time ?? 0;
    const after = p[i + 1]?.time;
    // Linha nova nasce ENTRE as vizinhas, não "a última + 2s" no escuro.
    const time = after !== undefined && after > before ? r1((before + after) / 2) : r1(before + 2);
    c.splice(i + 1, 0, { id: nextId(), time, text: "", chords: "", section: "" });
    return c;
  });
  const removeRow = (i: number) => setRows((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : p));
  const grabTime = (i: number) => updateRow(i, { time: r1(currentTime) });

  async function save() {
    if (saving) return;
    const finalRows = mode === "texto" ? textToRows(text, rows) : rows;

    // Letra e cifra saem da MESMA lista, já ordenada por tempo — antes o servidor
    // ordenava só a letra e as duas listas passavam a discordar de quem vem antes.
    const kept = finalRows
      .filter((r) => r.text.trim() || r.chords.trim())
      .map((r) => ({ ...r, time: r1(Number(r.time) || 0) }))
      .sort((a, b) => a.time - b.time);

    const lyrics: LyricsLine[] = kept.map((r) => ({ time: r.time, text: r.text.replace(/\s+$/, "") }));
    const chords: ChordSection[] = kept
      .filter((r) => r.chords.trim())
      .map((r) => ({
        section: r.section || "",
        timecode: r.time,
        chords: r.chords.replace(/\s+$/, ""),
        // A marca que faltava: diz à tela de leitura que estes acordes pertencem
        // A ESTA linha e não devem ser redistribuídos por tempo.
        aligned: true,
      }));

    setSaving(true); setError("");
    try {
      // Uma requisição só: letra e cifra são gravadas no mesmo UPDATE. Antes eram
      // dois PATCH em paralelo e uma falha isolada deixava as duas desalinhadas.
      const res = await fetch(`/api/songs/${songId}/cifra`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics, chords }),
      });
      if (!res.ok) { setError(t("errSaveRetry")); return; }
      const data = await res.json().catch(() => null);
      onSaved(data?.song?.lyrics ?? lyrics, data?.song?.chords ?? chords);
    } catch { setError(t("errConnection")); } finally { setSaving(false); }
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
            {t("cifraEditorHelp")}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "42vh", overflowY: "auto" }}>
            {rows.map((r, i) => (
              <div key={r.id} style={{ border: "1px solid var(--border2)", borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                {r.section && (
                  <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 11, letterSpacing: "0.08em" }}>[{r.section}]</span>
                )}
                <input value={r.chords} onChange={(e) => updateRow(i, { chords: e.target.value })} placeholder="Acordes da linha (ex: D C D7)"
                  style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, color: "var(--chord)", padding: "6px 9px", borderRadius: 7, border: "1px solid var(--border2)", background: "var(--surface2)", fontSize: 13, outline: "none" }} />
                <input value={r.text} onChange={(e) => updateRow(i, { text: e.target.value })} placeholder="Letra da linha"
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)", fontSize: 14, outline: "none" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted2)" }}>
                  <span>t = {Number(r.time).toFixed(1)}s</span>
                  <button onClick={() => grabTime(i)} title={t("grabTime")} style={{ background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 6, padding: "2px 8px", cursor: "pointer", color: "var(--text)", fontSize: 12 }}>⏱ capturar</button>
                  <button onClick={() => addRow(i)} title={t("addLineBelow")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 16 }}>＋</button>
                  <button onClick={() => removeRow(i)} title={t("removeLine")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--muted2)", fontSize: 18 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <p style={{ color: "var(--muted2)", fontSize: 12, margin: "0 0 10px" }}>
            {t.rich("cifraFormatHelp", {
              chord: (c) => <strong style={{ color: "var(--chord)" }}>{c}</strong>,
              b: (c) => <strong>{c}</strong>,
            })}
          </p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
            style={{ width: "100%", height: "42vh", fontFamily: "'Courier New', monospace", fontSize: 14, lineHeight: 1.5, padding: 12, borderRadius: 10, border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)", outline: "none", boxSizing: "border-box", whiteSpace: "pre" }} />
        </>
      )}

      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: "12px 0 0" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button onClick={onCancel} style={{ background: "none", border: "1px solid var(--border2)", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "var(--text)" }}>{tc("cancel")}</button>
        <button onClick={save} disabled={saving} className="btn-primary" style={{ padding: "8px 20px", fontSize: 13, opacity: saving ? 0.6 : 1 }}>{saving ? t("saving") : t("saveFix")}</button>
      </div>
    </div>
  );
}
