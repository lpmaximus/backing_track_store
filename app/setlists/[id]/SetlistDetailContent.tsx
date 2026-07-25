"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AddSongPicker, { AddedItem } from "./AddSongPicker";
import SetlistEvents from "./SetlistEvents";
import SetlistMixer from "./SetlistMixer";
import { totalDuration, formatDuration } from "@/src/lib/mix";

type Setlist = {
  id: number;
  name: string;
  notes: string | null;
  bandId: number | null;
  bandName: string | null;
  viewerInstrument?: string | null;
  canEdit?: boolean;
  createdAt: string;
  updatedAt: string;
};

type SongItem = {
  id: number;          // id da linha setlist_songs
  position: number;
  notes: string | null;
  // Preparo do repertório (S2 / ADR-BTS-005)
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

export default function SetlistDetailContent({ id }: { id: string }) {
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

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  // Acesso efetivo pela resposta do servidor (hasProAccess + acesso de banda).
  const [denied, setDenied] = useState(false);
  const canEdit = setlist?.canEdit ?? false;

  async function load() {
    try {
      const res = await fetch(`/api/setlists/${id}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (res.status === 403) { setDenied(true); return; }
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
    if (status === "loading") return;
    if (status !== "authenticated") { setLoading(false); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, id]);

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

  // Duplicar (S2): leva repertório, mixagem padrão e preparo; NÃO leva ensaios,
  // escalação nem prontidão — isso é história daquela ocorrência.
  async function handleDuplicate() {
    if (duplicating) return;
    const name = prompt("Nome da cópia:", `${setlist?.name ?? "Setlist"} (cópia)`);
    if (name === null) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/setlists/${id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) router.push(`/setlists/${data.setlist.id}`);
      else alert(data.error ?? "Não foi possível duplicar");
    } finally {
      setDuplicating(false);
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
    <div style={{ flex: 1, maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px", width: "100%" }}>
      <Link href="/setlists" style={{ color: "var(--muted)", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5, marginBottom: 16 }}>
        ← Minhas setlists
      </Link>

      {status === "loading" || loading ? (
        <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "60px 0" }}>Carregando...</p>
      ) : !session?.user || denied ? (
        <div style={{ background: "linear-gradient(135deg, #ffffff 0%, #fff4e0 100%)", border: "1px solid rgba(255,154,0,0.25)", borderRadius: 12, padding: 28, textAlign: "center" }}>
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
                  <h1 style={{ fontWeight: 900, fontSize: 24, margin: "0 0 6px", color: "var(--text)" }}>
                    {setlist.name}
                    {setlist.bandName && (
                      <span style={{ marginLeft: 10, verticalAlign: "middle", background: "rgba(255,154,0,0.12)", color: "var(--accent)", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 5, whiteSpace: "nowrap" }}>
                        👥 {setlist.bandName}
                      </span>
                    )}
                  </h1>
                  {setlist.notes && (
                    <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{setlist.notes}</p>
                  )}
                  {/* Duração total = músicas + intervalos (S2). Montar um set
                      de 45 min sem calculadora é o ponto. */}
                  <p style={{ color: "var(--muted2)", fontSize: 12, margin: "8px 0 0" }}>
                    {songs.length} {songs.length === 1 ? "musica" : "musicas"}
                    {songs.length > 0 && (
                      <> · <strong style={{ color: "var(--muted)" }}>
                        {formatDuration(totalDuration(songs.map(s => ({ duration: s.duration, gapSeconds: s.gapSeconds }))))}
                      </strong></>
                    )}
                  </p>
                </div>
                {canEdit && (
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button onClick={() => setEditingName(true)}
                      style={{ padding: "7px 14px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border2)", background: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: 600 }}>
                      Editar
                    </button>
                    <button onClick={handleDuplicate} disabled={duplicating}
                      style={{ padding: "7px 14px", fontSize: 12, borderRadius: 8, border: "1px solid var(--border2)", background: "transparent", color: "var(--text)", cursor: "pointer", fontWeight: 600 }}
                      title="Cria uma cópia do repertório com a mixagem e o preparo, sem os ensaios">
                      {duplicating ? "..." : "Duplicar"}
                    </button>
                    <button onClick={handleDeleteSetlist}
                      style={{ padding: "7px 14px", fontSize: 12, borderRadius: 8, border: "1px solid rgba(239,68,68,0.3)", background: "transparent", color: "var(--danger)", cursor: "pointer", fontWeight: 600 }}>
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Adicionar músicas */}
          {canEdit && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: showAddPanel ? 12 : 0 }}>
                <button onClick={() => setShowAddPanel(v => !v)} className="btn-primary" style={{ padding: "9px 20px", fontSize: 13 }}>
                  {showAddPanel ? "Fechar busca" : "+ Adicionar músicas"}
                </button>
              </div>
              {showAddPanel && (
                <AddSongPicker
                  setlistId={Number(id)}
                  existingSongIds={songs.map(s => s.songId)}
                  onAdded={(item: AddedItem) => setSongs(prev => [...prev, item])}
                />
              )}
            </div>
          )}

          {/* Song list */}
          {songs.length === 0 ? (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 32, textAlign: "center" }}>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, fontStyle: "italic" }}>
                {canEdit
                  ? "Nenhuma musica nesta setlist ainda. Clique em “+ Adicionar musicas” acima para escolher do catalogo ou da sua biblioteca."
                  : "Nenhuma musica nesta setlist ainda."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {songs.map((s, i) => (
                <div key={s.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span style={{ width: 26, textAlign: "center", color: "var(--muted2)", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{i + 1}</span>
                    {canEdit && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                        <button onClick={() => moveItem(i, -1)} disabled={i === 0}
                          style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "var(--muted2)" : "var(--text)", fontSize: 12, padding: "1px 4px", lineHeight: 1 }}>▲</button>
                        <button onClick={() => moveItem(i, 1)} disabled={i === songs.length - 1}
                          style={{ background: "none", border: "none", cursor: i === songs.length - 1 ? "default" : "pointer", color: i === songs.length - 1 ? "var(--muted2)" : "var(--text)", fontSize: 12, padding: "1px 4px", lineHeight: 1 }}>▼</button>
                      </div>
                    )}
                    <Link
                      /* Abrir pelo setlist = TOCAR JUNTO: aplica a mixagem, o
                         tom e a velocidade preparados, e muta a trilha do
                         próprio integrante. O modo "ouvir como é" (?solo=)
                         fica no botão ▶ Estudar da escalação do ensaio. */
                      href={`/song/${s.slug}?sl=${s.id}`}
                      style={{ flex: 1, minWidth: 0, color: "inherit" }}
                    >
                      <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</p>
                      <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>{s.artist} · Tom: {s.key} · {s.bpm} BPM</p>
                    </Link>
                    {canEdit && (
                      <button onClick={() => removeItem(s.id, s.title)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 13, fontWeight: 600, flexShrink: 0 }}>
                        Remover
                      </button>
                    )}
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
                      {canEdit && (
                        <button onClick={() => { setEditingItem(s.id); setItemNoteDraft(s.notes ?? ""); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontSize: 12, fontWeight: 600, padding: 0 }}>
                          {s.notes ? "Editar anotacao" : "+ Adicionar anotacao"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Mixagem em tela única (S2 / ADR-BTS-005): M/S/volume por stem,
              mais tom, velocidade e intervalo de cada música. */}
          {songs.length > 0 && <SetlistMixer setlistId={id} />}

          {/* Ensaios e shows (S1 / ADR-BTS-005). Em setlist pessoal vira
              "Sessões de estudo" — mesmo objeto, sem participantes (D6). */}
          <SetlistEvents setlistId={id} isBand={!!setlist.bandId} canManage={canEdit} />

          {/* Mural da banda — todo integrante ativo comenta (R2) */}
          {setlist.bandId && <SetlistComments setlistId={id} />}
        </>
      )}
    </div>
  );
}

// ─── Mural de comentários da setlist da banda ─────────────────────────────────
type SetlistCommentItem = {
  id: number;
  content: string;
  createdAt: string;
  userId: number;
  userName: string | null;
  userImage: string | null;
};

function SetlistComments({ setlistId }: { setlistId: string }) {
  const [comments, setComments] = useState<SetlistCommentItem[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/setlists/${setlistId}/comments`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setComments(data.comments ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setlistId]);

  async function submit() {
    const content = draft.trim();
    if (!content || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/setlists/${setlistId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments(prev => [data.comment, ...prev]);
        setDraft("");
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <div style={{ marginTop: 28, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
      <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", margin: "0 0 14px" }}>
        MURAL DA BANDA
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={2}
          maxLength={1000}
          placeholder="Deixe um recado para a banda (ex: ensaiar a ponte, quem leva o cabo...)"
          style={{
            flex: 1, resize: "vertical", padding: "9px 12px", borderRadius: 8,
            border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
            fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
          }}
        />
        <button onClick={submit} disabled={!draft.trim() || posting} className="btn-primary" style={{ padding: "8px 16px", fontSize: 13, alignSelf: "flex-start" }}>
          {posting ? "..." : "Enviar"}
        </button>
      </div>

      {loading ? (
        <p style={{ color: "var(--muted2)", fontSize: 13, margin: 0 }}>Carregando...</p>
      ) : comments.length === 0 ? (
        <p style={{ color: "var(--muted2)", fontSize: 13, fontStyle: "italic", margin: 0 }}>Nenhum recado ainda. Seja o primeiro.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--surface3)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--muted)", overflow: "hidden" }}>
                {c.userImage ? <img src={c.userImage} alt="" width={30} height={30} style={{ objectFit: "cover" }} /> : (c.userName?.[0]?.toUpperCase() ?? "?")}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: "0 0 2px", fontSize: 13 }}>
                  <strong style={{ color: "var(--text)" }}>{c.userName ?? "Integrante"}</strong>
                  <span style={{ color: "var(--muted2)", fontSize: 11, marginLeft: 8 }}>
                    {new Date(c.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </p>
                <p style={{ margin: 0, color: "var(--muted)", fontSize: 13, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
