/**
 * GET /api/admin/analytics?days=7|30|90
 *
 * Resumo executivo do Google Analytics 4 para o painel admin: visitantes,
 * sessões, novos × recorrentes, páginas mais vistas, origem do tráfego,
 * dispositivos e cidades — mais a comparação com o período anterior.
 *
 * Cacheado em memória por 10 min (a Data API tem cota diária por propriedade).
 */
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/src/lib/adminAuth";
import { batchRunReports, runRealtimeActiveUsers, ga4Configured, num, dim, type GaReport } from "@/src/lib/ga4";

export const dynamic = "force-dynamic";

const ALLOWED_DAYS = [7, 30, 90];
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<number, { at: number; payload: unknown }>();

type Slice = { label: string; value: number };

function toSlices(report: GaReport | undefined): Slice[] {
  return (report?.rows ?? []).map((r) => ({ label: dim(r), value: num(r) }));
}

function pct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!ga4Configured()) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "Google Analytics não configurado. Defina GA4_PROPERTY_ID, GA4_CLIENT_EMAIL e GA4_PRIVATE_KEY nas variáveis de ambiente.",
      },
      { status: 200 },
    );
  }

  const requested = Number(req.nextUrl.searchParams.get("days") ?? 30);
  const days = ALLOWED_DAYS.includes(requested) ? requested : 30;

  const hit = cache.get(days);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ ...(hit.payload as object), cached: true });
  }

  const startDate = `${days}daysAgo`;
  const endDate = "today";
  const prevStart = `${days * 2}daysAgo`;
  const prevEnd = `${days + 1}daysAgo`;

  try {
    const [batchA, batchB, realtime] = await Promise.all([
      batchRunReports([
        {
          metrics: ["activeUsers", "newUsers", "sessions", "screenPageViews", "averageSessionDuration", "bounceRate"],
          startDate,
          endDate,
        },
        { dimensions: ["date"], metrics: ["activeUsers", "sessions"], startDate, endDate },
        { dimensions: ["newVsReturning"], metrics: ["activeUsers"], startDate, endDate },
        {
          dimensions: ["pagePath"],
          metrics: ["screenPageViews"],
          startDate,
          endDate,
          orderByMetric: "screenPageViews",
          limit: 12,
        },
        {
          dimensions: ["sessionDefaultChannelGroup"],
          metrics: ["sessions"],
          startDate,
          endDate,
          orderByMetric: "sessions",
          limit: 8,
        },
      ]),
      batchRunReports([
        { dimensions: ["deviceCategory"], metrics: ["activeUsers"], startDate, endDate, orderByMetric: "activeUsers" },
        { dimensions: ["city"], metrics: ["activeUsers"], startDate, endDate, orderByMetric: "activeUsers", limit: 8 },
        { metrics: ["activeUsers", "sessions"], startDate: prevStart, endDate: prevEnd },
      ]),
      runRealtimeActiveUsers().catch(() => 0),
    ]);

    const [totalsR, dailyR, nvrR, pagesR, channelsR] = batchA;
    const [devicesR, citiesR, prevR] = batchB;

    const t = totalsR?.rows?.[0];
    const p = prevR?.rows?.[0];

    const activeUsers = num(t, 0);
    const sessions = num(t, 2);
    const prevUsers = num(p, 0);
    const prevSessions = num(p, 1);

    const nvr = toSlices(nvrR);
    const newVisitors = nvr.find((s) => s.label === "new")?.value ?? 0;
    const returningVisitors = nvr.find((s) => s.label === "returning")?.value ?? 0;

    const payload = {
      configured: true,
      days,
      realtimeUsers: realtime,
      totals: {
        activeUsers,
        newUsers: num(t, 1),
        sessions,
        pageViews: num(t, 3),
        avgSessionSeconds: Math.round(num(t, 4)),
        bounceRate: Math.round(num(t, 5) * 1000) / 10,
      },
      delta: { activeUsers: pct(activeUsers, prevUsers), sessions: pct(sessions, prevSessions) },
      daily: (dailyR?.rows ?? []).map((r) => ({
        date: dim(r), // YYYYMMDD
        users: num(r, 0),
        sessions: num(r, 1),
      })),
      newVsReturning: { new: newVisitors, returning: returningVisitors },
      topPages: toSlices(pagesR),
      channels: toSlices(channelsR),
      devices: toSlices(devicesR),
      cities: toSlices(citiesR).filter((c) => c.label && c.label !== "(not set)"),
      generatedAt: new Date().toISOString(),
    };

    cache.set(days, { at: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ configured: true, error: message }, { status: 502 });
  }
}
