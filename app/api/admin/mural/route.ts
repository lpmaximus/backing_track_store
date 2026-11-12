/**
 * /api/admin/mural — moderação do mural da home.
 *
 *   GET  → recados pendentes + últimos aprovados/recusados.
 *   POST → { id, action: "approve" | "reject" | "delete" }
 *
 * Mesma auth dos módulos R3: senha admin no header x-admin-password.
 * Aprovado aparece na home em até 2 min (cache de src/lib/community.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { db, wallPosts, users } from "@/src/db";
import { isAdminRequest } from "@/src/lib/adminAuth";

export const dynamic = "force-dynamic";

const cols = {
  id: wallPosts.id,
  name: wallPosts.name,
  country: wallPosts.country,
  city: wallPosts.city,
  content: wallPosts.content,
  locale: wallPosts.locale,
  status: wallPosts.status,
  createdAt: wallPosts.createdAt,
  moderatedAt: wallPosts.moderatedAt,
  userEmail: users.email,
};

export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const pending = await db
      .select(cols)
      .from(wallPosts)
      .leftJoin(users, eq(wallPosts.userId, users.id))
      .where(eq(wallPosts.status, "pending"))
      .orderBy(desc(wallPosts.createdAt))
      .limit(100);
    const done = await db
      .select(cols)
      .from(wallPosts)
      .leftJoin(users, eq(wallPosts.userId, users.id))
      .where(inArray(wallPosts.status, ["approved", "rejected"]))
      .orderBy(desc(wallPosts.moderatedAt))
      .limit(50);
    const iso = (r: (typeof pending)[number]) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      moderatedAt: r.moderatedAt ? r.moderatedAt.toISOString() : null,
    });
    return NextResponse.json({ pending: pending.map(iso), done: done.map(iso) });
  } catch (err) {
    console.error("[GET /api/admin/mural]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const { id, action } = (await req.json()) as { id?: number; action?: string };
    if (!id || !["approve", "reject", "delete"].includes(action ?? "")) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
    }
    if (action === "delete") {
      await db.delete(wallPosts).where(eq(wallPosts.id, id));
    } else {
      await db
        .update(wallPosts)
        .set({ status: action === "approve" ? "approved" : "rejected", moderatedAt: new Date() })
        .where(eq(wallPosts.id, id));
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/admin/mural]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
