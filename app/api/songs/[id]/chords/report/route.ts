/**
 * POST /api/songs/:id/chords/report  (Fase 1.5, Frente D)
 * Qualquer usuário logado pode reportar uma cifra como errada.
 * Body: { reason?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs, cifraReports } from "@/src/db";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id: idParam } = await params;
  const songId = Number(idParam);
  if (!songId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const { reason } = (await req.json().catch(() => ({}))) as { reason?: string };

    const [song] = await db.select({ id: songs.id }).from(songs).where(eq(songs.id, songId)).limit(1);
    if (!song) return NextResponse.json({ error: "Música não encontrada" }, { status: 404 });

    const userId = Number(session.user.id);
    // Evita report duplicado aberto do mesmo usuário para a mesma música.
    const [existing] = await db
      .select({ id: cifraReports.id })
      .from(cifraReports)
      .where(and(eq(cifraReports.songId, songId), eq(cifraReports.reportedByUserId, userId), eq(cifraReports.status, "open")))
      .limit(1);
    if (existing) return NextResponse.json({ ok: true, alreadyReported: true });

    await db.insert(cifraReports).values({
      songId,
      reportedByUserId: userId,
      reason: reason?.trim()?.slice(0, 500) || null,
      status: "open",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/songs/:id/chords/report]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
