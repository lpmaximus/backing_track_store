"use client";

/**
 * /admin/analytics — resumo executivo do Google Analytics 4.
 * Visitantes, sessões, novos × recorrentes, páginas, canais, dispositivos e
 * cidades, com comparação contra o período anterior. Dados de
 * /api/admin/analytics (senha admin via AdminGate).
 */
import { useCallback, useEffect, useState } from "react";
import AdminGate from "../AdminGate";
import { adminHeaders } from "../adminClient";

type Slice = { label: string; value: number };

type Analytics = {
  configured: boolean;
  error?: string;
  days: number;
  realtimeUsers: number;
  totals: {
    activeUsers: number;
    newUsers: number;
    sessions: number;
    pageViews: number;
    avgSessionSeconds: number;
    bounceRate: number;
  };
  delta: { activeUsers: number | null; sessions: number | null };
  daily: { date: string; users: number; sessions: number }[];
  newVsReturning: { new: number; returning: number };
  topPages: Slice[];
  channels: Slice[];
  devices: Slice[];
  browsers: Slice[];
  operatingSystems: Slice[];
  countries: Slice[];
  regions: Slice[];
  cities: Slice[];
  generatedAt: string;
};

const PERIODS = [7, 30, 90];

const CHANNEL_LABELS: Record<string, string> = {
  "Organic Search": "Busca orgânica",
  "Direct": "Direto",
  "Paid Search": "Busca paga",
  "Organic Social": "Social orgânico",
  "Paid Social": "Social pago",
  "Referral": "Referência",
  "Email": "E-mail",
  "Unassigned": "Não atribuído",
  "Display": "Display",
  "Organic Video": "Vídeo orgânico",
};

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Celular",
  desktop: "Computador",
  tablet: "Tablet",
  smarttv: "Smart TV",
};

const OS_LABELS: Record<string, string> = {
  Windows: "Windows",
  Android: "Android",
  iOS: "iOS",
  Macintosh: "macOS",
  Linux: "Linux",
  "Chrome OS": "ChromeOS",
};

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtDate(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}`;
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: "var(--muted2)", fontSize: 11 }}>sem base anterior</span>;
  const up = value >= 0;
  return (
    <span style={{ color: up ? "#16a34a" : "#ef4444", fontSize: 11, fontWeight: 700 }}>
      {up ? "▲" : "▼"} {Math.abs(value)}% vs. período anterior
    </span>
  );
}

function Kpi({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: number | null }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 18px" }}>
      <p style={{ color: "var(--muted)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", margin: 0, textTransform: "uppercase" }}>{label}</p>
      <p style={{ color: "var(--text)", fontSize: 26, fontWeight: 900, margin: "2px 0 0", lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ color: "var(--muted2)", fontSize: 11, margin: "2px 0 0" }}>{sub}</p>}
      {delta !== undefined && <div style={{ marginTop: 2 }}><Delta value={delta} /></div>}
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ marginBottom: 12 }}>
        <span style={{ color: "var(--text)", fontWeight: 800, fontSize: 14 }}>{title}</span>
        {hint && <p style={{ color: "var(--muted2)", fontSize: 11, margin: "2px 0 0" }}>{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Ranking({ items, translate }: { items: Slice[]; translate?: Record<string, string> }) {
  if (items.length === 0) return <p style={{ color: "var(--muted2)", fontSize: 13, margin: 0 }}>Sem dados no período.</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {items.map((i) => (
        <div key={i.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
          <span style={{ color: "var(--muted)", width: 150, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={i.label}>
            {translate?.[i.label] ?? i.label}
          </span>
          <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 4, height: 10, overflow: "hidden" }}>
            <div style={{ width: `${Math.round((i.value / max) * 100)}%`, minWidth: i.value > 0 ? 3 : 0, height: "100%", background: "#f59e0b", borderRadius: 4 }} />
          </div>
          <span style={{ color: "var(--text)", fontWeight: 700, width: 46, textAlign: "right", flexShrink: 0 }}>
            {i.value.toLocaleString("pt-BR")}
          </span>
        </div>
      ))}
    </div>
  );
}

function Sparkline({ data }: { data: { date: string; users: number }[] }) {
  if (data.length < 2) return <p style={{ color: "var(--muted2)", fontSize: 13, margin: 0 }}>Dados insuficientes para o gráfico.</p>;
  const max = Math.max(...data.map((d) => d.users), 1);
  const w = 100;
  const h = 40;
  const points = data
    .map((d, idx) => `${(idx / (data.length - 1)) * w},${h - (d.users / max) * h}`)
    .join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: 110, display: "block" }} role="img" aria-label="Visitantes por dia">
        <polyline points={`0,${h} ${points} ${w},${h}`} fill="#f59e0b22" stroke="none" />
        <polyline points={points} fill="none" stroke="#f59e0b" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted2)", fontSize: 11, marginTop: 4 }}>
        <span>{fmtDate(data[0].date)}</span>
        <span>pico: {max.toLocaleString("pt-BR")} visitantes/dia</span>
        <span>{fmtDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}

type Activity = {
  days: number;
  pendingMigration?: boolean;
  error?: string;
  registered: number;
  active: number;
  activationRate: number;
  activeDelta: number | null;
  newUsers: number;
  dormant: number;
  byRole: Slice[];
  byEvent: (Slice & { people: number })[];
  topSongs: (Slice & { slug: string })[];
  topUsers: (Slice & { role: string; lastSeenAt: string | null })[];
};

function UsersPanel({ days }: { days: number }) {
  const [data, setData] = useState<Activity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/admin/atividade?days=${days}`, { headers: adminHeaders() })
      .then((r) => r.json())
      .then((j) => alive && setData(j))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [days]);

  if (loading) return <p style={{ color: "var(--muted)" }}>Carregando atividade dos cadastrados…</p>;

  if (!data || data.pendingMigration) {
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
        <p style={{ color: "var(--text)", fontWeight: 700, margin: 0 }}>Rastreamento ainda não instalado</p>
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "8px 0 0" }}>
          Falta rodar a migração do banco (<code>npm run db:push</code>) para criar a tabela de atividade.
          A partir daí os eventos começam a ser gravados.
        </p>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 16 }}>
        <Kpi label="Cadastrados" value={data.registered.toLocaleString("pt-BR")} sub={`+${data.newUsers} no período`} />
        <Kpi
          label="Ativos no período"
          value={data.active.toLocaleString("pt-BR")}
          sub={`${data.activationRate}% da base`}
          delta={data.activeDelta}
        />
        <Kpi label="Dormentes" value={data.dormant.toLocaleString("pt-BR")} sub="sem sinal há 30+ dias" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        <Panel title="🎛️ O que os cadastrados fazem" hint="Eventos no período — o número ao lado é o total de vezes">
          <Ranking items={data.byEvent} />
          {data.byEvent.length > 0 && (
            <p style={{ color: "var(--muted2)", fontSize: 11, margin: "10px 0 0" }}>
              {data.byEvent.map((e) => `${e.label}: ${e.people} pessoa(s)`).join(" · ")}
            </p>
          )}
        </Panel>

        <Panel title="💳 Ativos por plano" hint="Se o Pro não usa mais que o Free, o plano não está entregando valor">
          <Ranking items={data.byRole} />
        </Panel>

        <Panel title="🎧 Mais tocadas por quem está logado" hint="Diferente do catálogo geral: é o que a base realmente ensaia">
          <Ranking items={data.topSongs} />
        </Panel>

        <Panel title="⭐ Quem mais usa" hint="Candidatos naturais para pedir feedback e depoimento">
          {data.topUsers.length === 0 ? (
            <p style={{ color: "var(--muted2)", fontSize: 13, margin: 0 }}>Sem atividade no período.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {data.topUsers.map((u) => (
                <div key={u.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.label}
                  </span>
                  <span style={{ color: "var(--muted2)", fontSize: 11, fontWeight: 700 }}>{u.role}</span>
                  <span style={{ color: "var(--text)", fontWeight: 700, width: 40, textAlign: "right" }}>{u.value}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function AnalyticsContent() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (period: number) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/analytics?days=${period}`, { headers: adminHeaders() });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Falha ao consultar o Google Analytics.");
        setData(null);
      } else if (json.configured === false) {
        setError(json.error);
        setData(null);
      } else {
        setData(json);
      }
    } catch {
      setError("Falha de rede ao consultar o Google Analytics.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  const total = data ? data.newVsReturning.new + data.newVsReturning.returning : 0;
  const newPct = total > 0 && data ? Math.round((data.newVsReturning.new / total) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "var(--text)", fontSize: 22, fontWeight: 900, margin: 0 }}>Audiência · Google Analytics</h1>
          <p style={{ color: "var(--muted2)", fontSize: 13, margin: "4px 0 0" }}>
            De onde vêm os visitantes e o que eles olham. Dados em cache por 10 minutos.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setDays(p)}
              style={{
                padding: "6px 12px", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer",
                background: days === p ? "#f59e0b" : "var(--surface2)", color: days === p ? "#000" : "var(--muted)",
                border: "1px solid var(--border)",
              }}
            >
              {p} dias
            </button>
          ))}
        </div>
      </div>

      {loading && <p style={{ color: "var(--muted)" }}>Carregando dados do Analytics…</p>}

      {!loading && error && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <p style={{ color: "var(--danger, #ef4444)", fontWeight: 700, margin: 0 }}>Não foi possível carregar</p>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{error}</p>
        </div>
      )}

      {!loading && data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 16 }}>
            <Kpi label="Visitantes" value={data.totals.activeUsers.toLocaleString("pt-BR")} delta={data.delta.activeUsers} />
            <Kpi label="Sessões" value={data.totals.sessions.toLocaleString("pt-BR")} delta={data.delta.sessions} />
            <Kpi label="Páginas vistas" value={data.totals.pageViews.toLocaleString("pt-BR")} sub={`${(data.totals.sessions > 0 ? data.totals.pageViews / data.totals.sessions : 0).toFixed(1)} por sessão`} />
            <Kpi label="Tempo médio" value={fmtDuration(data.totals.avgSessionSeconds)} sub={`rejeição ${data.totals.bounceRate}%`} />
            <Kpi label="Agora no site" value={data.realtimeUsers.toLocaleString("pt-BR")} sub="últimos 30 min" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            <Panel title="📈 Visitantes por dia" hint={`Últimos ${data.days} dias`}>
              <Sparkline data={data.daily} />
            </Panel>

            <Panel title="🔁 Novos × recorrentes" hint="Recorrência indica que o produto prende — foco de retenção">
              <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", height: 14, borderRadius: 7, overflow: "hidden", background: "var(--surface2)" }}>
                    <div style={{ width: `${newPct}%`, background: "#f59e0b" }} />
                    <div style={{ width: `${100 - newPct}%`, background: "#8b5cf6" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12 }}>
                    <span style={{ color: "var(--muted)" }}>🟠 Novos: <strong style={{ color: "var(--text)" }}>{data.newVsReturning.new.toLocaleString("pt-BR")}</strong> ({newPct}%)</span>
                    <span style={{ color: "var(--muted)" }}>🟣 Recorrentes: <strong style={{ color: "var(--text)" }}>{data.newVsReturning.returning.toLocaleString("pt-BR")}</strong></span>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="🚪 Origem do tráfego" hint="Onde investir esforço de aquisição">
              <Ranking items={data.channels} translate={CHANNEL_LABELS} />
            </Panel>

            <Panel title="📄 Páginas mais vistas" hint="O que atrai — e o que ninguém abre">
              <Ranking items={data.topPages} />
            </Panel>

            <Panel title="📱 Dispositivos" hint="Prioridade de otimização de layout">
              <Ranking items={data.devices} translate={DEVICE_LABELS} />
            </Panel>

            <Panel title="🖥️ Navegador e sistema" hint="O que precisa ser testado antes de subir mudança de front">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <p style={{ color: "var(--muted2)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Navegador</p>
                  <Ranking items={data.browsers} />
                </div>
                <div>
                  <p style={{ color: "var(--muted2)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Sistema operacional</p>
                  <Ranking items={data.operatingSystems} translate={OS_LABELS} />
                </div>
              </div>
            </Panel>

            <Panel title="🌍 Localização" hint="Orienta anúncio geolocalizado e parceria com escolas de música">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <p style={{ color: "var(--muted2)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>País</p>
                  <Ranking items={data.countries} />
                </div>
                <div>
                  <p style={{ color: "var(--muted2)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Estado / região</p>
                  <Ranking items={data.regions} />
                </div>
                <div>
                  <p style={{ color: "var(--muted2)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 6px" }}>Cidade</p>
                  <Ranking items={data.cities} />
                </div>
              </div>
              <p style={{ color: "var(--muted2)", fontSize: 11, margin: "12px 0 0" }}>
                Precisão até o nível de cidade — o Google infere pelo IP e não devolve o endereço.
              </p>
            </Panel>
          </div>

          <p style={{ color: "var(--muted2)", fontSize: 11, marginTop: 16 }}>
            Atualizado em {new Date(data.generatedAt).toLocaleString("pt-BR")} · propriedade GA4 do backingtrack.store
          </p>
        </>
      )}

      {/* ── Usuários cadastrados: o GA não sabe quem é quem; isto sabe ── */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ color: "var(--text)", fontSize: 18, fontWeight: 900, margin: "0 0 4px" }}>Usuários cadastrados</h2>
        <p style={{ color: "var(--muted2)", fontSize: 13, margin: "0 0 16px" }}>
          Quem criou conta, quem volta e o que faz dentro do sistema. Dado do próprio banco, não do Google.
        </p>
        <UsersPanel days={days} />
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <AdminGate title="Audiência">
      <AnalyticsContent />
    </AdminGate>
  );
}
