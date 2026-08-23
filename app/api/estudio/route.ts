/**
 * "Minha versão" de músicas do catálogo — a área do BTS-Studio.
 *
 * GET  /api/estudio            → as versões do usuário logado
 * GET  /api/estudio?songId=123 → só a daquela música (ou null)
 * POST /api/estudio            → pega a música para a sua área
 *
 * ── O que "pegar" significa aqui ────────────────────────────────────────────
 * Nenhum áudio é copiado. O R2 continua com um arquivo por stem; a versão é
 * uma folha de configuração pessoal por cima da mesma base. Copiar de verdade
 * multiplicaria o storage por usuário para entregar exatamente o mesmo som — e
 * storage já é o gargalo de custo do produto.
 *
 * ── A garantia que sustenta o desenho ───────────────────────────────────────
 * NENHUMA rota deste arquivo escreve em `songs`. Renomear ou tirar faixa mexe
 * só na linha de `user_songs` de quem pediu. A música do catálogo não muda
 * para mais ninguém — e é assim que precisa continuar.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, userSongs, songs } from "@/src/db";
import { and, eq, desc } from "drizzle-orm";
import { roleCan } from "@/src/lib/permissions";

async function exigirStudio(): Promise<NextResponse | number> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!roleCan(session.user.role, "copy_song")) {
    return NextResponse.json(
      { error: "Pegar música para a sua área é do plano Studio" },
      { status: 403 },
    );
  }
  return Number(session.user.id);
}

export async function GET(req: NextRequest) {
  const guard = await exigirStudio();
  if (guard instanceof NextResponse) return guard;
  const userId = guard;

  const songIdParam = Number(req.nextUrl.searchParams.get("songId"));

  try {
    const base = db
      .select({
        id: userSongs.id,
        songId: userSongs.songId,
        // O título da versão cai no da música quando a pessoa não renomeou —
        // resolvido aqui e não no cliente, para que toda tela mostre o mesmo.
        title: userSongs.title,
        disabledStems: userSongs.disabledStems,
        // Trechos silenciados por faixa nesta versão — ver src/lib/cuts.ts.
        trackCuts: userSongs.trackCuts,
        createdAt: userSongs.createdAt,
        songTitle: songs.title,
        songArtist: songs.artist,
        songSlug: songs.slug,
        songThumbnailUrl: songs.thumbnailUrl,
        songDuration: songs.duration,
        // 'studio_project' = música em branco criada aqui dentro, sem vínculo
        // com áudio nenhum do catálogo. A lista do estúdio separa as duas
        // coisas, e "devolver" significa coisas diferentes em cada uma.
        songSourceType: songs.sourceType,
      })
      .from(userSongs)
      .innerJoin(songs, eq(userSongs.songId, songs.id));

    const rows = songIdParam
      ? await base
          .where(and(eq(userSongs.userId, userId), eq(userSongs.songId, songIdParam)))
          .limit(1)
      : await base.where(eq(userSongs.userId, userId)).orderBy(desc(userSongs.createdAt));

    const versoes = rows.map(r => ({ ...r, title: r.title ?? r.songTitle }));

    return songIdParam
      ? NextResponse.json({ version: versoes[0] ?? null })
      : NextResponse.json({ versions: versoes });
  } catch (err) {
    console.error("[GET /api/estudio]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await exigirStudio();
  if (guard instanceof NextResponse) return guard;
  const userId = guard;

  try {
    const { songId } = (await req.json()) as { songId?: number };
    const id = Number(songId);
    if (!id) return NextResponse.json({ error: "songId obrigatório" }, { status: 400 });

    const [song] = await db
      .select({ id: songs.id, title: songs.title })
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);
    if (!song) {
      return NextResponse.json({ error: "Música não encontrada" }, { status: 404 });
    }

    // Pegar de novo devolve a versão que já existe em vez de erro: do ponto de
    // vista de quem clica, "pegar" é um estado (tenho / não tenho), não uma
    // operação que possa falhar por repetição. O índice único garante o resto.
    const [existente] = await db
      .select()
      .from(userSongs)
      .where(and(eq(userSongs.userId, userId), eq(userSongs.songId, id)))
      .limit(1);

    if (existente) {
      return NextResponse.json({
        version: { ...existente, title: existente.title ?? song.title },
      });
    }

    const [criada] = await db
      .insert(userSongs)
      .values({ userId, songId: id, disabledStems: [] })
      .returning();

    return NextResponse.json(
      { version: { ...criada, title: criada.title ?? song.title } },
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /api/estudio]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
