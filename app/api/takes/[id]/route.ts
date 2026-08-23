/**
 * PATCH  /api/takes/:id — renomear, ajustar o offset, trocar a visibilidade, o
 *                         efeito, ou SUBSTITUIR o arquivo de áudio.
 * DELETE /api/takes/:id — apagar a gravação (banco + objeto no R2).
 *
 * Take não tem "admin pode mexer" como as músicas têm. É gravação pessoal:
 * quem não é o dono não edita nem apaga, ponto. Admin que precise remover
 * conteúdo abusivo faz pelo painel, com registro — não por esta rota.
 *
 * ── Substituir o arquivo (`audioUrl`) ────────────────────────────────────────
 * É o "aplicar os cortes de vez": o navegador renderiza a gravação já sem os
 * trechos cortados, sobe o resultado pelo mesmo presign de sempre e manda a URL
 * para cá. O arquivo ANTIGO é apagado do R2 — de propósito, e é o que torna
 * esta operação irreversível: a partir daqui o corte não é mais configuração,
 * é o áudio. Quem quiser voltar atrás grava de novo.
 *
 * A alternativa (guardar as duas versões) foi descartada porque dobra o storage
 * de gravação por pessoa para preservar um estado que a própria interface
 * apresenta como definitivo.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, userTakes } from "@/src/db";
import { and, eq } from "drizzle-orm";
import { roleCan } from "@/src/lib/permissions";
import { deleteObject, keyFromPublicUrl } from "@/src/lib/r2";
import { sanitizeFx } from "@/src/lib/takeFx";

// Mesmo teto do POST — a convenção de offset vive nos dois lugares, então
// mudar um sem o outro deixaria a UI oferecendo um ajuste que a API recusa.
const MAX_OFFSET_MS = 2000;

// 'public' está fora de propósito. A vitrine de covers exige consentimento
// próprio e separado (a gravação carrega composição de terceiro junto), e esse
// fluxo não existe ainda. Aceitar o valor aqui abriria a porta antes da porta.
const VISIBILIDADES = new Set(["private", "band"]);

/**
 * Carrega o take garantindo que ele é DESTE usuário. O filtro por userId vai
 * no WHERE, não numa comparação depois de ler: assim um id de outra pessoa
 * devolve 404 em vez de 403, e a rota não confirma que aquele take existe.
 */
async function carregarProprio(takeId: number, userId: number) {
  const [take] = await db
    .select()
    .from(userTakes)
    .where(and(eq(userTakes.id, takeId), eq(userTakes.userId, userId)))
    .limit(1);
  return take ?? null;
}

/**
 * Devolve o par (userId, takeId) já validado, ou a resposta de erro pronta.
 * O `instanceof NextResponse` no chamador estreita o tipo — mesma forma usada
 * em /api/takes, e evita o objeto de duas caras que obrigaria a espalhar `!`.
 */
async function guarda(
  params: Promise<{ id: string }>,
): Promise<NextResponse | { userId: number; takeId: number }> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!roleCan(session.user.role, "record_take")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const { id } = await params;
  const takeId = Number(id);
  if (!takeId) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }
  return { userId: Number(session.user.id), takeId };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guarda(params);
  if (g instanceof NextResponse) return g;

  try {
    const take = await carregarProprio(g.takeId, g.userId);
    if (!take) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    const body = (await req.json()) as {
      name?: string;
      offsetMs?: number;
      visibility?: string;
      fx?: unknown;
      /** Novo arquivo já enviado ao R2 — ver o cabeçalho deste arquivo. */
      audioUrl?: string;
      durationSec?: number;
    };

    const patch: Partial<typeof userTakes.$inferInsert> = { updatedAt: new Date() };

    // Guardado antes do UPDATE: depois de trocar a linha não há mais como saber
    // qual objeto do bucket ficou sem dono.
    let urlAntiga: string | null = null;

    if (body.audioUrl !== undefined) {
      const novaUrl = String(body.audioUrl);

      // Mesma conferência do commit em /api/takes: o cliente diz onde o arquivo
      // está, então o servidor exige que seja o NOSSO bucket, na pasta DESTE
      // usuário e DESTA música. Sem isso um cliente adulterado apontaria o take
      // para o arquivo de outra pessoa — ou para um endereço qualquer.
      const base = process.env.R2_PUBLIC_URL ?? "";
      const prefixoEsperado = `${base}/audio/takes/${g.userId}/${take.songId}/`;
      if (!base || !novaUrl.startsWith(prefixoEsperado)) {
        return NextResponse.json({ error: "URL de áudio inválida" }, { status: 400 });
      }
      // Trocar pelo mesmo arquivo não é erro, mas não pode chegar ao apagamento
      // lá embaixo: seria apagar o áudio que acabou de ser gravado na linha.
      if (novaUrl !== take.audioUrl) {
        urlAntiga = take.audioUrl;
        patch.audioUrl = novaUrl;
      }

      const dur = Number(body.durationSec);
      if (Number.isFinite(dur) && dur > 0) patch.durationSec = dur.toFixed(2);
    }

    if (typeof body.name === "string") {
      const nome = body.name.trim().slice(0, 120);
      if (!nome) return NextResponse.json({ error: "Nome vazio" }, { status: 400 });
      patch.name = nome;
    }

    if (body.offsetMs !== undefined) {
      const n = Number(body.offsetMs);
      if (!Number.isFinite(n)) {
        return NextResponse.json({ error: "offsetMs inválido" }, { status: 400 });
      }
      patch.offsetMs = Math.max(-MAX_OFFSET_MS, Math.min(MAX_OFFSET_MS, Math.round(n)));
    }

    // Preset desconhecido não é erro: sanitizeFx devolve "sem efeito". Uma
    // configuração estranha (versão antiga do cliente, preset removido) não
    // pode impedir a pessoa de ouvir a própria gravação.
    if (body.fx !== undefined) patch.fx = sanitizeFx(body.fx);

    if (body.visibility !== undefined) {
      if (!VISIBILIDADES.has(body.visibility)) {
        return NextResponse.json({ error: "Visibilidade inválida" }, { status: 400 });
      }
      patch.visibility = body.visibility;
    }

    const [atualizado] = await db
      .update(userTakes)
      .set(patch)
      .where(and(eq(userTakes.id, g.takeId), eq(userTakes.userId, g.userId)))
      .returning();

    // O arquivo antigo sai do bucket DEPOIS que a linha já aponta para o novo.
    // Na ordem inversa, uma falha no banco deixaria a gravação apontando para um
    // objeto apagado e o player quebraria a cada play.
    if (urlAntiga) {
      const key = keyFromPublicUrl(urlAntiga);
      if (key) {
        try {
          await deleteObject(key);
        } catch (err) {
          console.error("[PATCH /api/takes/:id] objeto órfão no R2:", key, err);
        }
      }
    }

    // Mesma regra do GET /api/takes: a URL pública do R2 não sai do servidor.
    // O `?v=` carrega o updatedAt — é o que faz o player recarregar o áudio
    // quando o arquivo foi substituído mas o caminho continuou igual.
    return NextResponse.json({
      take: {
        ...atualizado,
        audioUrl: `/api/takes/${g.takeId}/audio?v=${atualizado.updatedAt.getTime()}`,
        fx: sanitizeFx(atualizado.fx),
      },
    });
  } catch (err) {
    console.error("[PATCH /api/takes/:id]", err);
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
    const take = await carregarProprio(g.takeId, g.userId);
    if (!take) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

    // A linha sai primeiro. Se o R2 falhar depois, o pior caso é um arquivo
    // órfão no bucket — invisível e barato. Na ordem inversa, uma falha no
    // banco deixaria uma faixa listada apontando para um áudio que não existe
    // mais, e o player quebraria toda vez que a pessoa abrisse a música.
    await db
      .delete(userTakes)
      .where(and(eq(userTakes.id, g.takeId), eq(userTakes.userId, g.userId)));

    const key = keyFromPublicUrl(take.audioUrl);
    if (key) {
      try {
        await deleteObject(key);
      } catch (err) {
        console.error("[DELETE /api/takes/:id] objeto órfão no R2:", key, err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/takes/:id]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
