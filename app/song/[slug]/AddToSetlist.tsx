"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type SetlistItem = {
  id: number;
  name: string;
  songCount: number;
};

export default function AddToSetlist({ songId }: { songId: number }) {
  const { data: session } = useSession();
  const [open, setOpen]       = useState(false);
  const [items, setItems]     = useState<SetlistItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding]   = useState<number | null>(null);
  const [done, setDone]       = useState<Set<number>>(new Set());
  const [error, setError]     = useState("");

  const isPro = session?.user?.role === "pro" || session?.user?.role === "admin";
  if (!isPro) return null;

  async function toggle() {
    setOpen(v => !v);
    if (!open && items === null) {
      setLoading(true);
      try {
        const res = await fetch("/api/setlists");
        const data = await res.json();
        if (res.ok) setItems(data.setlists ?? []);
      } finally {
        setLoading(false);
      }
    }
  }

  async function addTo(setlistId: number) {
    if (adding) return;
    setAdding(setlistId);
    setError("");
    try {
      const res = await fetch(`/api/setlists/${setlistId}/songs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao adicionar");
        return;
      }
      setDone(prev => new Set(prev).add(setlistId));
    } catch {
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setAdding(null);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={toggle} style={{
        background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8,
        padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "var(--text)",
        display: "flex", alignItems: "center", gap: 6, width: "100%", justifyContent: "center",
      }}>
        ➕ Adicionar à setlist
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{
            position: "absolute", top: "calc(100% + 8px)", left: 0, right: 0, zIndex: 50,
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
            padding: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.12)", maxHeight: 280, overflowY: "auto",
          }}>
            {loading ? (
              <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "12px 0", margin: 0 }}>Carregando...</p>
            ) : !items || items.length === 0 ? (
              <div style={{ textAlign: "center", padding: "10px 6px" }}>
                <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 8px" }}>Voce ainda nao tem setlists.</p>
                <Link href="/setlists" style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13 }}>Criar a primeira</Link>
              </div>
            ) : (
              <>
                {items.map(s => {
                  const added = done.has(s.id);
                  return (
                    <button key={s.id} onClick={() => !added && addTo(s.id)} disabled={adding === s.id || added}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%",
                        background: "none", border: "none", borderRadius: 8, padding: "9px 10px", textAlign: "left",
                        cursor: added ? "default" : "pointer", color: "var(--text)", fontSize: 13,
                      }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                      <span style={{ color: added ? "var(--accent)" : "var(--muted2)", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {added ? "✓ Adicionada" : adding === s.id ? "..." : "Adicionar"}
                      </span>
                    </button>
                  );
                })}
                <div style={{ borderTop: "1px solid var(--border)", marginTop: 6, paddingTop: 6 }}>
                  <Link href="/setlists" style={{ display: "block", padding: "8px 10px", color: "var(--accent)", fontSize: 12, fontWeight: 700 }}>
                    Gerenciar setlists →
                  </Link>
                </div>
              </>
            )}
            {error && <p style={{ color: "var(--danger)", fontSize: 12, margin: "6px 6px 0" }}>{error}</p>}
          </div>
        </>
      )}
    </div>
  );
}
