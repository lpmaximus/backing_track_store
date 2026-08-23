/**
 * PATCH  /api/estudio/:id — renomear a versão e/ou ligar e desligar faixas.
 * DELETE /api/estudio/:id — devolver: tira a música da sua área.
 *
 * `:id` é o id da VERSÃO (user_songs.id), não o da música. E o dono entra no
 * WHERE de toda consulta — id de outra pessoa devolve 404, sem confirmar que
 * aquela versão existe.
 *
 * ⚠️ Nenhuma rota daqui escreve em `songs` — com UMA exceção, criada junto com
 * os projetos de estúdio: quando a "música" é um projeto em branco
 * (`songs.source_type = 'studio_project'`), ela não é acervo de ninguém, é o
 * próprio trabalho da pessoa. Aí devolver não faz sentido — o DELETE apaga o
 * projeto inteiro. Para música do catálogo nada mudou: renomear muda o nome NA
 * SUA versão e o título original continua igual para todo mundo.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, userSongs, songs, stems, userTakes } from "@/src/db";
import { and, eq } from "drizzle-orm";
import { roleCan } from "@/src/lib/permissions";
import { sanitizeTrackCuts } from "@/src/lib/cuts";
import { deleteObject, keyFromPublicUrl } from "@/src/lib/r2";

async function guarda(
  params: Promise<{ id: string }>,
): Promise<NextResponse | { userId: number; versaoId: number }> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!roleCan(session.user.role, "copy_song")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const { id } = await params;
  const versaoId = Number(id);
  if (!versaoId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  return { userId: Number(session.user.id), versaoId };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guarda(params);
  if (g instanceof NextResponse) return g;

  try {
    const [versao] = await db
      .select()
      .from(userSongs)
      .where(and(eq(userSongs.id, g.versaoId), eq(userSongs.userId, g.userId)))
      .limit(1);
    if (!versao) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

    const body = (await req.json()) as {
      title?: string | null;
      disabledStems?: string[];
      trackCuts?: unknown;
    };

    const patch: Partial<typeof userSongs.$inferInsert> = { updatedAt: new Date() };

    if (body.title !== undefined) {
      const limpo = (body.title ?? "").trim().slice(0, 255);
      // Nome vazio volta a null, e a versão passa a seguir o título do
      // catálogo de novo — é o jeito de "desfazer o rename" sem um botão só
      // para isso.
      patch.title = limpo || null;
    }

    if (body.disabledStems !== undefined) {
      if (!Array.isArray(body.disabledStems)) {
        return NextResponse.json({ error: "disabledStems inválido" }, { status: 400 });
      }

      // Só aceita instrumentos que a música REALMENTE tem. Sem esta checagem a
      // lista viraria depósito de lixo com o tempo (nomes digitados errado,
      // stems que sumiram), e ninguém perceberia porque desligar algo
      // inexistente não quebra nada visível.
      const doBanco = await db
        .select({ instrument: stems.instrument })
        .from(stems)
        .where(eq(stems.songId, versao.songId));
      const validos = new Set(doBanco.map(s => s.instrument));

      patch.disabledStems = [...new Set(body.disabledStems)]
        .filter(s => typeof s === "string" && validos.has(s));

      // Desligar tudo deixaria a pessoa com uma versão muda e sem pista do
      // motivo. Pelo menos uma faixa fica de pé.
      if (patch.disabledStems.length >= validos.size && validos.size > 0) {
        return NextResponse.json(
          { error: "Pelo menos uma faixa precisa ficar ligada" },
          { status: 400 },
        );
      }
    }

    if (body.trackCuts !== undefined) {
      // As chaves aceitas são exatamente as faixas que existem para ESTA pessoa
      // nesta música: os stems da música e as gravações dela. Sem esse filtro a
      // coluna acumularia corte em faixa que não existe mais — invisível, porque
      // corte em faixa inexistente não faz barulho nenhum, e eterno, porque
      // ninguém teria como apagar.
      const [instrumentos, takesDoUsuario] = await Promise.all([
        db.select({ instrument: stems.instrument }).from(stems).where(eq(stems.songId, versao.songId)),
        db
          .select({ id: userTakes.id })
          .from(userTakes)
          .where(and(eq(userTakes.songId, versao.songId), eq(userTakes.userId, g.userId))),
      ]);

      const chaves = new Set<string>([
        ...instrumentos.map(s => s.instrument),
        ...takesDoUsuario.map(t => `take:${t.id}`),
        // Música sem stems toca pelo mix completo, e essa faixa se chama "mix"
        // no player. Cortar nela é o caso mais comum de quem ainda não separou.
        "mix",
      ]);

      // Sem teto vindo de `songs.duration` de propósito: é metadado, às vezes
      // zerado (projeto em branco, upload ainda processando) ou arredondado, e
      // validar contra ele apagaria corte legítimo de quem tem o áudio certo.
      // O teto de sanidade vive em src/lib/cuts.ts.
      patch.trackCuts = sanitizeTrackCuts(body.trackCuts, chaves);
    }

    const [atualizada] = await db
      .update(userSongs)
      .set(patch)
      .where(and(eq(userSongs.id, g.versaoId), eq(userSongs.userId, g.userId)))
      .returning();

    const [song] = await db
      .select({ title: songs.title })
      .from(songs)
      .where(eq(songs.id, versao.songId))
      .limit(1);

    return NextResponse.json({
      version: { ...atualizada, title: atualizada.title ?? song?.title ?? "" },
    });
  } catch (err) {
    console.error("[PATCH /api/estudio/:id]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guarda(params);
  if (g instanceof NextResponse) return g;

  try {
    const [versao] = await db
      .select({ songId: userSongs.songId })
      .from(userSongs)
      .where(and(eq(userSongs.id, g.versaoId), eq(userSongs.userId, g.userId)))
      .limit(1);
    if (!versao) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

    const [musica] = await db
      .select({ sourceType: songs.sourceType, uploadedByUserId: songs.uploadedByUserId })
      .from(songs)
      .where(eq(songs.id, versao.songId))
      .limit(1);

    const ehProjetoDoUsuario =
      musica?.sourceType === "studio_project" && musica.uploadedByUserId === g.userId;

    // ── Projeto de estúdio: apagar é apagar ──────────────────────────────────
    // Não existe catálogo por trás para "devolver". A linha em `songs` é o
    // próprio projeto, e deixá-la órfã (sem a versão que a lista) tornaria o
    // projeto invisível e impossível de apagar depois. As gravações e a versão
    // saem junto pelo ON DELETE CASCADE de user_takes/user_songs.
    if (ehProjetoDoUsuario) {
      const takesDoProjeto = await db
        .select({ audioUrl: userTakes.audioUrl })
        .from(userTakes)
        .where(eq(userTakes.songId, versao.songId));

      await db.delete(songs).where(eq(songs.id, versao.songId));

      // O banco primeiro, o bucket depois: uma falha aqui deixa arquivo órfão
      // no R2 (invisível e barato), enquanto a ordem inversa deixaria faixa
      // listada apontando para áudio que não existe mais.
      for (const t of takesDoProjeto) {
        const key = keyFromPublicUrl(t.audioUrl);
        if (!key) continue;
        try {
          await deleteObject(key);
        } catch (err) {
          console.error("[DELETE /api/estudio/:id] objeto órfão no R2:", key, err);
        }
      }

      return NextResponse.json({ ok: true, deletedSong: true });
    }

    // ── Música do catálogo: devolver apaga SÓ a folha de configuração ────────
    // As gravações continuam onde estavam (user_takes é chaveado por música,
    // não por versão) e a música segue intacta para todo mundo. Se a pessoa
    // pegar de novo, reencontra os takes — e os cortes, esses sim, se perdem
    // junto com a configuração, que é o que "devolver" quer dizer.
    await db
      .delete(userSongs)
      .where(and(eq(userSongs.id, g.versaoId), eq(userSongs.userId, g.userId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/estudio/:id]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
