"use client";

import { useState } from "react";
import Link from "next/link";
import { adminHeaders } from "../adminClient";

export type Report = {
  id: number;
  reason: string | null;
  createdAt: string;
  songId: number;
  songTitle: string;
  songSlug: string;
  reporterEmail: string;
};
export type History = {
  id: number;
  createdAt: string;
  songId: number;
  songTitle: string;
  songSlug: string;
  editorEmail: string;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" } as const;

export default function ModeracaoContent({ reports, history, onRefresh }: { reports: Report[]; history: History[]; onRefresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function act(key: string, body: object) {
    setBusy(key);
    try {
      const res = await fetch("/api/admin/moderacao", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) onRefresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ width: "100%" }}>
      <h1 style={{ fontWeight: 900, fontSize: 26, margin: "0 0 4px", color: "var(--text)" }}>Moderação de cifras</h1>
      <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 24px" }}>Denúncias abertas e histórico recente de edições.</p>

      <h2 style={{ fontSize: 13, letterSpacing: "0.1em", color: "var(--muted)", fontWeight: 700, margin: "0 0 12px" }}>
        DENÚNCIAS ABERTAS ({reports.length})
      </h2>
      {reports.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13, fontStyle: "italic", marginBottom: 32 }}>Nenhuma denúncia aberta.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 32 }}>
          {reports.map((r) => (
            <div key={r.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <Link href={`/song/${r.songSlug}`} style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{r.songTitle}</Link>
                  <p style={{ color: "var(--muted)", fontSize: 13, margin: "4px 0 0" }}>
                    {r.reason || <span style={{ fontStyle: "italic" }}>sem motivo informado</span>}
                  </p>
                  <p style={{ color: "var(--muted2)", fontSize: 11, margin: "4px 0 0" }}>{r.reporterEmail} · {fmt(r.createdAt)}</p>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button disabled={busy === `res-${r.id}`} onClick={() => act(`res-${r.id}`, { action: "resolveReport", reportId: r.id, status: "resolved" })}
                    style={{ background: "var(--accent)", color: "#000", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Resolver
                  </button>
                  <button disabled={busy === `dis-${r.id}`} onClick={() => act(`dis-${r.id}`, { action: "resolveReport", reportId: r.id, status: "dismissed" })}
                    style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border2)", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    Descartar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 13, letterSpacing: "0.1em", color: "var(--muted)", fontWeight: 700, margin: "0 0 12px" }}>
        EDIÇÕES RECENTES
      </h2>
      {history.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13, fontStyle: "italic" }}>Nenhuma edição registrada.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {history.map((h) => (
            <div key={h.id} style={{ ...card, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <Link href={`/song/${h.songSlug}`} style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>{h.songTitle}</Link>
                <p style={{ color: "var(--muted2)", fontSize: 11, margin: "4px 0 0" }}>{h.editorEmail} · {fmt(h.createdAt)}</p>
              </div>
              <button disabled={busy === `rev-${h.id}`} onClick={() => act(`rev-${h.id}`, { action: "revert", historyId: h.id })}
                style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border2)", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                {busy === `rev-${h.id}` ? "..." : "Reverter"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
