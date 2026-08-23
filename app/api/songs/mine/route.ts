/**
 * GET /api/songs/mine  (Fase 1.5)
 *
 * Lista as músicas enviadas pelo próprio usuário logado (uploadedByUserId),
 * independente de `published` — músicas de user_upload nunca entram no
 * catálogo público, então esse é o único jeito de o usuário "ver" o que
 * já converteu. Usado pela página /perfil e pelo seletor de músicas da setlist.
 *
 * NÃO lista projetos de estúdio (`source_type = 'studio_project'`): eles também
 * têm linha em `songs` e também são do usuário, mas são trabalho em andamento,
 * não música convertida. O lugar deles é o Meu Estúdio — misturar os dois faria
 * "Minhas Músicas" e o seletor da setlist encherem de rascunho vazio.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs } from "@/src/db";
import { and, eq, ne, desc } from "drizzle-orm";

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
      .where(
        and(
          eq(songs.uploadedByUserId, userId),
          ne(songs.sourceType, "studio_project"),
        ),
      )
      .orderBy(desc(songs.createdAt));

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/songs/mine]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
