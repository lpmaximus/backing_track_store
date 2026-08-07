"use client";

import { useEffect, useState } from "react";
import AdminGate from "../AdminGate";
import { adminHeaders } from "../adminClient";

type AdminUser = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  status: string;
  blockReason: string | null;
  deletionScheduledAt: string | null;
  createdAt: string;
  usedThisMonth: number;
  monthlyLimit: number;
  subscriptionStatus: string | null;
  activeBands: number;
};

const ROLES = ["free", "pro", "proband", "admin"];
const statusColor: Record<string, string> = { active: "var(--accent)", blocked: "#f59e0b", banned: "var(--danger)" };

function UsuariosContent() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [q, setQ] = useState("");

  async function load() {
    const res = await fetch("/api/admin/users", { headers: adminHeaders() });
    if (res.ok) setUsers((await res.json()).users ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function act(userId: number, action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch("/api/admin/users", { method: "PATCH", headers: adminHeaders(), body: JSON.stringify({ userId, action, ...extra }) });
    const data = await res.json();
    if (!res.ok) { setMsg(`❌ ${data.error}`); return; }
    if (data.tempPassword) setMsg(`🔑 Senha temporária de #${userId}: ${data.tempPassword} (mostra uma vez)`);
    else if (data.paymentLink) setMsg(`💳 Link de cobrança de #${userId}: ${data.paymentLink}`);
    else if (data.deleted) setMsg(`🗑️ Usuário ${data.email} (#${userId}) excluído definitivamente do banco.`);
    else setMsg("✅ Feito.");
    load();
  }

  // Exclusão imediata: dupla trava (confirm + digitar o e-mail exato), porque
  // não existe retenção nem desfazer — o registro sai do banco na hora.
  function hardDelete(u: AdminUser) {
    if (!confirm(`EXCLUIR AGORA e para sempre a conta de ${u.email}?\n\nIsso apaga o usuário e todos os dados vinculados (bandas, setlists, comentários, notificações). NÃO há retenção de 30 dias e NÃO dá para desfazer.`)) return;
    const typed = prompt(`Confirme digitando o e-mail exato do usuário:\n${u.email}`) ?? "";
    if (typed.trim().toLowerCase() !== u.email.trim().toLowerCase()) {
      setMsg("❌ Exclusão cancelada: e-mail digitado não confere.");
      return;
    }
    act(u.id, "hardDelete", { confirmEmail: typed.trim() });
  }

  const filtered = users.filter((u) => !q || u.email.toLowerCase().includes(q.toLowerCase()) || (u.name ?? "").toLowerCase().includes(q.toLowerCase()));

  if (loading) return <p style={{ color: "var(--muted)" }}>Carregando…</p>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h1 style={{ color: "var(--text)", fontSize: 22, fontWeight: 800, margin: 0 }}>Usuários ({users.length})</h1>
        <input placeholder="Buscar por email/nome" value={q} onChange={(e) => setQ(e.target.value)}
          style={{ marginLeft: "auto", background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "8px 12px", borderRadius: 8, fontSize: 13, width: 240 }} />
      </div>

      {msg && (
        <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "var(--text)", marginBottom: 14, wordBreak: "break-all" }}>
          {msg} <button onClick={() => setMsg("")} style={{ float: "right", background: "none", border: "none", color: "var(--muted)", cursor: "pointer" }}>✕</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((u) => (
          <div key={u.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ margin: 0, color: "var(--text)", fontWeight: 700, fontSize: 14 }}>
                  {u.name ?? "—"} <span style={{ color: "var(--muted2)", fontWeight: 400 }}>· {u.email}</span>
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "var(--muted)" }}>
                  <span style={{ color: statusColor[u.status] ?? "var(--muted)", fontWeight: 700 }}>{u.status.toUpperCase()}</span>
                  {" · "}uso {u.usedThisMonth}/{u.monthlyLimit}
                  {" · "}assinatura {u.subscriptionStatus ?? "—"}
                  {u.activeBands > 0 && ` · ${u.activeBands} banda(s)`}
                  {u.deletionScheduledAt && <span style={{ color: "var(--danger)" }}> · exclusão {new Date(u.deletionScheduledAt).toLocaleDateString("pt-BR")}</span>}
                </p>
                {u.blockReason && <p style={{ margin: "3px 0 0", fontSize: 12, color: "#f59e0b" }}>motivo: {u.blockReason}</p>}
              </div>

              <select value={u.role} onChange={(e) => act(u.id, "setRole", { role: e.target.value })}
                style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--text)", padding: "6px 8px", borderRadius: 6, fontSize: 12 }}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {u.status === "active" ? (
                <>
                  <ActBtn onClick={() => { const r = prompt("Motivo do bloqueio?") ?? ""; act(u.id, "setStatus", { status: "blocked", reason: r }); }} label="Bloquear" color="#f59e0b" />
                  <ActBtn onClick={() => { const r = prompt("Motivo do banimento?") ?? ""; act(u.id, "setStatus", { status: "banned", reason: r }); }} label="Banir" color="var(--danger)" />
                </>
              ) : (
                <ActBtn onClick={() => act(u.id, "setStatus", { status: "active" })} label="Reativar" color="var(--accent)" />
              )}
              <ActBtn onClick={() => act(u.id, "resetPassword")} label="Resetar senha" />
              <ActBtn onClick={() => act(u.id, "resendCharge")} label="Reenviar cobrança" />
              {u.deletionScheduledAt ? (
                <ActBtn onClick={() => act(u.id, "cancelDeletion")} label="Cancelar exclusão" color="var(--accent)" />
              ) : (
                <ActBtn onClick={() => confirm("Agendar exclusão (30 dias de retenção)?") && act(u.id, "scheduleDeletion")} label="Excluir (30d)" color="var(--danger)" />
              )}
              {u.role !== "admin" && (
                <ActBtn onClick={() => hardDelete(u)} label="Excluir agora ⚠" color="var(--danger)" solid />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActBtn({ onClick, label, color, solid }: { onClick: () => void; label: string; color?: string; solid?: boolean }) {
  return (
    <button onClick={onClick}
      style={{
        background: solid ? (color ?? "var(--danger)") : "var(--surface2)",
        border: `1px solid ${color ?? "var(--border)"}`,
        color: solid ? "#fff" : (color ?? "var(--text)"),
        padding: "5px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontWeight: 600,
      }}>
      {label}
    </button>
  );
}

export default function UsuariosPage() {
  return (
    <AdminGate title="Usuários">
      <UsuariosContent />
    </AdminGate>
  );
}
