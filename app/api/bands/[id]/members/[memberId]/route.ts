/**
 * /api/bands/:id/members/:memberId  (Fase 1.5, Frente E)
 *   PATCH  → líder define/edita o instrumento do membro. Body: { instrument }
 *   DELETE → líder remove o membro (não pode remover a si mesmo/líder).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, bands, bandMembers } from "@/src/db";
import { and, eq } from "drizzle-orm";

async function assertLeader(bandId: number, userId: number) {
  const [band] = await db.select().from(bands).where(eq(bands.id, bandId)).limit(1);
  if (!band) return "notfound" as const;
  if (band.leaderUserId !== userId) return "forbidden" as const;
  return band;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id, memberId } = await params;
  const bandId = Number(id);
  const mId = Number(memberId);
  if (!bandId || !mId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const guard = await assertLeader(bandId, Number(session.user.id));
    if (guard === "notfound") return NextResponse.json({ error: "Banda não encontrada" }, { status: 404 });
    if (guard === "forbidden") return NextResponse.json({ error: "Só o líder pode editar" }, { status: 403 });

    const { instrument } = (await req.json()) as { instrument?: string };
    const [updated] = await db
      .update(bandMembers)
      .set({ instrument: instrument?.trim() || null })
      .where(and(eq(bandMembers.id, mId), eq(bandMembers.bandId, bandId)))
      .returning();
    if (!updated) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });

    return NextResponse.json({ member: updated });
  } catch (err) {
    console.error("[PATCH /api/bands/:id/members/:memberId]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; memberId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id, memberId } = await params;
  const bandId = Number(id);
  const mId = Number(memberId);
  if (!bandId || !mId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const guard = await assertLeader(bandId, Number(session.user.id));
    if (guard === "notfound") return NextResponse.json({ error: "Banda não encontrada" }, { status: 404 });
    if (guard === "forbidden") return NextResponse.json({ error: "Só o líder pode remover" }, { status: 403 });

    const [member] = await db.select().from(bandMembers).where(and(eq(bandMembers.id, mId), eq(bandMembers.bandId, bandId))).limit(1);
    if (!member) return NextResponse.json({ error: "Membro não encontrado" }, { status: 404 });
    if (member.userId === guard.leaderUserId) {
      return NextResponse.json({ error: "O líder não pode ser removido" }, { status: 400 });
    }

    await db.delete(bandMembers).where(eq(bandMembers.id, mId));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/bands/:id/members/:memberId]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
