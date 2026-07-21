"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type SharedSong = {
  id: number;
  slug: string;
  title: string;
  artist: string;
  genre: string;
  key: string;
  bpm: number;
  thumbnailUrl: string | null;
  createdAt: string;
};

export default function CompartilhadasContent() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<SharedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  // Acesso Pro efetivo vem da resposta do servidor (403 = sem acesso).
  const [proAccess, setProAccess] = useState<boolean | null>(null);
  const isPro = proAccess === true;
  const accessLoading = status === "loading" || (!!session?.user && proAccess === null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated") { setProAccess(false); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/songs/shared${debounced ? `?q=${encodeURIComponent(debounced)}` : ""}`);
        if (cancelled) return;
        if (res.status === 403) { setProAccess(false); return; }
        setProAccess(true);
        const data = await res.json();
        if (res.ok) setItems(Array.isArray(data) ? data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status, debounced]);

  return (
    <div style={{ flex: 1, maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px", width: "100%" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontWeight: 900, fontSize: 26, margin: "0 0 4px", color: "var(--text)" }}>Compartilhadas</h1>
        <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
          Músicas enviadas e convertidas por outros usuários Pro, disponíveis pra você tocar também
        </p>
      </div>

      {accessLoading ? null : !session?.user ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, textAlign: "center" }}>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 14px" }}>Entre na sua conta pra ver o catálogo compartilhado.</p>
          <Link href="/entrar" className="btn-primary" style={{ padding: "9px 22px", fontSize: 13, display: "inline-block" }}>Entrar</Link>
        </div>
      ) : !isPro ? (
        <div style={{ background: "linear-gradient(135deg, #ffffff 0%, #fff4e0 100%)", border: "1px solid rgba(255,154,0,0.25)", borderRadius: 12, padding: 28, textAlign: "center" }}>
          <span className="pro-badge" style={{ display: "inline-block", marginBottom: 12 }}>PRO</span>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, margin: "0 0 16px" }}>
            O catálogo compartilhado é um recurso exclusivo do plano Pro.
          </p>
        </div>
      ) : (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou artista..."
            style={{
              width: "100%", padding: "11px 14px", borderRadius: 10, marginBottom: 20,
              border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
              fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
            }}
          />

          {loading ? (
            <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Carregando...</p>
          ) : items.length === 0 ? (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 40, textAlign: "center" }}>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, fontStyle: "italic" }}>
                {query.trim() ? "Nenhuma música encontrada." : "Ainda não há músicas compartilhadas por outros usuários."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {items.map((s) => (
                <Link key={s.id} href={`/song/${s.slug}`} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                  padding: "16px 20px", color: "inherit",
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.title}
                    </p>
                    <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
                      {s.artist} · Tom: {s.key} · {s.bpm} BPM
                    </p>
                  </div>
                  <span style={{ color: "var(--muted2)", fontSize: 18, flexShrink: 0 }}>→</span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
