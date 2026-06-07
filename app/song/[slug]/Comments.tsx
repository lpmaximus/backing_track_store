"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

type CommentItem = {
  id: number;
  content: string;
  createdAt: string;
  userName: string | null;
  userImage: string | null;
  userRole: string;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Comments({ songId }: { songId: number }) {
  const { data: session } = useSession();
  const [items,   setItems]   = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text,    setText]    = useState("");
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState("");

  const isPro = session?.user?.role === "pro" || session?.user?.role === "admin";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/comments?songId=${songId}`);
        const data = await res.json();
        if (!cancelled && res.ok) setItems(data.comments ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [songId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId, content: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao publicar comentario");
        return;
      }
      setItems(prev => [data.comment, ...prev]);
      setText("");
    } catch {
      setError("Erro de conexao. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 24px" }}>
      <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", margin: "0 0 16px" }}>
        COMENTARIOS {items.length > 0 && `(${items.length})`}
      </p>

      {/* Form de novo comentario */}
      {session?.user ? (
        isPro ? (
          <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Compartilhe uma dica, observacao ou feedback sobre essa musica..."
              maxLength={1000}
              rows={3}
              style={{
                width: "100%", resize: "vertical", padding: "12px 14px", borderRadius: 10,
                border: "1px solid var(--border2)", background: "var(--surface2)", color: "var(--text)",
                fontSize: 14, outline: "none", fontFamily: "inherit", marginBottom: 8,
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted2)", fontSize: 12 }}>{text.length}/1000</span>
              <button type="submit" disabled={!text.trim() || sending} className="btn-primary"
                style={{ padding: "9px 22px", fontSize: 13, opacity: !text.trim() || sending ? 0.6 : 1 }}>
                {sending ? "Publicando..." : "Publicar"}
              </button>
            </div>
            {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
          </form>
        ) : (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", marginBottom: 20,
            background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10,
          }}>
            <span className="pro-badge">PRO</span>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>Assine o Pro para escrever comentarios.</span>
            <Link href="/planos" style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13, marginLeft: "auto" }}>
              Testar gratis
            </Link>
          </div>
        )
      ) : (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", marginBottom: 20,
          background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 10,
        }}>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>
            <Link href="/entrar" style={{ color: "var(--accent)", fontWeight: 700 }}>Entre na sua conta</Link> para ler e participar da conversa.
          </span>
        </div>
      )}

      {/* Lista de comentarios */}
      {loading ? (
        <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Carregando comentarios...</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", padding: "20px 0", fontStyle: "italic" }}>
          Nenhum comentario ainda. Seja o primeiro a compartilhar algo sobre essa musica.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {items.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
                background: "var(--surface3)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 700, color: "var(--text)",
              }}>
                {c.userImage
                  ? <img src={c.userImage} alt={c.userName ?? "Usuario"} width={36} height={36} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
                  : (c.userName ?? "U").charAt(0).toUpperCase()
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{c.userName ?? "Usuario"}</span>
                  {(c.userRole === "pro" || c.userRole === "admin") && <span className="pro-badge" style={{ fontSize: 9 }}>PRO</span>}
                  <span style={{ color: "var(--muted2)", fontSize: 12 }}>{formatDate(c.createdAt)}</span>
                </div>
                <p style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {c.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
