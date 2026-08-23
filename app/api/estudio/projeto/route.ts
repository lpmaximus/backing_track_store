/**
 * POST /api/estudio/projeto — cria uma música NOVA, em branco.
 *
 * Sem vínculo com nada: nenhum áudio existente, nenhum stem, nenhum arquivo de
 * origem. O que nasce é uma linha do tempo vazia à espera de faixas, e as
 * faixas são as gravações do usuário (`user_takes`) — pelo microfone ou por
 * arquivo. É o caminho de quem quer montar a própria base do zero em vez de
 * partir de uma música pronta.
 *
 * ── Por que reusa `songs` em vez de uma tabela de projeto ────────────────────
 * Porque tudo que o projeto precisa já existe pendurado em `songs`: o player
 * multipista, a mesa com M/S e volume, a gravação por cima, os cortes por
 * faixa, a cifra e o metrônomo. Uma tabela paralela obrigaria a duplicar cada
 * um desses caminhos — e a primeira divergência entre as duas cópias seria um
 * bug que só aparece num dos dois lugares.
 *
 * O que separa um projeto de uma música do acervo é o `source_type`:
 *   · published = false     → nunca aparece no catálogo
 *   · shared = false        → não entra no acervo compartilhado entre Pros
 *   · source_type = 'studio_project' → excluído de "Minhas Músicas" (que lista
 *     uploads) e barrado na página da música para quem não é o dono
 *
 * ⚠️ Quem for escrever uma listagem nova de `songs` precisa decidir de propósito
 * se projetos entram. O padrão seguro é NÃO entrarem: eles são trabalho
 * privado, não acervo.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs, userSongs } from "@/src/db";
import { and, eq, sql } from "drizzle-orm";
import { roleCan } from "@/src/lib/permissions";
import { normalizeGenre } from "@/src/lib/genres";

/**
 * Teto por pessoa. Não é custo de storage (projeto vazio não ocupa áudio
 * nenhum): é para que um cliente em laço não encha a tabela `songs` — que é a
 * mesma tabela do catálogo — com linhas fantasma.
 */
const MAX_PROJETOS = 50;

const BPM_MIN = 30;
const BPM_MAX = 300;

/** Slug legível + sufixo aleatório, porque dois projetos podem ter o mesmo nome. */
function slugDoProjeto(titulo: string): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const sufixo = crypto.randomUUID().slice(0, 8);
  return `projeto-${base || "sem-nome"}-${sufixo}`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  // Mesma capacidade de "pegar música para a sua área": o projeto vive na
  // mesma prateleira e usa o mesmo player. Gravar dentro dele ainda passa por
  // `record_take` na rota de takes.
  if (!roleCan(session.user.role, "copy_song")) {
    return NextResponse.json(
      { error: "Criar música nova é do plano Studio" },
      { status: 403 },
    );
  }

  const userId = Number(session.user.id);

  try {
    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      artist?: string;
      genre?: string;
      key?: string;
      bpm?: number;
    };

    const [contagem] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(songs)
      .where(
        and(eq(songs.uploadedByUserId, userId), eq(songs.sourceType, "studio_project")),
      );

    if ((contagem?.n ?? 0) >= MAX_PROJETOS) {
      return NextResponse.json(
        { error: `Máximo de ${MAX_PROJETOS} projetos. Apague um que não use mais.` },
        { status: 409 },
      );
    }

    const titulo = (body.title ?? "").trim().slice(0, 255) || "Música nova";
    // O "artista" de um projeto é quem está criando. Campo obrigatório em
    // `songs`, e deixar em branco faria a música aparecer sem autor nas telas
    // que mostram "título — artista".
    const artista =
      (body.artist ?? "").trim().slice(0, 255) || session.user.name?.trim().slice(0, 255) || "Eu";

    const bpmBruto = Number(body.bpm);
    const bpm = Number.isFinite(bpmBruto)
      ? Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(bpmBruto)))
      : 100;

    const tom = (body.key ?? "").trim().slice(0, 10) || "C";

    const [musica] = await db
      .insert(songs)
      .values({
        slug: slugDoProjeto(titulo),
        title: titulo,
        artist: artista,
        genre: normalizeGenre(body.genre),
        key: tom,
        bpm,
        duration: 0,
        // Sem áudio de origem: a linha do tempo nasce vazia e passa a existir
        // quando a primeira faixa é gravada ou enviada.
        audioUrl: null,
        published: false,
        shared: false,
        sourceType: "studio_project",
        uploadedByUserId: userId,
        // Nada a processar: não há mix para separar em stems.
        processingStatus: "ready",
        moderationStatus: "approved",
      })
      .returning();

    // O projeto já nasce "pego": ele existe PARA aparecer no Meu Estúdio, e uma
    // linha em `songs` sem a versão que a lista seria um projeto invisível.
    const [versao] = await db
      .insert(userSongs)
      .values({ userId, songId: musica.id, disabledStems: [], trackCuts: {} })
      .returning();

    return NextResponse.json(
      {
        song: { id: musica.id, slug: musica.slug, title: musica.title, artist: musica.artist },
        version: { ...versao, title: versao.title ?? musica.title },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[POST /api/estudio/projeto]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
