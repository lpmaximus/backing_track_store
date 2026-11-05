"use client";

import { useEffect, useState } from "react";
import AdminGate from "../AdminGate";
import { adminHeaders } from "../adminClient";

type Consumo = {
  month: string;
  separations: number;
  separationCost: number;
  infraCost: number;
  totalCost: number;
  activeSubscribers: { pro: number; proband: number };
  mrr: number;
  delinquent: number;
  margin: number;
  note: string;
  beta?: {
    enabled: boolean;
    budget: {
      separations: number;
      costPerSeparationBrl: number;
      spentBrl: number;
      budgetBrl: number | null;
      ratio: number | null;
      blocked: boolean;
    } | null;
    limits: {
      separationsPerMonth: number;
      maxDurationSec: number;
      concurrentPerUser: number;
      takes: { free: { perSong: number; total: number }; pro: { perSong: number; total: number } };
    };
  };
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Row({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
      <span style={{ color: "var(--muted)", fontSize: 14 }}>{label}</span>
      <span style={{ color: color ?? "var(--text)", fontSize: strong ? 20 : 16, fontWeight: strong ? 800 : 600 }}>{value}</span>
    </div>
  );
}

function ConsumoContent() {
  const [data, setData] = useState<Consumo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/consumo", { headers: adminHeaders() });
        if (res.ok) setData(await res.json());
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <p style={{ color: "var(--muted)" }}>Carregando…</p>;
  if (!data) return <p style={{ color: "var(--danger)" }}>Não foi possível carregar o consumo.</p>;

  return (
    <div>
      <h1 style={{ color: "var(--text)", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Consumo · {data.month}</h1>
      <p style={{ color: "var(--muted2)", fontSize: 13, margin: "0 0 20px" }}>{data.note}</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", padding: "14px 18px 0", margin: 0 }}>CUSTO</p>
          <Row label={`Separações no mês (${data.separations})`} value={brl(data.separationCost)} />
          <Row label="Infra (R2 + Neon + Vercel)" value={brl(data.infraCost)} />
          <Row label="Custo total" value={brl(data.totalCost)} strong color="var(--danger)" />
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", padding: "14px 18px 0", margin: 0 }}>RECEITA</p>
          <Row label={`Assinantes Pro (${data.activeSubscribers.pro}) + Band (${data.activeSubscribers.proband})`} value={brl(data.mrr)} />
          <Row label="Inadimplência (assinaturas)" value={String(data.delinquent)} />
          <Row label="MRR" value={brl(data.mrr)} strong color="var(--accent)" />
        </div>
      </div>

      {data.beta && <BetaBudget beta={data.beta} />}

      <div style={{ marginTop: 20, background: data.margin >= 0 ? "rgba(255,154,0,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${data.margin >= 0 ? "rgba(255,154,0,0.25)" : "rgba(239,68,68,0.25)"}`, borderRadius: 12, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--text)", fontSize: 16, fontWeight: 700 }}>Margem do mês (receita − custo)</span>
        <span style={{ color: data.margin >= 0 ? "var(--accent)" : "var(--danger)", fontSize: 26, fontWeight: 900 }}>{brl(data.margin)}</span>
      </div>
    </div>
  );
}

/** Orçamento e travas do Open Beta (PRD-BTS-001 §7). */
function BetaBudget({ beta }: { beta: NonNullable<Consumo["beta"]> }) {
  const b = beta.budget;
  const pct = b?.ratio != null ? Math.round(b.ratio * 100) : null;
  const color = !b ? "var(--muted)" : b.blocked ? "var(--danger)" : pct != null && pct >= 70 ? "#d97706" : "var(--accent)";
  const l = beta.limits;
  return (
    <div style={{ marginTop: 20, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
      <p style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.1em", color: "var(--muted)", padding: "14px 18px 0", margin: 0 }}>
        OPEN BETA · {beta.enabled ? "LIGADO" : "DESLIGADO"}
      </p>
      {b ? (
        <>
          <Row
            label={`Gasto estimado de separação (${b.separations} × ${brl(b.costPerSeparationBrl)})`}
            value={b.budgetBrl != null ? `${brl(b.spentBrl)} de ${brl(b.budgetBrl)}` : `${brl(b.spentBrl)} · sem teto definido`}
            strong
            color={color}
          />
          {pct != null && (
            <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: color }} />
              </div>
              <p style={{ color: "var(--muted2)", fontSize: 12, margin: "8px 0 0" }}>
                {pct}% do orçamento · alertas por e-mail em 70%, 90% e 100% · {b.blocked ? "novas separações BLOQUEADAS" : "separações liberadas"}
              </p>
            </div>
          )}
        </>
      ) : (
        <Row label="Orçamento" value="não foi possível medir" />
      )}
      <Row label="Separações por mês (Free no Beta)" value={String(l.separationsPerMonth)} />
      <Row label="Duração máxima por arquivo" value={`${Math.round(l.maxDurationSec / 60)} min`} />
      <Row label="Separações simultâneas por usuário" value={String(l.concurrentPerUser)} />
      <Row label="Takes no Beta (Free / Pro)" value={`${l.takes.free.perSong}/música, ${l.takes.free.total} no total · ${l.takes.pro.perSong}/música, ${l.takes.pro.total} no total`} />
    </div>
  );
}

export default function ConsumoPage() {
  return (
    <AdminGate title="Consumo">
      <ConsumoContent />
    </AdminGate>
  );
}
