"use client";

/**
 * Painel do piloto de 90 dias (PRD-BTS-001 v3.0). Mostra as metas do plano
 * lado a lado com o que a telemetria mediu, por coorte, e a leitura das regras
 * de decisão. Os números vêm de /api/admin/piloto.
 */
import { useEffect, useState, type CSSProperties } from "react";
import AdminGate from "../AdminGate";
import { adminHeaders } from "../adminClient";

type Stats = {
  users: number;
  activated: number;
  d7Eligible: number;
  d7: number;
  d30Eligible: number;
  d30: number;
  recordedPeople: number;
};

type Piloto = {
  generatedAt: string;
  cohorts: { invited: Stats; organic: Stats };
  wam: { weekStart: string; total: number; invited: number; current: boolean }[];
  decision: { label: string; reason: string };
  targets: { invited: number; activated: number; d7: number; d30: number; recordedPeople: number; wamWeek12: number };
};

const card: CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden",
};
const th: CSSProperties = { textAlign: "left", padding: "10px 14px", fontSize: 11, letterSpacing: "0.08em", color: "var(--muted)", borderBottom: "1px solid var(--border)" };
const td: CSSProperties = { padding: "10px 14px", fontSize: 14, color: "var(--text)", borderBottom: "1px solid var(--border)" };

function hit(value: number, target: number) {
  return value >= target ? "var(--accent)" : "var(--text)";
}

function PilotoContent() {
  const [data, setData] = useState<Piloto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/piloto", { headers: adminHeaders() });
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p style={{ color: "var(--muted)" }}>Carregando…</p>;
  if (!data) return <p style={{ color: "var(--danger)" }}>Não foi possível carregar o piloto.</p>;

  const inv = data.cohorts.invited;
  const org = data.cohorts.organic;
  const tg = data.targets;
  const maxWam = Math.max(tg.wamWeek12, ...data.wam.map((w) => w.total));
  const decisionColor = data.decision.label === "Avançar" ? "var(--accent)" : data.decision.label === "Reavaliar" ? "var(--danger)" : "#d97706";

  const rows: { label: string; inv: string; org: string; target: string; ok: boolean }[] = [
    { label: "Cadastros", inv: String(inv.users), org: String(org.users), target: `${tg.invited} convidados`, ok: inv.users >= tg.invited },
    { label: "Ativados (1ª prática significativa ou gravação)", inv: String(inv.activated), org: String(org.activated), target: `≥ ${tg.activated}`, ok: inv.activated >= tg.activated },
    { label: "Retorno D7 (janela 7–13 dias)", inv: `${inv.d7} de ${inv.d7Eligible}`, org: `${org.d7} de ${org.d7Eligible}`, target: `≥ ${tg.d7}`, ok: inv.d7 >= tg.d7 },
    { label: "Retorno D30 (janela 30–37 dias)", inv: `${inv.d30} de ${inv.d30Eligible}`, org: `${org.d30} de ${org.d30Eligible}`, target: `≥ ${tg.d30}`, ok: inv.d30 >= tg.d30 },
    { label: "Pessoas com gravação salva", inv: String(inv.recordedPeople), org: String(org.recordedPeople), target: `≥ ${tg.recordedPeople}`, ok: inv.recordedPeople >= tg.recordedPeople },
  ];

  return (
    <div>
      <h1 style={{ color: "var(--text)", fontSize: 22, fontWeight: 800, margin: "0 0 4px" }}>Piloto de 90 dias</h1>
      <p style={{ color: "var(--muted2)", fontSize: 13, margin: "0 0 20px" }}>
        Metas do PRD-BTS-001 v3.0 contra a telemetria. Admin e contas de teste interno ficam fora. Atualizado em{" "}
        {new Date(data.generatedAt).toLocaleString("pt-BR")}.
      </p>

      <div style={{ ...card, padding: "16px 18px", marginBottom: 20, borderColor: decisionColor }}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.1em", fontWeight: 700, color: "var(--muted)" }}>LEITURA DAS REGRAS DE DECISÃO (COORTE CONVIDADA)</p>
        <p style={{ margin: "6px 0 2px", fontSize: 22, fontWeight: 900, color: decisionColor }}>{data.decision.label}</p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>{data.decision.reason} A decisão vale no dia 90; antes disso é leitura parcial.</p>
      </div>

      <div style={{ ...card, marginBottom: 20 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>INDICADOR</th>
              <th style={th}>CONVIDADA</th>
              <th style={th}>ORGÂNICA</th>
              <th style={th}>META (CONVIDADA)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td style={td}>{r.label}</td>
                <td style={{ ...td, fontWeight: 800, color: r.ok ? "var(--accent)" : "var(--text)" }}>{r.inv}</td>
                <td style={td}>{r.org}</td>
                <td style={{ ...td, color: "var(--muted)" }}>{r.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ ...card, padding: "16px 18px" }}>
        <p style={{ margin: "0 0 12px", fontSize: 11, letterSpacing: "0.1em", fontWeight: 700, color: "var(--muted)" }}>
          WAM — MÚSICOS ATIVOS POR SEMANA (META NA SEMANA 12: ≥ {tg.wamWeek12})
        </p>
        <div style={{ display: "grid", gap: 6 }}>
          {data.wam.map((w) => (
            <div key={w.weekStart} style={{ display: "grid", gridTemplateColumns: "92px 1fr 64px", alignItems: "center", gap: 10, fontSize: 12.5 }}>
              <span style={{ color: w.current ? "var(--text)" : "var(--muted)", fontWeight: w.current ? 700 : 400 }}>
                {w.weekStart.split("-").reverse().join("/")}
              </span>
              <span style={{ height: 12, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                <span style={{ display: "block", height: "100%", width: `${(w.total / maxWam) * 100}%`, background: hit(w.total, tg.wamWeek12) === "var(--accent)" ? "var(--accent)" : "var(--muted2)" }} />
              </span>
              <span style={{ color: "var(--text)", fontWeight: 700, textAlign: "right" }}>
                {w.total} <span style={{ color: "var(--muted2)", fontWeight: 400 }}>({w.invited})</span>
              </span>
            </div>
          ))}
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--muted2)" }}>Total da semana (convidados entre parênteses). Semana de segunda a domingo, horário de Brasília.</p>
      </div>
    </div>
  );
}

export default function PilotoPage() {
  return (
    <AdminGate title="Piloto">
      <PilotoContent />
    </AdminGate>
  );
}
