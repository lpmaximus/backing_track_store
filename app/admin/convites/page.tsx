"use client";

/**
 * /admin/convites — convites de teste (Pro / Pro Band por N dias).
 *
 * Três blocos:
 *   1. Novo convite  — destinatários + plano + duração, com preview do texto.
 *   2. Texto padrão  — template editável (assunto + corpo em texto puro).
 *   3. Acompanhamento — funil enviado → clicado → cadastrado → 1º uso.
 *
 * O painel "por que isto não é phishing" fica visível de propósito: as regras
 * que protegem a reputação do domínio só funcionam se quem escreve o convite
 * as tiver na frente na hora de escrever.
 */
import { useEffect, useState } from "react";
import AdminGate from "../AdminGate";
import { adminHeaders } from "../adminClient";

type Invite = {
  id: number;
  email: string;
  name: string | null;
  plan: string;
  trialDays: number;
  trialSeparations: number | null;
  status: string;
  error: string | null;
  token: string;
  sentAt: string | null;
  sendCount: number;
  clickedAt: string | null;
  acceptedAt: string | null;
  firstUseAt: string | null;
  trialEndsAt: string | null;
  expiresAt: string;
  createdAt: string;
  userRole: string | null;
};

type Stats = {
  total: number; sent: number; failed: number;
  clicked: number; accepted: number; used: number; active: number;
};

const STATUS: Record<string, { label: string; color: string }> = {
  pending:  { label: "Na fila",    color: "#64748b" },
  sent:     { label: "Enviado",    color: "#3b82f6" },
  failed:   { label: "Falhou",     color: "#ef4444" },
  clicked:  { label: "Clicou",     color: "#f59e0b" },
  accepted: { label: "Ativou",     color: "#22c55e" },
  expired:  { label: "Expirado",   color: "#64748b" },
  revoked:  { label: "Cancelado",  color: "#64748b" },
};

/**
 * Limite padrão por plano — espelho de src/lib/quota.ts. Duplicado de propósito:
 * quota.ts toca o banco e não pode ser importado em "use client". Serve só para
 * exibir o número no formulário; a verdade continua no servidor.
 */
const PLAN_DEFAULT: Record<"pro" | "proband", number> = { pro: 20, proband: 40 };

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

const fmtDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—";

const input: React.CSSProperties = {
  background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)",
  padding: "10px 12px", borderRadius: 8, fontSize: 14, width: "100%", boxSizing: "border-box",
};
const label: React.CSSProperties = {
  color: "var(--muted)", fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
  textTransform: "uppercase", display: "block", marginBottom: 6,
};
const card: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
  padding: "20px 22px", marginBottom: 20,
};

function Funnel({ s }: { s: Stats }) {
  const steps = [
    { k: "Enviados", v: s.sent, c: "#3b82f6" },
    { k: "Clicaram", v: s.clicked, c: "#f59e0b" },
    { k: "Ativaram", v: s.accepted, c: "#22c55e" },
    { k: "Usaram", v: s.used, c: "#8b5cf6" },
  ];
  const max = Math.max(s.sent, 1);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
      {steps.map((st) => (
        <div key={st.k} style={{ background: "var(--surface2)", borderRadius: 10, padding: "12px 14px" }}>
          <p style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>{st.k}</p>
          <p style={{ color: st.c, fontSize: 24, fontWeight: 900, margin: "2px 0 4px" }}>{st.v}</p>
          <div style={{ background: "var(--border)", borderRadius: 3, height: 5, overflow: "hidden" }}>
            <div style={{ width: `${Math.round((st.v / max) * 100)}%`, height: "100%", background: st.c }} />
          </div>
        </div>
      ))}
      <div style={{ background: "var(--surface2)", borderRadius: 10, padding: "12px 14px" }}>
        <p style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", margin: 0 }}>Testes ativos</p>
        <p style={{ color: "var(--text)", fontSize: 24, fontWeight: 900, margin: "2px 0 4px" }}>{s.active}</p>
        <p style={{ color: s.failed > 0 ? "#ef4444" : "var(--muted2)", fontSize: 11, margin: 0 }}>{s.failed} falha(s) de envio</p>
      </div>
    </div>
  );
}

function AntiPhishing() {
  const [open, setOpen] = useState(false);
  const rules = [
    ["Remetente autenticado", "O e-mail sai de contato@l2techs.com pelo SMTP do Zoho, com SPF, DKIM e DMARC publicados no DNS. Sem isso o Gmail marca como \"não verificado\" e o resto não importa."],
    ["Link honesto e sem encurtador", "A URL do convite aparece escrita por extenso, é a mesma do botão e aponta para https://backingtrack.store/convite/... Encurtador (bit.ly e afins) é o sinal nº 1 de golpe."],
    ["Nada de dado sensível", "O e-mail e a página do convite dizem explicitamente que nunca pedimos senha, CPF, dados bancários ou cartão. O login é o do site, na rota de sempre."],
    ["Sem anexo e sem formulário no e-mail", "Anexo inesperado e campo de senha dentro do e-mail são a assinatura clássica do phishing."],
    ["Contexto pessoal e verificável", "Nome de quem convida, motivo do envio e o e-mail que recebeu. Convite genérico (\"Prezado cliente\") levanta suspeita justificada."],
    ["Sem urgência artificial", "Prazo real de validade, sem \"clique em 24h ou perde\". Pressa fabricada é a alavanca de todo golpe."],
    ["Saída fácil", "Link de descadastro em um clique, sem login, mais o header List-Unsubscribe. Quem some quando você tenta sair é golpista."],
    ["Volume baixo e gradual", "Convide poucos por vez e só quem tem relação prévia com você. Disparo em massa de domínio novo derruba a reputação e manda tudo para o spam."],
    ["Avise por outro canal", "Sempre que der, mande um WhatsApp/mensagem antes: \"te mandei um convite por e-mail\". Um segundo canal resolve a desconfiança melhor que qualquer texto."],
  ];
  return (
    <div style={{ ...card, borderColor: "#f59e0b55" }}>
      <button onClick={() => setOpen(!open)}
        style={{ background: "none", border: "none", color: "var(--text)", fontSize: 15, fontWeight: 800, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <span>🛡️ Por que este convite não parece phishing</span>
        <span style={{ color: "var(--muted2)", fontSize: 13, fontWeight: 500 }}>{open ? "ocultar" : "ver as 9 regras"}</span>
      </button>
      {open && (
        <ol style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.65, margin: "14px 0 0", paddingLeft: 20 }}>
          {rules.map(([t, d]) => (
            <li key={t} style={{ marginBottom: 8 }}>
              <strong style={{ color: "var(--text)" }}>{t}.</strong> {d}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ConvitesContent() {
  const [items, setItems] = useState<Invite[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [smtpReady, setSmtpReady] = useState(true);
  const [loading, setLoading] = useState(true);

  // formulário
  const [emails, setEmails] = useState("");
  const [plan, setPlan] = useState<"pro" | "proband">("pro");
  const [days, setDays] = useState(20);
  // "" = usa o limite normal do plano (Pro 20 / Band 40).
  const [separations, setSeparations] = useState<string>("");
  const [sender, setSender] = useState("Luiz Paulo");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");

  // template
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [savingTpl, setSavingTpl] = useState(false);
  const [tplMsg, setTplMsg] = useState("");
  const [showTpl, setShowTpl] = useState(false);

  async function load() {
    const res = await fetch("/api/admin/invites", { headers: adminHeaders() });
    if (res.ok) {
      const d = await res.json();
      setItems(d.items ?? []);
      setStats(d.stats ?? null);
      setSmtpReady(d.smtpReady);
      setSubject(d.template?.subject ?? "");
      setBody(d.template?.body ?? "");
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  /** "Nome <email>" por linha, ou só o e-mail. */
  function parseRecipients() {
    return emails
      .split(/[\n;]+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(.*?)[<\s]+([^\s<>]+@[^\s<>]+)>?$/);
        if (m) return { name: m[1].trim().replace(/["']/g, ""), email: m[2] };
        return { name: "", email: line };
      });
  }

  async function send() {
    const recipients = parseRecipients();
    if (recipients.length === 0) { setMsg("❌ Informe pelo menos um e-mail."); return; }
    setSending(true); setMsg("");
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          recipients, plan, days, subject, body, sender,
          separations: separations.trim() === "" ? null : Number(separations),
        }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(`❌ ${d.error}`); return; }
      setMsg(d.failed > 0
        ? `⚠️ ${d.sent} enviado(s), ${d.failed} falhou(ram). Veja o motivo na tabela abaixo.`
        : `✅ ${d.sent} convite(s) enviado(s).`);
      setEmails("");
      load();
    } finally {
      setSending(false);
    }
  }

  async function saveTemplate() {
    setSavingTpl(true); setTplMsg("");
    try {
      const res = await fetch("/api/admin/invites/template", {
        method: "PUT", headers: adminHeaders(), body: JSON.stringify({ subject, body }),
      });
      const d = await res.json();
      setTplMsg(res.ok ? "✅ Texto salvo." : `❌ ${d.error}`);
    } finally {
      setSavingTpl(false);
    }
  }

  async function act(id: number, action: "resend" | "revoke") {
    if (action === "revoke" && !confirm("Cancelar este convite? O link para de funcionar.")) return;
    const res = await fetch(`/api/admin/invites/${id}`, {
      method: "PATCH", headers: adminHeaders(), body: JSON.stringify({ action }),
    });
    const d = await res.json();
    if (!res.ok) alert(d.error ?? "Erro");
    load();
  }

  const count = parseRecipients().length;
  const planDefault = PLAN_DEFAULT[plan];

  return (
    <div>
      <h1 style={{ color: "var(--text)", fontSize: 22, fontWeight: 900, margin: "0 0 4px" }}>Convites</h1>
      <p style={{ color: "var(--muted2)", fontSize: 13, margin: "0 0 20px" }}>
        Libera Pro ou Pro Band por tempo determinado, sem cartão. O acesso volta sozinho ao gratuito quando o prazo acaba.
      </p>

      {!smtpReady && (
        <div style={{ ...card, borderColor: "#ef4444", background: "#ef444411" }}>
          <strong style={{ color: "#ef4444" }}>SMTP não configurado.</strong>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 0" }}>
            Defina <code>SMTP_USER</code> e <code>SMTP_PASSWORD</code> (senha de aplicativo do Zoho) nas variáveis
            de ambiente. Sem isso os convites são gravados mas não saem.
          </p>
        </div>
      )}

      {stats && <div style={card}><Funnel s={stats} /></div>}

      <AntiPhishing />

      {/* ─── Novo convite ─────────────────────────────────────────────── */}
      <div style={card}>
        <h2 style={{ color: "var(--text)", fontSize: 16, fontWeight: 800, margin: "0 0 16px" }}>Novo convite</h2>

        <div style={{ marginBottom: 14 }}>
          <label style={label}>Destinatários — um por linha, &quot;Nome &lt;email@dominio&gt;&quot; ou só o e-mail</label>
          <textarea value={emails} onChange={(e) => setEmails(e.target.value)} rows={4}
            placeholder={"João Silva <joao@email.com>\nmaria@email.com"}
            style={{ ...input, fontFamily: "ui-monospace, monospace", fontSize: 13, resize: "vertical" }} />
          <p style={{ color: "var(--muted2)", fontSize: 12, margin: "6px 0 0" }}>
            {count} destinatário(s) · máx. 20 por envio — convite é conversa, não campanha.
          </p>
          {count > 0 && parseRecipients().some((r) => !r.name) && (
            <p style={{ color: "#f59e0b", fontSize: 12, margin: "6px 0 0" }}>
              ⚠️ {parseRecipients().filter((r) => !r.name).length} sem nome. O e-mail funciona, mas
              convite sem nome soa como mala direta — que é o que levanta suspeita de golpe.
            </p>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 16 }}>
          <div>
            <label style={label}>Plano liberado</label>
            <select value={plan} onChange={(e) => setPlan(e.target.value as "pro" | "proband")} style={input}>
              <option value="pro">Pro (individual)</option>
              <option value="proband">Pro Band (banda)</option>
            </select>
          </div>
          <div>
            <label style={label}>Duração (dias)</label>
            <input type="number" min={1} max={90} value={days} onChange={(e) => setDays(Number(e.target.value))} style={input} />
          </div>
          <div>
            <label style={label}>Separações liberadas</label>
            <input type="number" min={1} max={500} value={separations}
              onChange={(e) => setSeparations(e.target.value)}
              placeholder={`padrão do plano (${planDefault})`} style={input} />
          </div>
          <div>
            <label style={label}>Assinado por</label>
            <input value={sender} onChange={(e) => setSender(e.target.value)} style={input} />
          </div>
        </div>

        <p style={{ color: "var(--muted2)", fontSize: 12, lineHeight: 1.6, margin: "-4px 0 16px" }}>
          As separações são o <strong>total do período de teste</strong>, não por mês: {separations.trim() === "" ? planDefault : separations} separação(ões)
          para usar ao longo dos {days} dias, sem reset. Em branco = limite normal do plano
          (Pro {PLAN_DEFAULT.pro} / Pro Band {PLAN_DEFAULT.proband}).
        </p>

        <button onClick={send} disabled={sending || count === 0}
          style={{ background: "#f59e0b", color: "#000", border: "none", padding: "11px 24px", borderRadius: 8, fontWeight: 800, fontSize: 14, cursor: sending || count === 0 ? "not-allowed" : "pointer", opacity: sending || count === 0 ? 0.5 : 1 }}>
          {sending ? "Enviando…" : `Enviar ${count || ""} convite(s)`}
        </button>
        {msg && <p style={{ color: "var(--text)", fontSize: 13, margin: "12px 0 0" }}>{msg}</p>}
      </div>

      {/* ─── Texto padrão ─────────────────────────────────────────────── */}
      <div style={card}>
        <button onClick={() => setShowTpl(!showTpl)}
          style={{ background: "none", border: "none", color: "var(--text)", fontSize: 16, fontWeight: 800, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 8 }}>
          ✍️ Texto padrão do convite
          <span style={{ color: "var(--muted2)", fontSize: 13, fontWeight: 500 }}>{showTpl ? "ocultar" : "editar"}</span>
        </button>

        {showTpl && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Assunto</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} style={input} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={label}>Corpo (texto puro — o HTML é montado automaticamente)</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={16}
                style={{ ...input, fontFamily: "ui-monospace, monospace", fontSize: 13, lineHeight: 1.6, resize: "vertical" }} />
            </div>
            <p style={{ color: "var(--muted2)", fontSize: 12, lineHeight: 1.7, margin: "0 0 14px" }}>
              Variáveis: <code>{"{{nome}}"}</code> <code>{"{{plano}}"}</code> <code>{"{{dias}}"}</code>{" "}
              <code>{"{{separacoes}}"}</code>{" "}
              <code>{"{{link}}"}</code> <code>{"{{validade}}"}</code> <code>{"{{email}}"}</code>{" "}
              <code>{"{{remetente}}"}</code>.<br />
              O bloco de segurança, o botão, a URL por extenso e o rodapé com descadastro são adicionados
              automaticamente ao final — não precisa (nem deve) escrevê-los aqui.
            </p>
            <button onClick={saveTemplate} disabled={savingTpl}
              style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)", padding: "9px 18px", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {savingTpl ? "Salvando…" : "Salvar texto"}
            </button>
            {tplMsg && <span style={{ color: "var(--muted)", fontSize: 13, marginLeft: 12 }}>{tplMsg}</span>}
          </div>
        )}
      </div>

      {/* ─── Acompanhamento ───────────────────────────────────────────── */}
      <div style={card}>
        <h2 style={{ color: "var(--text)", fontSize: 16, fontWeight: 800, margin: "0 0 14px" }}>Convites enviados</h2>
        {loading ? (
          <p style={{ color: "var(--muted)" }}>Carregando…</p>
        ) : items.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Nenhum convite ainda.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "var(--muted)", textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  <th style={{ padding: "8px 10px 8px 0" }}>Pessoa</th>
                  <th style={{ padding: "8px 10px" }}>Plano</th>
                  <th style={{ padding: "8px 10px" }}>Status</th>
                  <th style={{ padding: "8px 10px" }}>Enviado</th>
                  <th style={{ padding: "8px 10px" }}>Clicou</th>
                  <th style={{ padding: "8px 10px" }}>Ativou</th>
                  <th style={{ padding: "8px 10px" }}>1º uso</th>
                  <th style={{ padding: "8px 10px" }}>Teste até</th>
                  <th style={{ padding: "8px 0 8px 10px" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const st = STATUS[it.status] ?? { label: it.status, color: "var(--muted)" };
                  return (
                    <tr key={it.id} style={{ borderTop: "1px solid var(--border)", color: "var(--text)" }}>
                      <td style={{ padding: "10px 10px 10px 0" }}>
                        <div style={{ fontWeight: 700 }}>{it.name || "—"}</div>
                        <div style={{ color: "var(--muted2)", fontSize: 12 }}>{it.email}</div>
                        {it.error && <div style={{ color: "#ef4444", fontSize: 11, marginTop: 2 }}>{it.error}</div>}
                      </td>
                      <td style={{ padding: "10px", color: "var(--muted)" }}>
                        {it.plan === "proband" ? "Band" : "Pro"} · {it.trialDays}d ·{" "}
                        <span title={it.trialSeparations == null ? "limite padrão do plano" : "cota total do teste"}>
                          {it.trialSeparations ?? PLAN_DEFAULT[it.plan === "proband" ? "proband" : "pro"]} sep
                        </span>
                      </td>
                      <td style={{ padding: "10px" }}>
                        <span style={{ background: `${st.color}22`, color: st.color, borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 800 }}>
                          {st.label}
                        </span>
                        {it.sendCount > 1 && <span style={{ color: "var(--muted2)", fontSize: 11, marginLeft: 6 }}>{it.sendCount}x</span>}
                      </td>
                      <td style={{ padding: "10px", color: "var(--muted2)" }}>{fmt(it.sentAt)}</td>
                      <td style={{ padding: "10px", color: it.clickedAt ? "var(--text)" : "var(--muted2)" }}>{fmt(it.clickedAt)}</td>
                      <td style={{ padding: "10px", color: it.acceptedAt ? "var(--text)" : "var(--muted2)" }}>{fmt(it.acceptedAt)}</td>
                      <td style={{ padding: "10px", color: it.firstUseAt ? "#22c55e" : "var(--muted2)" }}>{fmt(it.firstUseAt)}</td>
                      <td style={{ padding: "10px", color: "var(--muted2)" }}>{fmtDay(it.trialEndsAt)}</td>
                      <td style={{ padding: "10px 0 10px 10px", whiteSpace: "nowrap" }}>
                        {it.status !== "accepted" && it.status !== "revoked" && (
                          <>
                            <button onClick={() => act(it.id, "resend")} title="Reenviar (mesmo link)"
                              style={{ background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 9px", fontSize: 12, cursor: "pointer", marginRight: 6 }}>
                              Reenviar
                            </button>
                            <button onClick={() => act(it.id, "revoke")} title="Cancelar convite"
                              style={{ background: "transparent", color: "#ef4444", border: "1px solid #ef444455", borderRadius: 6, padding: "4px 9px", fontSize: 12, cursor: "pointer" }}>
                              Cancelar
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminConvitesPage() {
  return (
    <AdminGate title="Convites">
      <ConvitesContent />
    </AdminGate>
  );
}
