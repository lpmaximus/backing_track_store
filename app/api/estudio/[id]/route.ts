/**
 * PATCH  /api/estudio/:id — renomear a versão e/ou ligar e desligar faixas.
 * DELETE /api/estudio/:id — devolver: tira a música da sua área.
 *
 * `:id` é o id da VERSÃO (user_songs.id), não o da música. E o dono entra no
 * WHERE de toda consulta — id de outra pessoa devolve 404, sem confirmar que
 * aquela versão existe.
 *
 * ⚠️ Nenhuma rota daqui escreve em `songs`. Renomear muda o nome NA SUA
 * versão; a música do catálogo continua com o título original para todo mundo.
 * Se algum dia isso mudar, deixa de ser "minha versão" e vira edição do acervo
 * compartilhado — outra decisão, com outra régua de permissão.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, userSongs, songs, stems } from "@/src/db";
import { and, eq } from "drizzle-orm";
import { roleCan } from "@/src/lib/permissions";

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
    // Devolver apaga SÓ a folha de configuração. As gravações continuam onde
    // estavam (user_takes é chaveado por música, não por versão) e a música do
    // catálogo segue intacta. Se a pessoa pegar de novo, reencontra os takes.
    await db
      .delete(userSongs)
      .where(and(eq(userSongs.id, g.versaoId), eq(userSongs.userId, g.userId)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/estudio/:id]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
