/**
 * /api/admin/users  (R3 / ADR-BTS-003)
 *   GET   → lista usuários (plano, papel, status, uso do mês, assinatura).
 *   PATCH → ações: setRole | setStatus | scheduleDeletion | cancelDeletion |
 *           resetPassword | resendCharge.
 *
 * Decisões (2026-07-18): "Cobrar" = só reenviar link Asaas + trocar plano
 * manual (sem cobrança avulsa nova); exclusão = hard delete com retenção de
 * 30 dias (agenda aqui; purga em /api/admin/users/purge).
 */
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db, users, subscriptions, processingJobs, songs, bandMembers } from "@/src/db";
import { and, eq, gte, ne, sql, desc, inArray } from "drizzle-orm";
import { isAdminRequest } from "@/src/lib/adminAuth";
import { getSubscriptionPaymentLink } from "@/src/lib/asaas";
import { monthlyLimitForRole } from "@/src/lib/quota";

const VALID_ROLES = ["free", "pro", "proband", "admin"];
const VALID_STATUS = ["active", "blocked", "banned"];
const RETENTION_DAYS = 30;

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
        role: users.role,
        status: users.status,
        blockReason: users.blockReason,
        deletionScheduledAt: users.deletionScheduledAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    // Uso do mês (separações) por usuário.
    const usage = await db
      .select({ userId: songs.uploadedByUserId, n: sql<number>`count(${processingJobs.id})::int` })
      .from(processingJobs)
      .innerJoin(songs, eq(processingJobs.songId, songs.id))
      .where(and(eq(processingJobs.stage, "separation"), ne(processingJobs.status, "failed"), gte(processingJobs.createdAt, startOfMonth())))
      .groupBy(songs.uploadedByUserId);
    const usageMap = new Map(usage.map((u) => [u.userId, u.n]));

    // Assinatura mais recente por usuário.
    const subs = await db
      .select({ userId: subscriptions.userId, status: subscriptions.status, createdAt: subscriptions.createdAt })
      .from(subscriptions)
      .orderBy(desc(subscriptions.createdAt));
    const subMap = new Map<number, string>();
    for (const s of subs) if (!subMap.has(s.userId)) subMap.set(s.userId, s.status);

    // Bandas ativas por usuário (para exibir vínculo).
    const memberships = await db
      .select({ userId: bandMembers.userId })
      .from(bandMembers)
      .where(eq(bandMembers.status, "active"));
    const bandCount = new Map<number, number>();
    for (const m of memberships) if (m.userId != null) bandCount.set(m.userId, (bandCount.get(m.userId) ?? 0) + 1);

    const list = rows.map((u) => ({
      ...u,
      usedThisMonth: usageMap.get(u.id) ?? 0,
      monthlyLimit: monthlyLimitForRole(u.role),
      subscriptionStatus: subMap.get(u.id) ?? null,
      activeBands: bandCount.get(u.id) ?? 0,
    }));

    return NextResponse.json({ users: list });
  } catch (err) {
    console.error("[GET /api/admin/users]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = (await req.json()) as { userId?: number; action?: string; role?: string; status?: string; reason?: string };
    const userId = Number(body.userId);
    if (!userId || !body.action) return NextResponse.json({ error: "userId e action obrigatórios" }, { status: 400 });

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

    switch (body.action) {
      case "setRole": {
        if (!body.role || !VALID_ROLES.includes(body.role)) return NextResponse.json({ error: "Papel inválido" }, { status: 400 });
        await db.update(users).set({ role: body.role, updatedAt: new Date() }).where(eq(users.id, userId));
        return NextResponse.json({ ok: true, role: body.role });
      }
      case "setStatus": {
        if (!body.status || !VALID_STATUS.includes(body.status)) return NextResponse.json({ error: "Status inválido" }, { status: 400 });
        await db
          .update(users)
          .set({ status: body.status, blockReason: body.status === "active" ? null : (body.reason?.trim() || null), updatedAt: new Date() })
          .where(eq(users.id, userId));
        return NextResponse.json({ ok: true, status: body.status });
      }
      case "scheduleDeletion": {
        const when = new Date(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
        await db.update(users).set({ deletionScheduledAt: when, updatedAt: new Date() }).where(eq(users.id, userId));
        return NextResponse.json({ ok: true, deletionScheduledAt: when, retentionDays: RETENTION_DAYS });
      }
      case "cancelDeletion": {
        await db.update(users).set({ deletionScheduledAt: null, updatedAt: new Date() }).where(eq(users.id, userId));
        return NextResponse.json({ ok: true });
      }
      case "resetPassword": {
        // Gera senha temporária, salva o hash e devolve o texto UMA vez ao admin.
        const temp = randomBytes(6).toString("base64url");
        const hash = await bcrypt.hash(temp, 10);
        await db.update(users).set({ passwordHash: hash, updatedAt: new Date() }).where(eq(users.id, userId));
        return NextResponse.json({ ok: true, tempPassword: temp });
      }
      case "resendCharge": {
        const [sub] = await db
          .select({ asaasSubscriptionId: subscriptions.asaasSubscriptionId })
          .from(subscriptions)
          .where(and(eq(subscriptions.userId, userId), inArray(subscriptions.status, ["active", "trialing", "past_due", "unpaid"])))
          .orderBy(desc(subscriptions.createdAt))
          .limit(1);
        if (!sub?.asaasSubscriptionId) return NextResponse.json({ error: "Sem assinatura Asaas para cobrar" }, { status: 404 });
        const link = await getSubscriptionPaymentLink(sub.asaasSubscriptionId);
        if (!link) return NextResponse.json({ error: "Não foi possível obter o link de cobrança" }, { status: 502 });
        return NextResponse.json({ ok: true, paymentLink: link });
      }
      default:
        return NextResponse.json({ error: "Ação desconhecida" }, { status: 400 });
    }
  } catch (err) {
    console.error("[PATCH /api/admin/users]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
