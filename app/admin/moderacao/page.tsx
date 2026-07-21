"use client";

/**
 * /admin/moderacao — módulo Cifras do painel (moderação).
 * Unificado com AdminGate (senha admin) em 2026-07-20: antes exigia sessão
 * NextAuth com role 'admin' e usava o header/footer do site público, o que
 * "expulsava" quem entrou no painel só pela senha. Dados agora vêm de
 * GET /api/admin/moderacao.
 */
import { useCallback, useEffect, useState } from "react";
import AdminGate from "../AdminGate";
import { adminHeaders } from "../adminClient";
import ModeracaoContent, { type Report, type History } from "./ModeracaoContent";

function ModeracaoLoader() {
  const [reports, setReports] = useState<Report[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/moderacao", { headers: adminHeaders() });
      if (!res.ok) { setError(true); return; }
      const data = await res.json();
      setReports(Array.isArray(data.reports) ? data.reports : []);
      setHistory(Array.isArray(data.history) ? data.history : []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p style={{ color: "var(--muted)" }}>Carregando moderação…</p>;
  if (error) return <p style={{ color: "var(--danger)" }}>Não foi possível carregar a moderação.</p>;

  return <ModeracaoContent reports={reports} history={history} onRefresh={load} />;
}

export default function ModeracaoPage() {
  return (
    <AdminGate title="Cifras">
      <ModeracaoLoader />
    </AdminGate>
  );
}
