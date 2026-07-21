/**
 * PATCH /api/songs/:id/chords  (Fase 1.5, Frente D — correção colaborativa)
 *
 * Pro/admin (ou membro de banda ativa) sugere/corrige a cifra. Grava snapshot
 * do estado anterior em cifra_edit_history antes de sobrescrever, e marca a
 * cifra como validada pela comunidade.
 *
 * Body: { chords?: ChordSection[], cifraText?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs, cifraEditHistory } from "@/src/db";
import { eq } from "drizzle-orm";
import { hasProAccess } from "@/src/lib/access";
import type { ChordSection } from "@/src/db/schema";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!(await hasProAccess(Number(session.user.id), session.user.role))) {
    return NextResponse.json({ error: "Correção de cifra é recurso do plano Pro" }, { status: 403 });
  }

  const { id: idParam } = await params;
  const songId = Number(idParam);
  if (!songId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const body = (await req.json()) as { chords?: ChordSection[]; cifraText?: string | null };
    if (body.chords === undefined && body.cifraText === undefined) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
    }
    if (body.chords !== undefined && !Array.isArray(body.chords)) {
      return NextResponse.json({ error: "chords deve ser uma lista" }, { status: 400 });
    }

    const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    if (!song) return NextResponse.json({ error: "Música não encontrada" }, { status: 404 });

    const newChords = body.chords !== undefined ? body.chords : song.chords;
    const newCifraText = body.cifraText !== undefined ? (body.cifraText?.trim() || null) : song.cifraText;

    // Snapshot do estado anterior (para reverter na moderação).
    await db.insert(cifraEditHistory).values({
      songId,
      userId: Number(session.user.id),
      previousChords: song.chords ?? null,
      newChords: newChords ?? null,
      previousCifraText: song.cifraText ?? null,
      newCifraText: newCifraText ?? null,
    });

    const [updated] = await db
      .update(songs)
      .set({
        chords: newChords ?? null,
        cifraText: newCifraText,
        chordsSource: "community",
        chordsStatus: "validated",
        updatedAt: new Date(),
      })
      .where(eq(songs.id, songId))
      .returning();

    return NextResponse.json({
      song: { id: updated.id, chords: updated.chords, cifraText: updated.cifraText, chordsStatus: updated.chordsStatus, chordsSource: updated.chordsSource },
    });
  } catch (err) {
    console.error("[PATCH /api/songs/:id/chords]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
