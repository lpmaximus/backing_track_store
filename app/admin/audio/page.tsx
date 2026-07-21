"use client";

import { useEffect, useState, type CSSProperties } from "react";
import AdminGate from "../AdminGate";
import { adminHeaders } from "../adminClient";

type AudioRow = {
  id: number;
  slug: string;
  title: string;
  artist: string;
  sourceType: string;
  uploaderEmail: string | null;
  moderationStatus: string;
  processingStatus: string;
  published: boolean;
  shared: boolean;
  createdAt: string;
  stemCount: number;
};

const FILTERS = ["all", "approved", "pending", "blocked"] as const;
const statusColor: Record<string, string> = { approved: "var(--accent)", pending: "#f59e0b", blocked: "var(--danger)" };

function AudioContent() {
  const [rows, setRows] = useState<AudioRow[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [loading, setLoading] = useState(true);

  async function load(f: string) {
    setLoading(true);
    const qs = f === "all" ? "" : `?status=${f}`;
    const res = await fetch(`/api/admin/audio${qs}`, { headers: adminHeaders() });
    if (res.ok) setRows((await res.json()).songs ?? []);
    setLoading(false);
  }
  useEffect(() => { load(filter); }, [filter]);

  async function setStatus(songId: number, moderationStatus: string) {
    const res = await fetch("/api/admin/audio", { method: "PATCH", headers: adminHeaders(), body: JSON.stringify({ songId, moderationStatus }) });
    if (res.ok) load(filter);
  }
  async function remove(songId: number, title: string) {
    if (!confirm(`Excluir "${title}" do catálogo? (takedown definitivo — remove do banco)`)) return;
    const res = await fetch(`/api/admin/audio?id=${songId}`, { method: "DELETE", headers: adminHeaders() });
    if (res.ok) load(filter);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h1 style={{ color: "var(--text)", fontSize: 22, fontWeight: 800, margin: 0 }}>Áudio ({rows.length})</h1>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: filter === f ? "#f59e0b" : "var(--surface2)", color: filter === f ? "#000" : "var(--muted)", border: "1px solid var(--border)" }}>
              {f === "all" ? "Todos" : f}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p style={{ color: "var(--muted)" }}>Carregando…</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.length === 0 && <p style={{ color: "var(--muted)", fontStyle: "italic" }}>Nada aqui.</p>}
          {rows.map((s) => (
            <div key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, color: "var(--text)", fontWeight: 700, fontSize: 14 }}>{s.title} <span style={{ color: "var(--muted2)", fontWeight: 400 }}>· {s.artist}</span></p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--muted)" }}>
                  <span style={{ color: statusColor[s.moderationStatus] ?? "var(--muted)", fontWeight: 700 }}>{s.moderationStatus.toUpperCase()}</span>
                  {" · "}{s.sourceType === "user_upload" ? `upload (${s.uploaderEmail ?? "?"})` : "admin"}
                  {" · "}{s.stemCount} stems · {s.processingStatus}
                  {s.shared && " · compartilhada"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <a href={`/song/${s.slug}`} target="_blank" rel="noreferrer" style={{ background: "var(--surface2)", color: "var(--muted)", border: "1px solid var(--border)", padding: "5px 10px", borderRadius: 6, fontSize: 12, textDecoration: "none" }}>Ver</a>
                {s.moderationStatus !== "blocked"
                  ? <button onClick={() => setStatus(s.id, "blocked")} style={btn("#f59e0b")}>Bloquear</button>
                  : <button onClick={() => setStatus(s.id, "approved")} style={btn("var(--accent)")}>Aprovar</button>}
                <button onClick={() => remove(s.id, s.title)} style={btn("var(--danger)")}>Excluir</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function btn(color: string): CSSProperties {
  return { background: "var(--surface2)", border: `1px solid ${color}`, color, padding: "5px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600 };
}

export default function AudioPage() {
  return (
    <AdminGate title="Áudio">
      <AudioContent />
    </AdminGate>
  );
}
