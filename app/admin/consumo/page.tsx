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

      <div style={{ marginTop: 20, background: data.margin >= 0 ? "rgba(255,154,0,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${data.margin >= 0 ? "rgba(255,154,0,0.25)" : "rgba(239,68,68,0.25)"}`, borderRadius: 12, padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--text)", fontSize: 16, fontWeight: 700 }}>Margem do mês (receita − custo)</span>
        <span style={{ color: data.margin >= 0 ? "var(--accent)" : "var(--danger)", fontSize: 26, fontWeight: 900 }}>{brl(data.margin)}</span>
      </div>
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
