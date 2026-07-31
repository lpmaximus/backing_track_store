"use client";

/**
 * Painel de download do player (recurso Pro / ProBand — ADR-BTS-001).
 *
 * Duas entregas a partir da MESMA seleção de faixas, porque são dois usos
 * diferentes do mesmo músico:
 *  · "Baixar mixagem"  — um arquivo só com o que ele montou na mesa. É a base
 *    que vai pro celular tocar no ensaio ou no culto.
 *  · "Faixas separadas" — os arquivos originais, um por instrumento, pra abrir
 *    no DAW. Sem reencode: o que sai é bit a bit o que está no R2.
 *
 * A seleção NASCE do que está audível na mesa (semeada toda vez que o painel
 * abre). Quem mutou a guitarra pra tocar por cima não quer marcar caixinha de
 * novo — ele já disse o que quer quando mexeu no M/S.
 *
 * Todo o trabalho pesado é no navegador (ver exportAudio.ts): nenhum byte sobe,
 * nenhuma função serverless roda, nenhum egress extra do R2.
 */

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  exportMixdown,
  downloadOriginal,
  downloadBlob,
  safeFileName,
  extFromUrl,
  type MixPart,
} from "./exportAudio";

export type DownloadTrack = {
  key: string;
  instrument: string;
  label: string;
  audioUrl: string;
};

type Props = {
  tracks: DownloadTrack[];
  /** Faixas que estão soando agora (mute/solo já resolvidos pela mesa). */
  audible: Record<string, boolean>;
  /** Volume 0–1 por faixa, usado como ganho no render da mixagem. */
  trackVol: Record<string, number>;
  /** Buffers já decodificados pelo player — evita baixar o áudio de novo. */
  getBuffer: (key: string) => AudioBuffer | null;
  songTitle: string;
  songArtist: string;
  isPro: boolean;
  /** O motor terminou de carregar; sem isso não há buffer pra mixar. */
  ready: boolean;
  /** Avisa o pai que houve export (analytics — evento "export"). */
  onExport?: (kind: "mix" | "stems", count: number) => void;
};

type Busy = null | { phase: "render" | "encode" | "stems"; pct: number };

export default function DownloadPanel({
  tracks, audible, trackVol, getBuffer, songTitle, songArtist, isPro, ready, onExport,
}: Props) {
  const tx = useTranslations("song");
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  // Semeia a seleção com o que está audível toda vez que o painel abre.
  useEffect(() => {
    if (!open) return;
    setChecked(Object.fromEntries(tracks.map((t) => [t.key, audible[t.key] !== false])));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tracks]);

  const selected = tracks.filter((t) => checked[t.key]);
  const baseName = safeFileName(`${songArtist} - ${songTitle}`);

  const toggle = (key: string) =>
    setChecked((p) => ({ ...p, [key]: !p[key] }));

  const allOn = tracks.length > 0 && tracks.every((t) => checked[t.key]);
  const toggleAll = () =>
    setChecked(Object.fromEntries(tracks.map((t) => [t.key, !allOn])));

  // ── Mixagem: renderiza offline e encoda ────────────────────────────────────
  const downloadMix = useCallback(async () => {
    if (busy || selected.length === 0) return;
    setError(null);
    setBusy({ phase: "render", pct: 0 });
    try {
      const parts: MixPart[] = [];
      for (const t of selected) {
        const buffer = getBuffer(t.key);
        if (!buffer) continue;
        parts.push({ buffer, gain: trackVol[t.key] ?? 1 });
      }
      if (parts.length === 0) throw new Error("no-buffer");

      const { blob, ext } = await exportMixdown(parts, (p) =>
        setBusy({ phase: "encode", pct: p }),
      );
      // Sufixo com o nº de faixas: o músico costuma exportar várias versões da
      // mesma música (sem vocal, só base…) e um nome repetido vira "(1)", "(2)".
      const suffix = selected.length === tracks.length ? tx("dlFull") : tx("dlCustom");
      downloadBlob(blob, `${baseName} (${suffix}).${ext}`);
      onExport?.("mix", selected.length);
    } catch (err) {
      console.error("[download] falha na mixagem", err);
      setError(tx("dlError"));
    } finally {
      setBusy(null);
    }
  }, [busy, selected, getBuffer, trackVol, baseName, tracks.length, tx, onExport]);

  // ── Faixas separadas: baixa o arquivo original de cada uma ─────────────────
  const downloadStems = useCallback(async () => {
    if (busy || selected.length === 0) return;
    setError(null);
    setBusy({ phase: "stems", pct: 0 });
    let done = 0;
    let failed = 0;
    try {
      for (const t of selected) {
        try {
          const name = `${baseName} - ${safeFileName(t.label)}.${extFromUrl(t.audioUrl)}`;
          await downloadOriginal(t.audioUrl, name);
          done++;
        } catch (err) {
          console.error("[download] falha na faixa", t.key, err);
          failed++;
        }
        setBusy({ phase: "stems", pct: (done + failed) / selected.length });
        // Alguns browsers engolem downloads disparados em rajada.
        await new Promise((r) => setTimeout(r, 350));
      }
      if (failed > 0) setError(tx("dlPartial", { n: failed }));
      if (done > 0) onExport?.("stems", done);
    } finally {
      setBusy(null);
    }
  }, [busy, selected, baseName, tx, onExport]);

  // ── Sem Pro: botão vira porta de entrada do plano ───────────────────────────
  if (!isPro) {
    return (
      <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span className="pro-badge">PRO</span>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{tx("dlGate")}</span>
        <a href="/planos" style={{ marginLeft: "auto", color: "var(--accent)", fontWeight: 700, fontSize: 13 }}>
          {tx("tryFree")}
        </a>
      </div>
    );
  }

  const busyLabel =
    busy?.phase === "render" ? tx("dlRendering")
      : busy?.phase === "encode" ? tx("dlEncoding", { pct: Math.round(busy.pct * 100) })
        : busy?.phase === "stems" ? tx("dlDownloading", { pct: Math.round(busy.pct * 100) })
          : null;

  return (
    <div style={{ borderTop: "1px solid var(--border)" }}>
      {/* Cabeçalho / abre-fecha */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", flexWrap: "wrap" }}>
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={!ready}
          aria-expanded={open}
          style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: open ? "var(--accent)" : "var(--surface2)",
            color: open ? "#000" : (ready ? "var(--text)" : "var(--muted2)"),
            border: `1px solid ${open ? "var(--accent)" : "var(--border2)"}`,
            borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700,
            cursor: ready ? "pointer" : "default",
          }}
        >
          ⬇ {tx("dlTitle")}
        </button>
        {!open && (
          <span style={{ fontSize: 12, color: "var(--muted2)" }}>{tx("dlHint")}</span>
        )}
        {busyLabel && (
          <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>{busyLabel}</span>
        )}
      </div>

      {open && (
        <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Seleção de faixas */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--muted)" }}>
                {tx("dlTracks")}
              </span>
              <button
                onClick={toggleAll}
                style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                {allOn ? tx("dlNone") : tx("dlAll")}
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {tracks.map((t) => {
                const on = !!checked[t.key];
                return (
                  <label
                    key={t.key}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "6px 12px", borderRadius: 8, cursor: "pointer", userSelect: "none",
                      background: on ? "rgba(255,154,0,0.10)" : "var(--surface2)",
                      border: `1px solid ${on ? "rgba(255,154,0,0.45)" : "var(--border2)"}`,
                      fontSize: 13, fontWeight: 600,
                      color: on ? "var(--text)" : "var(--muted)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(t.key)}
                      style={{ accentColor: "var(--accent)", cursor: "pointer" }}
                    />
                    {t.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Ações */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={downloadMix}
              disabled={!!busy || selected.length === 0}
              style={{
                background: "var(--accent)", color: "#000", border: "none", borderRadius: 8,
                padding: "9px 18px", fontSize: 13, fontWeight: 700,
                cursor: busy || selected.length === 0 ? "default" : "pointer",
                opacity: busy || selected.length === 0 ? 0.5 : 1,
              }}
            >
              {tx("dlMix", { n: selected.length })}
            </button>
            <button
              onClick={downloadStems}
              disabled={!!busy || selected.length === 0}
              style={{
                background: "var(--surface2)", color: "var(--text)",
                border: "1px solid var(--border2)", borderRadius: 8,
                padding: "9px 18px", fontSize: 13, fontWeight: 700,
                cursor: busy || selected.length === 0 ? "default" : "pointer",
                opacity: busy || selected.length === 0 ? 0.5 : 1,
              }}
            >
              {tx("dlSeparate", { n: selected.length })}
            </button>
          </div>

          {/* Barra de progresso */}
          {busy && (
            <div style={{ height: 4, borderRadius: 2, background: "var(--surface3)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.round(busy.pct * 100)}%`, background: "var(--accent)", transition: "width 0.2s" }} />
            </div>
          )}

          {error && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}>⚠ {error}</p>
          )}

          <p style={{ margin: 0, fontSize: 11, color: "var(--muted2)", lineHeight: 1.5 }}>
            {tx("dlNote")}
          </p>
        </div>
      )}
    </div>
  );
}
