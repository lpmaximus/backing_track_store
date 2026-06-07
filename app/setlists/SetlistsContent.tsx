"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type SetlistItem = {
  id: number;
  name: string;
  notes: string | null;
  songCount: number;
  createdAt: string;
  updatedAt: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SetlistsContent() {
  const { data: session, status } = useSession();
  const [items, setItems]     = useState<SetlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName]       = useState("");
  const [notes, setNotes]     = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError]    = useState("");
  const [showForm, setShowForm] = useState(false);

  const isPro = session?.user?.role === "pro" || session?.user?.role === "admin";

  useEffect(() => {
    if (status !== "authenticated" || !isPro) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/setlists");
        const data = await res.json();
        if (!cancelled && res.ok) setItems(data.setlists ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [status, isPro]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/setlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), notes: notes.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar setlist");
        return;
      }
      setItems(prev => [data.setlist, ...prev]);
      setName("");
      setNotes("");
      setShowForm(false);
    } catch {
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ flex: 1, maxWidth: 900, margin: "0 auto", padding: "32px 24px 60px", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 26, margin: "0 0 4px", color: "var(--text)" }}>Minhas Setlists</h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>Organize seus repertorios para shows e ensaios</p>
        </div>
        {isPro && (
          <button onClick={() => setShowForm(v => !v)} className="btn-primary" style={{ padding: "10px 20px", fontSize: 13, whiteSpace: "nowrap" }}>
            {showForm ? "Cancelar" : "+ Nova setlist"}
          </button>
        )}
      </div>

      {status === "loading" ? null : !session?.user ? (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 28, textAlign: "center" }}>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "0 0 14px" }}>Entre na sua conta para criar e gerenciar setlists.</p>
          <Link href="/entrar" className="btn-primary" style={{ padding: "9px 22px", fontSize: 13, display: "inline-block" }}>Entrar</Link>
        </div>
      ) : !isPro ? (
        <div style={{ background: "linear-gradient(135deg, #ffffff 0%, #eafbf1 100%)", border: "1px solid rgba(29,185,84,0.25)", borderRadius: 12, padding: 28, textAlign: "center" }}>
          <span className="pro-badge" style={{ display: "inline-block", marginBottom: 12 }}>PRO</span>
          <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, margin: "0 0 16px" }}>
            Setlists sao um recurso exclusivo do plano Pro. Crie repertorios, organize a ordem das musicas e adicione anotacoes para cada show.
          </p>
          <Link href="/planos" className="btn-primary" style={{ padding: "10px 24px", fontSize: 13, display: "inline-block" }}>Testar gratis</Link>
        </div>
      ) : (
        <>
          {showForm && (
            <form onSubmit={handleCreate} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", margin: "0 0 14px" }}>NOVA SETLIST</p>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nome da setlist (ex: Show Bar do Ze - 15/06)"
                maxLength={200}
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: 10, marginBottom: 10,
                  border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
                  fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Anotacoes gerais (opcional): local, data, horario, observacoes..."
                rows={3}
                style={{
                  width: "100%", resize: "vertical", padding: "11px 14px", borderRadius: 10, marginBottom: 12,
                  border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
                  fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" disabled={!name.trim() || creating} className="btn-primary"
                  style={{ padding: "9px 22px", fontSize: 13, opacity: !name.trim() || creating ? 0.6 : 1 }}>
                  {creating ? "Criando..." : "Criar setlist"}
                </button>
              </div>
              {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: "10px 0 0" }}>{error}</p>}
            </form>
          )}

          {loading ? (
            <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "40px 0" }}>Carregando setlists...</p>
          ) : items.length === 0 ? (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 40, textAlign: "center" }}>
              <p style={{ color: "var(--muted)", fontSize: 14, margin: 0, fontStyle: "italic" }}>
                Voce ainda nao tem nenhuma setlist. Crie a primeira para organizar seu proximo show.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {items.map(s => (
                <Link key={s.id} href={`/setlists/${s.id}`} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                  padding: "16px 20px", color: "inherit",
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", margin: "0 0 4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.name}
                    </p>
                    <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
                      {s.songCount} {s.songCount === 1 ? "musica" : "musicas"} · Atualizada em {formatDate(s.updatedAt)}
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
