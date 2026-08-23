/**
 * GET /api/takes/:id/audio — entrega o áudio da gravação do usuário.
 *
 * É a ÚNICA porta para o áudio de um take. A URL pública do R2 nunca sai do
 * servidor: as rotas de listagem devolvem este caminho no lugar dela.
 *
 * ── Por que uma rota, e não o link direto ────────────────────────────────────
 * O bucket é público — é assim que o player carrega stem sem assinar cada
 * requisição. Para stem instrumental tudo bem: é derivado da música e não
 * identifica ninguém. Gravação de voz é dado pessoal, e a nossa própria
 * política de privacidade a trata assim. Link público permanente significaria
 * que quem obtivesse a URL, de qualquer maneira, ouviria para sempre.
 *
 * Aqui a sessão é conferida a cada pedido e o que devolvemos é um link assinado
 * que expira em uma hora.
 *
 * ── O que isto NÃO resolve ──────────────────────────────────────────────────
 * Quem receber o link assinado dentro da hora ouve o arquivo. A troca é
 * "exposto para sempre a quem descobrir a URL" por "exposto por uma hora a quem
 * já tinha sessão". É uma melhora grande, não um cofre.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, userTakes } from "@/src/db";
import { and, eq } from "drizzle-orm";
import { presignGet, keyFromPublicUrl } from "@/src/lib/r2";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const takeId = Number(id);
  if (!takeId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  try {
    // O dono entra no WHERE, não numa comparação depois de ler: id de outra
    // pessoa devolve 404, e a rota não confirma sequer que aquele take existe.
    const [take] = await db
      .select({ audioUrl: userTakes.audioUrl })
      .from(userTakes)
      .where(
        and(eq(userTakes.id, takeId), eq(userTakes.userId, Number(session.user.id))),
      )
      .limit(1);

    if (!take) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const key = keyFromPublicUrl(take.audioUrl);
    if (!key) {
      console.error("[GET /api/takes/:id/audio] URL fora do bucket:", take.audioUrl);
      return NextResponse.json({ error: "Áudio indisponível" }, { status: 500 });
    }

    const url = await presignGet(key);

    // Redirect em vez de repassar os bytes: o áudio vai do R2 direto para o
    // navegador, sem atravessar a função serverless. Uma gravação de quatro
    // minutos são vários MB, e servir isso por aqui gastaria banda e tempo de
    // execução a cada play.
    //
    // ⚠️ Se o áudio falhar com erro de CORS, a causa é esta: o link assinado
    // aponta para o endpoint S3 do R2, que é um host diferente do domínio
    // público do bucket. A correção é liberar a origem do site na política de
    // CORS do bucket.
    return NextResponse.redirect(url, {
      status: 307,
      // Cache só no navegador de quem pediu, e por menos tempo que a validade
      // do link — senão o browser guardaria uma URL já expirada e o play
      // quebraria depois de uma hora de página aberta.
      headers: { "Cache-Control": "private, max-age=1800" },
    });
  } catch (err) {
    console.error("[GET /api/takes/:id/audio]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
