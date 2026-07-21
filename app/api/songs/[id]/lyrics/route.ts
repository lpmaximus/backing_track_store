/**
 * PATCH /api/songs/:id/lyrics  (caminho 3 — correção colaborativa da letra)
 *
 * Pro/ProBand/admin (ou membro de banda ativa) corrige a letra transcrita.
 * Marca como validada pela comunidade. Espelha /api/songs/:id/chords.
 *
 * Body: { lyrics: LyricsLine[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs } from "@/src/db";
import { eq } from "drizzle-orm";
import { hasProAccess } from "@/src/lib/access";
import type { LyricsLine } from "@/src/db/schema";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!(await hasProAccess(Number(session.user.id), session.user.role))) {
    return NextResponse.json({ error: "Correção de letra é recurso do plano Pro" }, { status: 403 });
  }

  const { id: idParam } = await params;
  const songId = Number(idParam);
  if (!songId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const body = (await req.json()) as { lyrics?: LyricsLine[] };
    if (!Array.isArray(body.lyrics)) {
      return NextResponse.json({ error: "lyrics deve ser uma lista" }, { status: 400 });
    }
    // Sanitiza: mantém só linhas com texto e tempo numérico, ordenadas.
    const clean = body.lyrics
      .filter((l) => l && typeof l.text === "string" && l.text.trim() && Number.isFinite(Number(l.time)))
      .map((l) => ({ time: Number(l.time), text: l.text.trim() }))
      .sort((a, b) => a.time - b.time);

    const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    if (!song) return NextResponse.json({ error: "Música não encontrada" }, { status: 404 });

    const [updated] = await db
      .update(songs)
      .set({ lyrics: clean, lyricsSource: "community", lyricsStatus: "validated", updatedAt: new Date() })
      .where(eq(songs.id, songId))
      .returning();

    return NextResponse.json({
      song: { id: updated.id, lyrics: updated.lyrics, lyricsStatus: updated.lyricsStatus, lyricsSource: updated.lyricsSource },
    });
  } catch (err) {
    console.error("[PATCH /api/songs/:id/lyrics]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
