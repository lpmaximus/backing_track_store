/**
 * GET /api/jobs/report   (cron — quarta e sábado, 07:00)
 *
 * Monta e envia por e-mail o resumo de audiência: números do Google Analytics
 * (visitantes anônimos) + atividade dos usuários cadastrados (banco próprio),
 * sempre comparando com o período anterior e apontando o que mudou.
 *
 * Roda no servidor porque só ele alcança o GA e o banco — nenhuma dependência
 * de máquina ligada.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>   (padrão de /api/jobs/trials)
 * Destino: REPORT_TO_EMAIL (ou MAIL_FROM / SMTP_USER como fallback)
 */
import { NextRequest, NextResponse } from "next/server";
import { db, userActivity, users, songs } from "@/src/db";
import { and, gte, lt, eq, ne, isNull, or, count, countDistinct, desc, notInArray } from "drizzle-orm";
import { batchRunReports, ga4Configured, num, dim } from "@/src/lib/ga4";
import { EVENT_LABELS, type ActivityEvent } from "@/src/lib/activity";
import { sendMail, mailerConfigured } from "@/src/lib/mailer";
import { internalTestEmailsOrUndefined } from "@/src/lib/internalTest";

export const runtime = "nodejs";

const DAYS = 7; // janela do resumo: a semana corrente contra a anterior
const DORMANT_DAYS = 30;

// Contas admin e de teste interno não entram no resumo: o relatório mede o
// público, não a equipe (ver src/lib/internalTest.ts).
const testEmails = internalTestEmailsOrUndefined();
const NOT_ADMIN = testEmails
  ? and(ne(users.role, "admin"), notInArray(users.email, testEmails))
  : ne(users.role, "admin");

function isCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return (
    req.headers.get("authorization") === `Bearer ${secret}` ||
    req.headers.get("x-cron-secret") === secret
  );
}

const brNum = (n: number) => n.toLocaleString("pt-BR");

function delta(cur: number, prev: number): { pct: number | null; texto: string } {
  if (!prev) return { pct: null, texto: "sem base anterior" };
  const p = Math.round(((cur - prev) / prev) * 1000) / 10;
  return { pct: p, texto: `${p >= 0 ? "+" : ""}${p}% vs. semana anterior` };
}

export async function GET(req: NextRequest) {
  if (!isCron(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const since = new Date(Date.now() - DAYS * 86_400_000);
  const prevSince = new Date(Date.now() - DAYS * 2 * 86_400_000);
  const dormantCutoff = new Date(Date.now() - DORMANT_DAYS * 86_400_000);

  try {
    // ── 1. Google Analytics (público anônimo) ────────────────────────────────
    let ga: {
      users: number;
      prevUsers: number;
      sessions: number;
      channels: { label: string; value: number }[];
      pages: { label: string; value: number }[];
    } | null = null;

    if (ga4Configured()) {
      const [reports] = await Promise.all([
        batchRunReports([
          { metrics: ["activeUsers", "sessions"], startDate: "7daysAgo", endDate: "today" },
          { metrics: ["activeUsers"], startDate: "14daysAgo", endDate: "8daysAgo" },
          {
            dimensions: ["sessionDefaultChannelGroup"],
            metrics: ["sessions"],
            startDate: "7daysAgo",
            endDate: "today",
            orderByMetric: "sessions",
            limit: 5,
          },
          {
            dimensions: ["pagePath"],
            metrics: ["screenPageViews"],
            startDate: "7daysAgo",
            endDate: "today",
            orderByMetric: "screenPageViews",
            limit: 5,
            excludePrefix: { dimension: "pagePath", value: "/admin" },
          },
        ]),
      ]);
      const [tot, prev, ch, pg] = reports;
      ga = {
        users: num(tot?.rows?.[0], 0),
        sessions: num(tot?.rows?.[0], 1),
        prevUsers: num(prev?.rows?.[0], 0),
        channels: (ch?.rows ?? []).map((r) => ({ label: dim(r), value: num(r) })),
        pages: (pg?.rows ?? []).map((r) => ({ label: dim(r), value: num(r) })),
      };
    }

    // ── 2. Usuários cadastrados (banco próprio) ──────────────────────────────
    const [registered, activeNow, activePrev, byEvent, topSongs, dormant, novos] = await Promise.all([
      db.select({ n: count() }).from(users).where(and(isNull(users.deletionScheduledAt), NOT_ADMIN)),
      db
        .select({ n: countDistinct(userActivity.userId) })
        .from(userActivity)
        .innerJoin(users, eq(users.id, userActivity.userId))
        .where(and(gte(userActivity.createdAt, since), NOT_ADMIN)),
      db
        .select({ n: countDistinct(userActivity.userId) })
        .from(userActivity)
        .innerJoin(users, eq(users.id, userActivity.userId))
        .where(and(gte(userActivity.createdAt, prevSince), lt(userActivity.createdAt, since), NOT_ADMIN)),
      db
        .select({ event: userActivity.event, n: count() })
        .from(userActivity)
        .innerJoin(users, eq(users.id, userActivity.userId))
        .where(and(gte(userActivity.createdAt, since), NOT_ADMIN))
        .groupBy(userActivity.event)
        .orderBy(desc(count())),
      db
        .select({ title: songs.title, artist: songs.artist, n: count() })
        .from(userActivity)
        .innerJoin(songs, eq(songs.id, userActivity.songId))
        .innerJoin(users, eq(users.id, userActivity.userId))
        .where(and(gte(userActivity.createdAt, since), eq(userActivity.event, "play"), NOT_ADMIN))
        .groupBy(songs.id, songs.title, songs.artist)
        .orderBy(desc(count()))
        .limit(5),
      db
        .select({ n: count() })
        .from(users)
        .where(
          and(
            isNull(users.deletionScheduledAt),
            NOT_ADMIN,
            or(isNull(users.lastSeenAt), lt(users.lastSeenAt, dormantCutoff)),
          ),
        ),
      db
        .select({ n: count() })
        .from(users)
        .where(and(isNull(users.deletionScheduledAt), NOT_ADMIN, gte(users.createdAt, since))),
    ]);

    const base = registered[0]?.n ?? 0;
    const ativos = activeNow[0]?.n ?? 0;
    const ativosPrev = activePrev[0]?.n ?? 0;
    const dAtivos = delta(ativos, ativosPrev);
    const dVisitantes = ga ? delta(ga.users, ga.prevUsers) : { pct: null, texto: "GA não configurado" };
    const taxa = base > 0 ? Math.round((ativos / base) * 1000) / 10 : 0;

    // ── 3. Leitura: o que merece atenção ─────────────────────────────────────
    const alertas: string[] = [];
    if (dVisitantes.pct !== null && dVisitantes.pct <= -20) {
      alertas.push(`Tráfego caiu ${Math.abs(dVisitantes.pct)}% — vale checar origem do tráfego e se algo quebrou no SEO.`);
    }
    if (ga && ga.users > 0 && novos[0]?.n === 0) {
      alertas.push(`${brNum(ga.users)} visitantes e nenhum cadastro novo — o gargalo está na conversão, não na aquisição.`);
    }
    if (base > 0 && taxa < 20) {
      alertas.push(`Só ${taxa}% da base deu sinal de vida na semana — retenção é o problema mais caro agora.`);
    }
    if (dAtivos.pct !== null && dAtivos.pct <= -20) {
      alertas.push(`Usuários ativos caíram ${Math.abs(dAtivos.pct)}% frente à semana anterior.`);
    }
    if ((dormant[0]?.n ?? 0) > base * 0.5 && base > 4) {
      alertas.push(`${brNum(dormant[0]?.n ?? 0)} de ${brNum(base)} cadastrados estão dormentes há mais de 30 dias.`);
    }
    if (alertas.length === 0) alertas.push("Nada fora da curva nesta semana.");

    // ── 4. E-mail ────────────────────────────────────────────────────────────
    const linha = (l: string, v: string) => `<tr><td style="padding:4px 12px 4px 0;color:#666">${l}</td><td style="padding:4px 0;font-weight:700">${v}</td></tr>`;
    const lista = (items: { label: string; value: number }[]) =>
      items.length === 0
        ? "<li style='color:#999'>sem dados</li>"
        : items.map((i) => `<li>${i.label} — <strong>${brNum(i.value)}</strong></li>`).join("");

    const html = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:640px;color:#111">
        <h2 style="margin:0 0 4px">Resumo de audiência · últimos 7 dias</h2>
        <p style="color:#666;margin:0 0 20px">backingtrack.store — gerado em ${new Date().toLocaleString("pt-BR")}</p>

        <h3 style="margin:20px 0 6px">Público (Google Analytics)</h3>
        <table style="border-collapse:collapse;font-size:14px">
          ${ga ? linha("Visitantes", `${brNum(ga.users)} (${dVisitantes.texto})`) : linha("Visitantes", "GA não configurado")}
          ${ga ? linha("Sessões", brNum(ga.sessions)) : ""}
        </table>
        ${ga ? `<p style="margin:12px 0 4px;font-weight:700">De onde vieram</p><ul style="margin:0;font-size:14px">${lista(ga.channels)}</ul>` : ""}
        ${ga ? `<p style="margin:12px 0 4px;font-weight:700">Páginas mais vistas</p><ul style="margin:0;font-size:14px">${lista(ga.pages)}</ul>` : ""}

        <h3 style="margin:24px 0 6px">Usuários cadastrados</h3>
        <table style="border-collapse:collapse;font-size:14px">
          ${linha("Base total", brNum(base))}
          ${linha("Novos na semana", brNum(novos[0]?.n ?? 0))}
          ${linha("Ativos na semana", `${brNum(ativos)} — ${taxa}% da base (${dAtivos.texto})`)}
          ${linha("Dormentes (30+ dias)", brNum(dormant[0]?.n ?? 0))}
        </table>
        <p style="margin:12px 0 4px;font-weight:700">O que fizeram</p>
        <ul style="margin:0;font-size:14px">${lista(
          byEvent.map((e) => ({ label: EVENT_LABELS[e.event as ActivityEvent] ?? e.event, value: e.n })),
        )}</ul>
        <p style="margin:12px 0 4px;font-weight:700">Mais tocadas por quem está logado</p>
        <ul style="margin:0;font-size:14px">${lista(topSongs.map((s) => ({ label: `${s.title} — ${s.artist}`, value: s.n })))}</ul>

        <h3 style="margin:24px 0 6px">O que merece atenção</h3>
        <ul style="margin:0;font-size:14px">${alertas.map((a) => `<li style="margin-bottom:4px">${a}</li>`).join("")}</ul>

        <p style="margin:24px 0 0;font-size:12px;color:#888">
          Painel completo em <a href="https://www.backingtrack.store/admin/analytics">/admin/analytics</a>.
        </p>
      </div>`;

    const text = [
      "Resumo de audiência — últimos 7 dias",
      ga ? `Visitantes: ${brNum(ga.users)} (${dVisitantes.texto}) · Sessões: ${brNum(ga.sessions)}` : "GA não configurado",
      `Cadastrados: ${brNum(base)} (+${brNum(novos[0]?.n ?? 0)} novos) · Ativos: ${brNum(ativos)} (${taxa}%) · Dormentes: ${brNum(dormant[0]?.n ?? 0)}`,
      "",
      "Atenção:",
      ...alertas.map((a) => `- ${a}`),
    ].join("\n");

    const to = process.env.REPORT_TO_EMAIL || process.env.MAIL_FROM || process.env.SMTP_USER;
    if (!to || !mailerConfigured()) {
      return NextResponse.json({ ok: false, error: "Destinatário ou SMTP não configurado", preview: text }, { status: 200 });
    }

    const messageId = await sendMail({
      to,
      subject: `Backing Track — resumo de audiência (${new Date().toLocaleDateString("pt-BR")})`,
      text,
      html,
    });

    return NextResponse.json({ ok: true, messageId, to });
  } catch (err) {
    console.error("[GET /api/jobs/report]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro interno" }, { status: 500 });
  }
}
