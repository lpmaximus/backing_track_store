"use client";

import { useEffect, useState } from "react";

type CatalogSong = {
  id: number;
  slug: string;
  title: string;
  artist: string;
  genre: string;
  key: string;
  bpm: number;
  thumbnailUrl: string | null;
};

type MySong = CatalogSong & { processingStatus: string };

export type AddedItem = {
  id: number;
  position: number;
  notes: string | null;
  // Preparo do repertório (S2 / ADR-BTS-005): a música entra sem transposição,
  // em velocidade normal e sem intervalo. `duration` alimenta a soma do setlist.
  transposeSemitones: number;
  speed: string | number;
  gapSeconds: number;
  songId: number;
  slug: string;
  title: string;
  artist: string;
  genre: string;
  key: string;
  bpm: number;
  duration: number;
  thumbnailUrl: string | null;
};

/**
 * Painel de busca embutido na página da setlist: deixa adicionar músicas do
 * catálogo público OU da biblioteca do próprio usuário (faixas enviadas em
 * /upload, já prontas) sem precisar sair da setlist e ir na página da música.
 */
export default function AddSongPicker({
  setlistId,
  existingSongIds,
  onAdded,
}: {
  setlistId: number;
  existingSongIds: number[];
  onAdded: (item: AddedItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [mine, setMine] = useState<MySong[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogSong[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Minhas músicas prontas — carregadas uma vez ao abrir o painel.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/songs/mine");
        if (!res.ok) { if (!cancelled) setMine([]); return; }
        const data = await res.json();
        if (!cancelled) {
          setMine(Array.isArray(data) ? data.filter((s: MySong) => s.processingStatus === "ready") : []);
        }
      } catch {
        if (!cancelled) setMine([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Debounce da busca.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Busca no catálogo público quando há termo suficiente.
  useEffect(() => {
    if (debounced.length < 2) { setCatalog([]); return; }
    let cancelled = false;
    setLoadingCatalog(true);
    fetch(`/api/songs?q=${encodeURIComponent(debounced)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => { if (!cancelled) setCatalog(Array.isArray(data) ? data : []); })
      .finally(() => { if (!cancelled) setLoadingCatalog(false); });
    return () => { cancelled = true; };
  }, [debounced]);

  const existing = new Set(existingSongIds);
  const q = query.trim().toLowerCase();

  const mineFiltered = (mine ?? []).filter((s) => {
    if (existing.has(s.id)) return false;
    if (!q) return true;
    return s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q);
  });

  const mineIds = new Set(mineFiltered.map((s) => s.id));
  const catalogFiltered = catalog.filter((s) => !existing.has(s.id) && !mineIds.has(s.id));

  async function addSong(songId: number) {
    if (adding) return;
    setAdding(songId);
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
      onAdded(data.item);
    } catch {
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setAdding(null);
    }
  }

  function Row({ s }: { s: CatalogSong }) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 10px", borderRadius: 8 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", margin: "0 0 1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {s.title}
          </p>
          <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>{s.artist} · {s.key} · {s.bpm} BPM</p>
        </div>
        <button
          onClick={() => addSong(s.id)}
          disabled={adding === s.id}
          style={{
            background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 8,
            padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", color: "var(--text)", flexShrink: 0,
          }}
        >
          {adding === s.id ? "..." : "+ Adicionar"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nome ou artista..."
        autoFocus
        style={{
          width: "100%", padding: "10px 14px", borderRadius: 10, marginBottom: 12,
          border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
          fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
        }}
      />

      {mine === null ? (
        <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "10px 0" }}>Carregando...</p>
      ) : (
        <>
          {mineFiltered.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", color: "var(--muted2)", margin: "0 0 4px", textTransform: "uppercase" }}>
                Minhas músicas
              </p>
              {mineFiltered.map((s) => <Row key={`mine-${s.id}`} s={s} />)}
            </div>
          )}

          {debounced.length >= 2 && (
            <div>
              <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", color: "var(--muted2)", margin: "0 0 4px", textTransform: "uppercase" }}>
                Catálogo
              </p>
              {loadingCatalog ? (
                <p style={{ color: "var(--muted)", fontSize: 13, padding: "6px 0" }}>Buscando...</p>
              ) : catalogFiltered.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 13, padding: "6px 0", fontStyle: "italic" }}>Nenhum resultado.</p>
              ) : (
                catalogFiltered.map((s) => <Row key={`cat-${s.id}`} s={s} />)
              )}
            </div>
          )}

          {mineFiltered.length === 0 && debounced.length < 2 && (
            <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "10px 0", fontStyle: "italic" }}>
              {q ? "Nenhuma música sua encontrada." : "Digite para buscar no catálogo, ou envie suas próprias faixas em Enviar."}
            </p>
          )}
        </>
      )}

      {error && <p style={{ color: "var(--danger)", fontSize: 12, margin: "8px 0 0" }}>{error}</p>}
    </div>
  );
}
