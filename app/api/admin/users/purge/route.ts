/**
 * POST /api/admin/users/purge  (R3 / ADR-BTS-003)
 * Apaga definitivamente as contas cuja janela de retenção de 30 dias venceu
 * (deletion_scheduled_at <= agora). Hard delete LGPD — o cascade do schema
 * remove dados vinculados (setlists, uploads, membros de banda, etc.).
 *
 * Disparo: manual pelo admin (header x-admin-password) OU por cron
 * (Authorization: Bearer <CRON_SECRET>). Configurar um cron diário na Vercel
 * apontando para esta rota.
 */
import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/src/db";
import { and, isNotNull, lte } from "drizzle-orm";
import { isAdminRequest } from "@/src/lib/adminAuth";

function isCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}

async function runPurge(req: NextRequest) {
  if (!isAdminRequest(req) && !isCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const deleted = await db
      .delete(users)
      .where(and(isNotNull(users.deletionScheduledAt), lte(users.deletionScheduledAt, new Date())))
      .returning({ id: users.id });

    return NextResponse.json({ ok: true, purged: deleted.length, ids: deleted.map((d) => d.id) });
  } catch (err) {
    console.error("[purge] ", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

// POST: disparo manual pelo admin (header x-admin-password).
export async function POST(req: NextRequest) {
  return runPurge(req);
}

// GET: disparo pelo Vercel Cron (injeta Authorization: Bearer <CRON_SECRET>).
export async function GET(req: NextRequest) {
  return runPurge(req);
}
