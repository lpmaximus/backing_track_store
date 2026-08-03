/**
 * GET /api/admin/atividade?days=7|30|90
 *
 * Complemento do painel de Audiência: enquanto o GA4 conta visitante anônimo,
 * isto responde "dos que se cadastraram, quem volta e o que faz".
 * Fonte: user_activity + users (ver src/lib/activity.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { db, userActivity, users, songs } from "@/src/db";
import { and, gte, eq, ne, isNull, or, lt, desc, count, countDistinct, notInArray } from "drizzle-orm";
import { isAdminRequest } from "@/src/lib/adminAuth";
import { EVENT_LABELS, type ActivityEvent } from "@/src/lib/activity";
import { roleLabel } from "@/src/lib/roles";
import { internalTestEmailsOrUndefined } from "@/src/lib/internalTest";

export const dynamic = "force-dynamic";

const ALLOWED_DAYS = [7, 30, 90];
const DORMANT_DAYS = 30;

// O painel mede os usuários, não a equipe: admin E contas de teste interno
// (ver src/lib/internalTest.ts) ficam de fora de tudo. A conta de teste tem
// role normal de propósito, por isso não basta excluir por role.
const testEmails = internalTestEmailsOrUndefined();
const NOT_ADMIN = testEmails
  ? and(ne(users.role, "admin"), notInArray(users.email, testEmails))
  : ne(users.role, "admin");

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const requested = Number(req.nextUrl.searchParams.get("days") ?? 30);
  const days = ALLOWED_DAYS.includes(requested) ? requested : 30;
  const since = new Date(Date.now() - days * 86_400_000);
  const prevSince = new Date(Date.now() - days * 2 * 86_400_000);
  const dormantCutoff = new Date(Date.now() - DORMANT_DAYS * 86_400_000);

  try {
    const [
      totals,
      activeNow,
      activePrev,
      byRole,
      byEvent,
      topSongs,
      topUsers,
      dormant,
      newUsers,
    ] = await Promise.all([
      // Base de cadastrados (exclui contas em exclusão)
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

      // Ativos por plano — mostra se quem paga usa mais que quem não paga
      db
        .select({ role: users.role, n: countDistinct(userActivity.userId) })
        .from(userActivity)
        .innerJoin(users, eq(users.id, userActivity.userId))
        .where(and(gte(userActivity.createdAt, since), NOT_ADMIN))
        .groupBy(users.role),

      // O QUE fazem
      db
        .select({
          event: userActivity.event,
          n: count(),
          people: countDistinct(userActivity.userId),
        })
        .from(userActivity)
        .innerJoin(users, eq(users.id, userActivity.userId))
        .where(and(gte(userActivity.createdAt, since), NOT_ADMIN))
        .groupBy(userActivity.event)
        .orderBy(desc(count())),

      // Músicas mais tocadas por quem está logado
      db
        .select({
          title: songs.title,
          artist: songs.artist,
          slug: songs.slug,
          n: count(),
        })
        .from(userActivity)
        .innerJoin(songs, eq(songs.id, userActivity.songId))
        .innerJoin(users, eq(users.id, userActivity.userId))
        .where(and(gte(userActivity.createdAt, since), eq(userActivity.event, "play"), NOT_ADMIN))
        .groupBy(songs.id, songs.title, songs.artist, songs.slug)
        .orderBy(desc(count()))
        .limit(10),

      // Quem mais usa (para conversa de retenção / feedback)
      db
        .select({
          name: users.name,
          email: users.email,
          role: users.role,
          n: count(),
          lastSeenAt: users.lastSeenAt,
        })
        .from(userActivity)
        .innerJoin(users, eq(users.id, userActivity.userId))
        .where(and(gte(userActivity.createdAt, since), NOT_ADMIN))
        .groupBy(users.id, users.name, users.email, users.role, users.lastSeenAt)
        .orderBy(desc(count()))
        .limit(10),

      // Cadastrou e sumiu: nunca deu sinal, ou último sinal há mais de 30 dias
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

    const registered = totals[0]?.n ?? 0;
    const active = activeNow[0]?.n ?? 0;
    const prevActive = activePrev[0]?.n ?? 0;
    const novos = newUsers[0]?.n ?? 0;

    return NextResponse.json({
      days,
      registered,
      active,
      activationRate: registered > 0 ? Math.round((active / registered) * 1000) / 10 : 0,
      activeDelta: prevActive > 0 ? Math.round(((active - prevActive) / prevActive) * 1000) / 10 : null,
      newUsers: novos,
      dormant: dormant[0]?.n ?? 0,
      byRole: byRole.map((r) => ({ label: roleLabel(r.role), value: r.n })),
      byEvent: byEvent.map((e) => ({
        label: EVENT_LABELS[e.event as ActivityEvent] ?? e.event,
        value: e.n,
        people: e.people,
      })),
      topSongs: topSongs.map((s) => ({ label: `${s.title} — ${s.artist}`, value: s.n, slug: s.slug })),
      topUsers: topUsers.map((u) => ({
        label: u.name || u.email,
        role: roleLabel(u.role),
        value: u.n,
        lastSeenAt: u.lastSeenAt,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    // Antes da migração a tabela não existe — devolve estado vazio em vez de 500.
    if (/user_activity|last_seen_at/i.test(message)) {
      return NextResponse.json({ pendingMigration: true, error: message }, { status: 200 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
