"use client";

/**
 * /admin/mensagens — Envio manual de avisos (Área do Usuário).
 * Complementa os gatilhos automáticos (música pronta, pagamento, banda):
 * aqui o admin dispara um aviso pra todos, por plano, ou pra um usuário
 * específico — o caso de uso principal é promoção/comunicado que não nasce
 * de um evento do sistema.
 */
import { useEffect, useState } from "react";
import AdminGate from "../AdminGate";
import { adminHeaders } from "../adminClient";

type Audience = "all" | "role" | "user";

type Broadcast = {
  title: string;
  body: string | null;
  link: string | null;
  type: string;
  createdAt: string;
  recipients: number;
};

const AUDIENCE_LABEL: Record<Audience, string> = {
  all: "Todos os usuários ativos",
  role: "Por plano",
  user: "Usuário específico (email)",
};

const TYPE_LABEL: Record<string, string> = { system: "Sistema", promo: "Promoção", band: "Banda" };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function MensagensContent() {
  const [audience, setAudience] = useState<Audience>("all");
  const [role, setRole] = useState("pro");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<"system" | "promo">("promo");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [history, setHistory] = useState<Broadcast[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  async function loadHistory() {
    const res = await fetch("/api/admin/notifications", { headers: adminHeaders() });
    if (res.ok) setHistory((await res.json()).items ?? []);
    setLoadingHistory(false);
  }
  useEffect(() => { loadHistory(); }, []);

  async function send() {
    if (!title.trim()) { setMsg("❌ Título é obrigatório."); return; }
    if (audience === "user" && !email.trim()) { setMsg("❌ Informe o email do destinatário."); return; }
    setSending(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          audience,
          role: audience === "role" ? role : undefined,
          email: audience === "user" ? email.trim() : undefined,
          type,
          title: title.trim(),
          body: body.trim() || undefined,
          link: link.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(`❌ ${data.error}`); return; }
      setMsg(`✅ Enviado para ${data.recipients} usuário(s).`);
      setTitle(""); setBody(""); setLink(""); setEmail("");
      loadHistory();
    } finally {
      setSending(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)",
    padding: "9px 12px", borderRadius: 8, fontSize: 13, width: "100%", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { color: "var(--muted)", fontSize: 12, fontWeight: 600, display: "block", marginBottom: 4 };

  return (
    <div>
      <h1 style={{ color: "var(--text)", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Mensagens</h1>
      <p style={{ color: "var(--muted2)", fontSize: 13, margin: "0 0 20px" }}>
        Envia um aviso pra caixa de mensagens (Área do Usuário) de quem você escolher.
      </p>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 24, display: "flex", flexDirection: "column", gap: 14, maxWidth: 560 }}>
        <div>
          <label style={labelStyle}>Destinatários</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)} style={inputStyle}>
            {(Object.keys(AUDIENCE_LABEL) as Audience[]).map((a) => (
              <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>
            ))}
          </select>
        </div>

        {audience === "role" && (
          <div>
            <label style={labelStyle}>Plano</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="proband">Pro Band</option>
            </select>
          </div>
        )}

        {audience === "user" && (
          <div>
            <label style={labelStyle}>Email do usuário</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@email.com" style={inputStyle} />
          </div>
        )}

        <div>
          <label style={labelStyle}>Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value as "system" | "promo")} style={inputStyle}>
            <option value="promo">Promoção</option>
            <option value="system">Sistema</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Título</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Black Friday — 30% off no Pro" style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Mensagem (opcional)</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Texto do aviso" style={{ ...inputStyle, resize: "vertical" }} />
        </div>

        <div>
          <label style={labelStyle}>Link (opcional)</label>
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/planos" style={inputStyle} />
        </div>

        {msg && <p style={{ fontSize: 13, color: msg.startsWith("❌") ? "var(--danger)" : "var(--accent)", margin: 0 }}>{msg}</p>}

        <button onClick={send} disabled={sending}
          style={{ background: "#f59e0b", color: "#000", border: "none", padding: "11px 0", borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: sending ? "default" : "pointer", opacity: sending ? 0.6 : 1 }}>
          {sending ? "Enviando…" : "Enviar aviso"}
        </button>
      </div>

      <h2 style={{ color: "var(--text)", fontSize: 16, fontWeight: 800, margin: "0 0 12px" }}>Últimos avisos</h2>
      {loadingHistory ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Carregando…</p>
      ) : history.length === 0 ? (
        <p style={{ color: "var(--muted2)", fontSize: 13, fontStyle: "italic" }}>Nenhum aviso enviado ainda.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {history.map((h, i) => (
            <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 4, background: "var(--surface3)", color: "var(--muted2)" }}>
                  {TYPE_LABEL[h.type] ?? h.type}
                </span>
                <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{h.title}</span>
                <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted2)" }}>{h.recipients} destinatário(s)</span>
              </div>
              {h.body && <p style={{ margin: "0 0 3px", fontSize: 12, color: "var(--muted)" }}>{h.body}</p>}
              <p style={{ margin: 0, fontSize: 11, color: "var(--muted2)" }}>{formatDateTime(h.createdAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MensagensPage() {
  return (
    <AdminGate title="Mensagens">
      <MensagensContent />
    </AdminGate>
  );
}
