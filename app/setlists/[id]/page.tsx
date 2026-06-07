"use client";

import { useEffect, useState, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteHeader from "@/app/components/SiteHeader";
import SiteFooter from "@/app/components/SiteFooter";

type Setlist = {
  id: number;
  name: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type SongItem = {
  id: number;          // id da linha setlist_songs
  position: number;
  notes: string | null;
  songId: number;
  slug: string;
  title: string;
  artist: string;
  genre: string;
  key: string;
  bpm: number;
  thumbnailUrl: string | null;
};

export default function SetlistDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [setlist, setSetlist] = useState<Setlist | null>(null);
  const [songs, setSongs]     = useState<SongItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);

  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [itemNoteDraft, setItemNoteDraft] = useState("");

  const isPro = session?.user?.role === "pro" || session?.user?.role === "admin";

  async function load() {
    try {
      const res = await fetch(`/api/setlists/${id}`);
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      if (res.ok) {
        setSetlist(data.setlist);
        setSongs(data.songs ?? []);
        setNameDraft(data.setlist.name);
        setNotesDraft(data.setlist.notes ?? "");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (status !== "authenticated" || !isPro) { setLoading(false); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isPro, id]);

  async function saveMeta() {
    if (!nameDraft.trim() || savingMeta) return;
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/setlists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameDraft.trim(), notes: notesDraft.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setSetlist(data.setlist);
        setEditingName(false);
      }
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleDeleteSetlist() {
    if (!confirm(`Excluir a setlist "${setlist?.name}"? Essa acao nao pode ser desfeita.`)) return;
    const res = await fetch(`/api/setlists/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/setlists");
  }

  async function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= songs.length) return;
    const a = songs[index];
    const b = songs[target];

    const reordered = [...songs];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setSongs(reordered);

    await Promise.all([
      fetch(`/api/setlists/${id}/songs/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: b.position }),
      }),
      fetch(`/api/setlists/${id}/songs/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: a.position }),
      }),
    ]);
    load();
  }

  async function saveItemNote(itemId: number) {
    const res = await fetch(`/api/setlists/${id}/songs/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: itemNoteDraft.trim() || null }),
    });
    if (res.ok) {
      const data = await res.json();
      setSongs(prev => prev.map(s => s.id === itemId ? { ...s, notes: data.item.notes } : s));
      setEditingItem(null);
    }
  }

  async function removeItem(itemId: number, title: string) {
    if (!confirm(`Remover "${title}" desta setlist?`)) return;
    const res = await fetch(`/api/setlists/${id}/songs/${itemId}`, { method: "DELETE" });
    if (res.ok) setSongs(prev => prev.filter(s => s.id !== itemId));
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      <SiteHeader />

      <div style={{ flex: 1, maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px", width: "100%" }}>
        <Link href="/setlists" style={{ color: "var(--muted)", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 16 }}>
          ← Minhas setlists
        </Link>

        {status === "loading" || loading ? (
          <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "60px 0" }}>Carregando...</p>
        ) : !session?.user || !isPro ? (
          <div style={{ background: "linear-gradient(135deg, #ffffff 0%, #eafbf1 100%)", border: "1px solid rgba(29,185,84,0.25)", borderRadius: 12, padding: 28, textAlign: "center" }}>
            <span className="pro-badge" style={{ display: "inline-block", marginBottom: 12 }}>PRO</span>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 16px" }}>Setlists sao um recurso exclusivo do plano Pro.</p>
            <Link href="/planos" className="btn-primary" style={{ padding: "10px 24px", fontSize: 13, display: "inline-block" }}>Testar gratis</Link>
          </div>
        ) : notFound || !setlist ? (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 40, textAlign: "center" }}>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>Setlist nao encontrada.</p>
          </div>
        ) : (
          <>
            {/* Header / metadata */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
              {editingName ? (
                <>
                  <input
                    value={nameDraft}
                    onChange={e => setNameDraft(e.target.value)}
                    maxLength={200}
                    style={{
                      width: "100%", padding: "10px 14px", borderRadius: 10, marginBottom: 10,
                      border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
                      fontSize: 16, fontWeight: 700, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                  <textarea
                    value={notesDraft}
                    onChange={e => setNotesDraft(e.target.value)}
                    rows={3}
                    placeholder="Anotacoes gerais (local, data, horario...)"
                    style={{
                      width: "100%", resize: "vertical", padding: "10px 14px", borderRadius: 10, marginBottom: 12,
                      border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
                      fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                    }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={saveMeta} disabled={!nameDraft.trim() || savingMeta} className="btn-primary" style={{ padding: "8px 18px", fontSize: 13 }}>
                      {savingMeta ? "Salvando..." : "Salvar"}
                    </button>
                    <button onClick={() => { setEditingName(false); setNameDraft(setlist.name); setNotesDraft(setlist.notes ?? ""); }}
                      style={{ padding: "8px 18px", fontSize: 13, borderRadius: 8, border: "1px solid var(--border2)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                  <div style={{ minWidth: 0 }}>
                    <h1 style={{ fontWeight: 900, fontSize: 24, margin: "0 0 6px", color: "var(--text)" }}>{setlist.name}</h1>
                    {setlist.notes && (
                      <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{setlist.notes}</p>
                    )}
                    <p style={{ color: "var(--muted2)", fontSize: 12, margin: "8px 0 0" }}>{songs.length} {songs.length === 1 ? "musica" : "musicas"}</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button onClick={() => setEditingName(true)}
                      style={{ padding: "7px 14px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border2)", background: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: 600 }}>
                      Editar
                    </button>
                    <button onClick={handleDeleteSetlist}
                      style={{ padding: "7px 14px", fontSize: 12, borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "var(--danger)", cursor: "pointer", fontWeight: 600 }}>
                      Excluir
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Song list */}
            {songs.length === 0 ? (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 32, textAlign: "center" }}>
                <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, fontStyle: "italic" }}>
                  Nenhuma musica nesta setlist ainda. Va ate uma pagina de musica e clique em &ldquo;Adicionar a setlist&rdquo;.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {songs.map((s, i) => (
                  <div key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ width: 26, textAlign: "center", color: "var(--muted2)", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                        <button onClick={() => moveItem(i, -1)} disabled={i === 0}
                          style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "var(--muted2)" : "var(--text)", fontSize: 12, padding: "1px 4px", lineHeight: 1 }}>▲</button>
                        <button onClick={() => moveItem(i, 1)} disabled={i === songs.length - 1}
                          style={{ background: "none", border: "none", cursor: i === songs.length - 1 ? "default" : "pointer", color: i === songs.length - 1 ? "var(--muted2)" : "var(--text)", fontSize: 12, padding: "1px 4px", lineHeight: 1 }}>▼</button>
                      </div>
                      <Link href={`/song/${s.slug}`} style={{ flex: 1, minWidth: 0, color: "inherit" }}>
                        <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</p>
                        <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{s.artist} · Tom: {s.key} · {s.bpm} BPM</p>
                      </Link>
                      <button onClick={() => removeItem(s.id, s.title)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                        Remover
                      </button>
                    </div>

                    {editingItem === s.id ? (
                      <div style={{ marginTop: 12, paddingLeft: 40 }}>
                        <textarea
                          value={itemNoteDraft}
                          onChange={e => setItemNoteDraft(e.target.value)}
                          rows={2}
                          placeholder="Anotacao para essa musica (ex: tocar 1 tom abaixo, pular intro...)"
                          style={{
                            width: "100%", resize: "vertical", padding: "8px 12px", borderRadius: 8, marginBottom: 8,
                            border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
                            fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                          }}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => saveItemNote(s.id)} className="btn-primary" style={{ padding: "6px 16px", fontSize: 12 }}>Salvar</button>
                          <button onClick={() => setEditingItem(null)}
                            style={{ padding: "6px 16px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border2)", background: "transparent", color: "var(--text)", cursor: "pointer" }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: 8, paddingLeft: 40 }}>
                        {s.notes && (
                          <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.5, margin: "0 0 6px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                            📝 {s.notes}
                          </p>
                        )}
                        <button onClick={() => { setEditingItem(s.id); setItemNoteDraft(s.notes ?? ""); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 12, fontWeight: 600, padding: 0 }}>
                          {s.notes ? "Editar anotacao" : "+ Adicionar anotacao"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <SiteFooter />
    </div>
  );
}
