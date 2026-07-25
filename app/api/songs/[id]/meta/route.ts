/**
 * PATCH /api/songs/:id/meta  — corrige TOM e/ou BPM (detecção automática é rascunho).
 * Mesmo gate da correção de cifra (Pro/admin/banda ativa; no beta, todo logado).
 * Body: { key?: string; bpm?: number }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs } from "@/src/db";
import { eq } from "drizzle-orm";
import { hasProAccess } from "@/src/lib/access";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!(await hasProAccess(Number(session.user.id), session.user.role))) {
    return NextResponse.json({ error: "Correção é recurso do plano Pro" }, { status: 403 });
  }

  const { id: idParam } = await params;
  const songId = Number(idParam);
  if (!songId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const body = (await req.json()) as { key?: string; bpm?: number };
  const patch: { key?: string; bpm?: number } = {};
  if (typeof body.key === "string" && body.key.trim()) patch.key = body.key.trim().slice(0, 10);
  if (body.bpm !== undefined) {
    const n = Math.round(Number(body.bpm));
    if (Number.isFinite(n) && n > 0 && n < 400) patch.bpm = n;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  try {
    const [updated] = await db.update(songs).set(patch).where(eq(songs.id, songId)).returning();
    if (!updated) return NextResponse.json({ error: "Música não encontrada" }, { status: 404 });
    return NextResponse.json({ ok: true, key: updated.key, bpm: updated.bpm });
  } catch (err) {
    console.error("[PATCH /api/songs/:id/meta]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
