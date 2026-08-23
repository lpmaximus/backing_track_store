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
  applyCuts,
  type MixPart,
} from "./exportAudio";
import { fxVazio, type TakeFx } from "@/src/lib/takeFx";
import type { Cut } from "@/src/lib/cuts";
import { renderTakeComFx } from "./takeFxNodes";

export type DownloadTrack = {
  key: string;
  instrument: string;
  label: string;
  audioUrl: string;
  /** Só as gravações do usuário preenchem — ver MixPart.offsetSec. */
  offsetMs?: number;
  /**
   * Formato real do arquivo, quando a URL não revela. É o caso das gravações:
   * elas são servidas por `/api/takes/:id/audio`, que não tem extensão. Sem
   * isto o download salvaria um `.webm` com nome `.mp3`.
   */
  fileExt?: string;
  /** Efeito da gravação — renderizado no arquivo, não só ouvido no player. */
  fx?: TakeFx | null;
  /** Marca a faixa como gravação do usuário (só elas têm efeito e offset). */
  takeId?: number;
  /**
   * Trechos apagados nesta faixa (ver src/lib/cuts.ts). Entram no arquivo
   * exportado: o download tem de soar como o player. Faixa com corte NÃO pode
   * sair pelo caminho do "arquivo original" — ele é o áudio inteiro.
   */
  cuts?: Cut[];
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
  /**
   * Duração da MÚSICA. Sem ela, uma gravação em que a pessoa esqueceu o
   * microfone aberto esticaria o arquivo exportado com silêncio no fim.
   */
  songDuration?: number;
  /** Avisa o pai que houve export (analytics — evento "export"). */
  onExport?: (kind: "mix" | "stems", count: number) => void;
};

type Busy = null | { phase: "render" | "encode" | "stems"; pct: number };

export default function DownloadPanel({
  tracks, audible, trackVol, getBuffer, songTitle, songArtist, isPro, ready, songDuration, onExport,
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

        // Gravação com efeito é renderizada ANTES de entrar na mixagem, com a
        // mesma cadeia que o player usa (ver takeFxNodes.ts). Sem isso o
        // arquivo sairia seco: soaria certo na tela e diferente no download —
        // a mesma armadilha do offset, e a pessoa só descobriria depois de
        // mandar o arquivo para a banda.
        //
        // A renderização já posiciona o take na linha do tempo, então o
        // `offsetSec` aqui vai zerado — aplicá-lo duas vezes dobraria o
        // deslocamento.
        if (t.takeId != null && !fxVazio(t.fx)) {
          const comFx = await renderTakeComFx(
            buffer,
            t.fx,
            (t.offsetMs ?? 0) / 1000,
            songDuration && songDuration > 0 ? songDuration : buffer.duration,
          );
          // Corte DEPOIS do efeito, na mesma ordem da cadeia do player (faixa →
          // efeito → corte): assim a cauda do reverb também emudece dentro do
          // trecho apagado. Aplicar antes deixaria o rastro do reverb vazar
          // exatamente para o pedaço que a pessoa quis limpar.
          //
          // O render já posicionou a gravação na linha do tempo da música, então
          // aqui o corte entra sem offset — somá-lo de novo dobraria o
          // deslocamento e o silêncio cairia no lugar errado.
          const pronta = t.cuts?.length ? applyCuts(comFx, t.cuts, 0) : comFx;
          parts.push({ buffer: pronta, gain: trackVol[t.key] ?? 1, offsetSec: 0 });
          continue;
        }

        // O offset da gravação do usuário viaja junto: sem ele a pessoa
        // encaixa o take no player, baixa, e ouve o arquivo torto. O mesmo
        // offset converte o corte (que é tempo de música) para dentro do
        // arquivo.
        const off = (t.offsetMs ?? 0) / 1000;
        parts.push({
          buffer: t.cuts?.length ? applyCuts(buffer, t.cuts, off) : buffer,
          gain: trackVol[t.key] ?? 1,
          offsetSec: off,
        });
      }
      if (parts.length === 0) throw new Error("no-buffer");

      const { blob, ext } = await exportMixdown(
        parts,
        (p) => setBusy({ phase: "encode", pct: p }),
        songDuration,
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
  }, [busy, selected, getBuffer, trackVol, baseName, tracks.length, tx, onExport, songDuration]);

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
          // Gravação COM efeito não pode sair pelo arquivo original: ele é a
          // captação seca. Renderiza a cadeia e encoda, para a faixa avulsa
          // soar igual ao que se ouve no player e igual à mixagem.
          // Faixa com corte também sai renderizada, e não como arquivo
          // original: o original é o áudio INTEIRO, e baixá-lo devolveria
          // justamente o trecho que a pessoa apagou.
          if (t.takeId != null && (!fxVazio(t.fx) || t.cuts?.length)) {
            const buffer = getBuffer(t.key);
            if (!buffer) throw new Error("no-buffer");
            const off = (t.offsetMs ?? 0) / 1000;
            const comFx = fxVazio(t.fx)
              ? buffer
              : await renderTakeComFx(
                buffer,
                t.fx,
                off,
                songDuration && songDuration > 0 ? songDuration : buffer.duration,
              );
            // Sem efeito, o buffer continua na linha do tempo do ARQUIVO e o
            // corte precisa do offset; com efeito, o render já reposicionou.
            const pronta = t.cuts?.length
              ? applyCuts(comFx, t.cuts, fxVazio(t.fx) ? off : 0)
              : comFx;
            const { blob, ext: e2 } = await exportMixdown([{ buffer: pronta, gain: 1 }]);
            downloadBlob(blob, `${baseName} - ${safeFileName(t.label)}.${e2}`);
            done++;
            setBusy({ phase: "stems", pct: (done + failed) / selected.length });
            await new Promise((r) => setTimeout(r, 350));
            continue;
          }

          // Stem do catálogo com corte: mesmo caso, mas sem efeito nem offset.
          if (t.cuts?.length) {
            const buffer = getBuffer(t.key);
            if (!buffer) throw new Error("no-buffer");
            const { blob, ext: e2 } = await exportMixdown([
              { buffer: applyCuts(buffer, t.cuts, 0), gain: 1 },
            ]);
            downloadBlob(blob, `${baseName} - ${safeFileName(t.label)}.${e2}`);
            done++;
            setBusy({ phase: "stems", pct: (done + failed) / selected.length });
            await new Promise((r) => setTimeout(r, 350));
            continue;
          }

          const ext = t.fileExt ?? extFromUrl(t.audioUrl);
          const name = `${baseName} - ${safeFileName(t.label)}.${ext}`;
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
  }, [busy, selected, baseName, tx, onExport, getBuffer, songDuration]);

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
