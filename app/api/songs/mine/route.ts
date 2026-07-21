/**
 * GET /api/songs/mine  (Fase 1.5)
 *
 * Lista as músicas enviadas pelo próprio usuário logado (uploadedByUserId),
 * independente de `published` — músicas de user_upload nunca entram no
 * catálogo público, então esse é o único jeito de o usuário "ver" o que
 * já converteu. Usado pela página /perfil e pelo seletor de músicas da setlist.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs } from "@/src/db";
import { eq, desc } from "drizzle-orm";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const userId = Number(session.user.id);

  try {
    const result = await db
      .select({
        id: songs.id,
        slug: songs.slug,
        title: songs.title,
        artist: songs.artist,
        genre: songs.genre,
        key: songs.key,
        bpm: songs.bpm,
        duration: songs.duration,
        thumbnailUrl: songs.thumbnailUrl,
        processingStatus: songs.processingStatus,
        shared: songs.shared,
        createdAt: songs.createdAt,
      })
      .from(songs)
      .where(eq(songs.uploadedByUserId, userId))
      .orderBy(desc(songs.createdAt));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/songs/mine]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
