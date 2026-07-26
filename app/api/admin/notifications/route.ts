/**
 * /api/admin/notifications  (Área do Usuário — envio manual de avisos)
 *
 * GET:  histórico dos últimos avisos (agrupado — um broadcast vira 1 linha por
 *       destinatário na tabela, aqui juntamos de volta pra exibir no admin).
 * POST: dispara um aviso (title/body/link/type) para todos, por role, ou para
 *       um usuário específico (email). Complementa os gatilhos automáticos de
 *       src/lib/notifications.ts (música pronta, pagamento, banda) — este é o
 *       único caminho para avisos que NÃO nascem de um evento do sistema
 *       (ex.: promoção).
 */
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/src/lib/adminAuth";
import { db, users, notifications } from "@/src/db";
import { and, desc, eq, sql } from "drizzle-orm";

type Audience = "all" | "role" | "user";
const VALID_ROLES = new Set(["free", "pro", "proband", "admin"]);
const VALID_TYPES = new Set(["system", "promo", "band"]);

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    // Um broadcast gera N linhas (1 por destinatário) com o mesmo createdAt —
    // agrupar por esses campos reconstrói o envio original com a contagem.
    const rows = await db
      .select({
        title: notifications.title,
        body: notifications.body,
        link: notifications.link,
        type: notifications.type,
        createdAt: notifications.createdAt,
        recipients: sql<number>`count(*)`.mapWith(Number),
      })
      .from(notifications)
      .groupBy(notifications.title, notifications.body, notifications.link, notifications.type, notifications.createdAt)
      .orderBy(desc(notifications.createdAt))
      .limit(30);

    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error("[GET /api/admin/notifications]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const data = await req.json() as {
      audience?: Audience;
      role?: string;
      email?: string;
      type?: string;
      title?: string;
      body?: string;
      link?: string;
    };

    const title = (data.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 });

    const type = VALID_TYPES.has(data.type ?? "") ? data.type! : "system";
    const audience = data.audience ?? "all";

    let targetIds: number[] = [];

    if (audience === "all") {
      const rows = await db.select({ id: users.id }).from(users).where(eq(users.status, "active"));
      targetIds = rows.map((r) => r.id);
    } else if (audience === "role") {
      if (!data.role || !VALID_ROLES.has(data.role)) {
        return NextResponse.json({ error: "Role inválida" }, { status: 400 });
      }
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.status, "active"), eq(users.role, data.role)));
      targetIds = rows.map((r) => r.id);
    } else if (audience === "user") {
      const email = (data.email ?? "").trim();
      if (!email) return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 });
      const [target] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (!target) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });
      targetIds = [target.id];
    } else {
      return NextResponse.json({ error: "Audiência inválida" }, { status: 400 });
    }

    if (targetIds.length === 0) {
      return NextResponse.json({ error: "Nenhum destinatário encontrado para essa seleção" }, { status: 404 });
    }

    // Mesmo createdAt em todas as linhas do lote — é o que permite reagrupar
    // esse broadcast no GET acima.
    const sentAt = new Date();
    await db.insert(notifications).values(
      targetIds.map((userId) => ({
        userId,
        type,
        title,
        body: data.body?.trim() || null,
        link: data.link?.trim() || null,
        createdAt: sentAt,
      })),
    );

    return NextResponse.json({ ok: true, recipients: targetIds.length });
  } catch (err) {
    console.error("[POST /api/admin/notifications]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
