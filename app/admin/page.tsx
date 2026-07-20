"use client";

/**
 * /admin — Dashboard macro do negócio (estilo Power BI).
 * KPIs de usuários, catálogo/áudio, cifras, consumo e bandas em cards
 * clicáveis que levam ao módulo correspondente. Dados de
 * /api/admin/dashboard (senha admin via AdminGate).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import AdminGate from "./AdminGate";
import { adminHeaders } from "./adminClient";

type Dash = {
  month: string;
  users: { total: number; free: number; pro: number; proband: number; admin: number; blocked: number; newThisMonth: number };
  catalog: { totalSongs: number; published: number; userUploads: number; moderationPending: number; moderationBlocked: number; stems: number; processingFailed: number };
  cifras: { songsWithCifra: number; openReports: number; editsThisMonth: number };
  finance: { separations: number; separationCost: number; infraCost: number; totalCost: number; activeSubscribers: { pro: number; proband: number }; mrr: number; delinquent: number; margin: number };
  bands: { total: number };
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Kpi({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <p style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", margin: 0, textTransform: "uppercase" }}>{label}</p>
      <p style={{ color: color ?? "var(--text)", fontSize: 26, fontWeight: 900, margin: "2px 0 0", lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ color: "var(--muted2)", fontSize: 11, margin: "2px 0 0" }}>{sub}</p>}
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <span style={{ color: "var(--muted)", width: 64, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 4, height: 10, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, minWidth: value > 0 ? 3 : 0, height: "100%", background: color, borderRadius: 4 }} />
      </div>
      <span style={{ color: "var(--text)", fontWeight: 700, width: 34, textAlign: "right", flexShrink: 0 }}>{value}</span>
    </div>
  );
}

function Card({ href, title, icon, alert, children }: { href: string; title: string; icon: string; alert?: number; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration: "none", display: "block" }}>
      <div
        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", height: "100%", boxSizing: "border-box", transition: "border-color .15s" }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#f59e0b")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ color: "var(--text)", fontWeight: 800, fontSize: 14 }}>{icon} {title}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {alert != null && alert > 0 && (
              <span style={{ background: "#ef4444", color: "#fff", borderRadius: 999, fontSize: 11, fontWeight: 800, padding: "2px 8px" }}>{alert}</span>
            )}
            <span style={{ color: "var(--muted2)", fontSize: 13 }}>abrir →</span>
          </span>
        </div>
        {children}
      </div>
    </Link>
  );
}

function DashboardContent() {
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/dashboard", { headers: adminHeaders() });
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p style={{ color: "var(--muted)" }}>Carregando visão geral…</p>;
  if (!data) return <p style={{ color: "var(--danger)" }}>Não foi possível carregar o dashboard.</p>;

  const { users: u, catalog: c, cifras: cf, finance: f, bands: b } = data;
  const maxRole = Math.max(u.free, u.pro, u.proband, 1);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "var(--text)", fontSize: 22, fontWeight: 900, margin: 0 }}>Visão geral · {data.month}</h1>
          <p style={{ color: "var(--muted2)", fontSize: 13, margin: "4px 0 0" }}>Números em tempo real do mês corrente. Clique num card para abrir o módulo.</p>
        </div>
      </div>

      {/* Faixa de KPIs principais */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 20 }}>
        {[
          { label: "MRR", value: brl(f.mrr), color: "var(--accent)" },
          { label: "Custo do mês", value: brl(f.totalCost), color: "var(--danger)" },
          { label: "Margem", value: brl(f.margin), color: f.margin >= 0 ? "var(--accent)" : "var(--danger)" },
          { label: "Usuários", value: String(u.total), sub: `+${u.newThisMonth} no mês` },
          { label: "Músicas", value: String(c.totalSongs), sub: `${c.published} publicadas` },
        ].map((k) => (
          <div key={k.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 18px" }}>
            <Kpi label={k.label} value={k.value} color={k.color} sub={k.sub} />
          </div>
        ))}
      </div>

      {/* Cards por módulo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        <Card href="/admin/usuarios" title="Usuários" icon="👥" alert={u.blocked}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Bar label="Free" value={u.free} max={maxRole} color="#64748b" />
            <Bar label="Pro" value={u.pro} max={maxRole} color="#f59e0b" />
            <Bar label="Band" value={u.proband} max={maxRole} color="#8b5cf6" />
          </div>
          <p style={{ color: "var(--muted2)", fontSize: 12, margin: "10px 0 0" }}>
            {u.newThisMonth} novos no mês · {u.blocked} bloqueados/banidos · {b.total} bandas
          </p>
        </Card>

        <Card href="/admin/audio" title="Áudio / Catálogo" icon="🎵" alert={c.moderationPending + c.processingFailed}>
          <div style={{ display: "flex", gap: 12 }}>
            <Kpi label="Músicas" value={String(c.totalSongs)} sub={`${c.userUploads} uploads de usuário`} />
            <Kpi label="Stems" value={String(c.stems)} />
          </div>
          <p style={{ color: "var(--muted2)", fontSize: 12, margin: "10px 0 0" }}>
            {c.moderationPending} pendentes de moderação · {c.moderationBlocked} bloqueadas · {c.processingFailed} falhas de processamento
          </p>
        </Card>

        <Card href="/admin/moderacao" title="Cifras" icon="📝" alert={cf.openReports}>
          <div style={{ display: "flex", gap: 12 }}>
            <Kpi label="Com cifra" value={String(cf.songsWithCifra)} />
            <Kpi label="Denúncias" value={String(cf.openReports)} color={cf.openReports > 0 ? "var(--danger)" : undefined} />
            <Kpi label="Edições/mês" value={String(cf.editsThisMonth)} />
          </div>
          <p style={{ color: "var(--muted2)", fontSize: 12, margin: "10px 0 0" }}>Denúncias abertas e histórico de edições da comunidade.</p>
        </Card>

        <Card href="/admin/consumo" title="Consumo" icon="📊" alert={f.delinquent}>
          <div style={{ display: "flex", gap: 12 }}>
            <Kpi label="Separações" value={String(f.separations)} sub={brl(f.separationCost)} />
            <Kpi label="Infra" value={brl(f.infraCost)} />
            <Kpi label="Assinantes" value={String(f.activeSubscribers.pro + f.activeSubscribers.proband)} sub={`${f.activeSubscribers.pro} Pro · ${f.activeSubscribers.proband} Band`} />
          </div>
          <p style={{ color: "var(--muted2)", fontSize: 12, margin: "10px 0 0" }}>
            {f.delinquent} assinatura(s) inadimplente(s) · margem {brl(f.margin)}
          </p>
        </Card>

        <Card href="/admin/musicas" title="Músicas (curadoria)" icon="🎼">
          <div style={{ display: "flex", gap: 12 }}>
            <Kpi label="Publicadas" value={String(c.published)} />
            <Kpi label="Total" value={String(c.totalSongs)} />
          </div>
          <p style={{ color: "var(--muted2)", fontSize: 12, margin: "10px 0 0" }}>Cadastrar, editar e publicar músicas do catálogo.</p>
        </Card>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <AdminGate title="Dashboard">
      <DashboardContent />
    </AdminGate>
  );
}
