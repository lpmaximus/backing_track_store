/**
 * Takes do usuário (overdub) — listar, preparar upload e registrar.
 *
 * GET  /api/takes?songId=123  → os takes DO USUÁRIO LOGADO naquela música
 * POST /api/takes             → dois passos, escolhidos por `step`:
 *        { step: "presign", songId, contentType } → { uploadUrl, publicUrl }
 *        { step: "commit",  songId, publicUrl, name?, durationSec?, offsetMs? }
 *
 * ── Por que o POST tem dois passos ───────────────────────────────────────────
 * O áudio vai do navegador DIRETO para o R2 (presigned PUT), sem passar por
 * aqui. Uma gravação de 4 minutos são dezenas de MB; mandar isso pelo corpo de
 * uma rota serverless queimaria o limite de payload e o tempo de execução à
 * toa. O servidor só assina a permissão e, depois que o arquivo já está lá,
 * registra a linha.
 *
 * ── Isolamento ──────────────────────────────────────────────────────────────
 * TODA consulta filtra por userId. Não existe rota que liste take de música
 * sem dizer de quem — é o que garante o modelo de camadas do CONCEITO-FASE-2:
 * a base é compartilhável, a gravação da pessoa não viaja junto. Se um dia
 * entrar a visibilidade 'band', ela vira uma consulta NOVA e explícita, com
 * checagem de membership; nunca um relaxamento deste filtro.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, userTakes, songs } from "@/src/db";
import { and, eq, desc, sql } from "drizzle-orm";
import { roleCan } from "@/src/lib/permissions";
import { presignPut, sanitizeKey } from "@/src/lib/r2";
import { sanitizeFx } from "@/src/lib/takeFx";

// Formatos que o MediaRecorder produz nos navegadores que suportamos.
// Lista fechada de propósito: o contentType vai direto para o R2 e vira o
// Content-Type servido de volta ao player.
const ALLOWED_AUDIO = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/ogg",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
]);

const MAX_TAKES_POR_MUSICA = 12;

/**
 * Caminho pelo qual o cliente ouve a gravação.
 *
 * A URL pública do R2 fica guardada no banco (é dela que sai a key para
 * assinar e para apagar), mas NUNCA é devolvida ao navegador. Gravação de voz
 * é dado pessoal; entregar link público permanente seria expô-la para sempre a
 * quem obtivesse o endereço. Ver app/api/takes/[id]/audio/route.ts.
 */
function urlDeAudio(takeId: number): string {
  return `/api/takes/${takeId}/audio`;
}

/**
 * Extensão real do arquivo, extraída da URL guardada no banco.
 *
 * Vai junto porque o caminho servido ao cliente termina em `/audio` e não diz
 * o formato. Sem isso, o download da faixa separada salvaria um `.webm` com
 * nome `.mp3` — o arquivo abre em player nenhum e a pessoa acha que corrompeu.
 */
function extensaoDaUrl(url: string): string {
  const m = url.split("?")[0].match(/\.([a-z0-9]{2,4})$/i);
  return m ? m[1].toLowerCase() : "webm";
}
// ±2s cobre com folga a latência de qualquer navegador/interface. Um valor
// muito além disso não é compensação, é o usuário arrastando o take para outro
// lugar da música — e aí o take fica dessincronizado sem explicação.
const MAX_OFFSET_MS = 2000;

function extensaoDe(contentType: string): string {
  if (contentType.startsWith("audio/webm")) return "webm";
  if (contentType.startsWith("audio/ogg")) return "ogg";
  if (contentType.startsWith("audio/mp4")) return "m4a";
  if (contentType === "audio/mpeg") return "mp3";
  if (contentType === "audio/wav") return "wav";
  return "bin";
}

/**
 * Sessão + capacidade do tier numa checagem só. Devolve o userId, ou a própria
 * resposta de erro — o `instanceof` no chamador faz o TypeScript estreitar o
 * tipo sozinho, sem objeto de duas caras.
 */
async function exigirStudio(): Promise<NextResponse | number> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  if (!roleCan(session.user.role, "record_take")) {
    return NextResponse.json(
      { error: "Gravar faixa própria é do plano Studio" },
      { status: 403 },
    );
  }
  return Number(session.user.id);
}

export async function GET(req: NextRequest) {
  const guard = await exigirStudio();
  if (guard instanceof NextResponse) return guard;
  const userId = guard;

  const songId = Number(req.nextUrl.searchParams.get("songId"));
  if (!songId) {
    return NextResponse.json({ error: "songId obrigatório" }, { status: 400 });
  }

  try {
    const rows = await db
      .select({
        id: userTakes.id,
        name: userTakes.name,
        audioUrl: userTakes.audioUrl,
        durationSec: userTakes.durationSec,
        offsetMs: userTakes.offsetMs,
        visibility: userTakes.visibility,
        fx: userTakes.fx,
        createdAt: userTakes.createdAt,
      })
      .from(userTakes)
      .where(and(eq(userTakes.userId, userId), eq(userTakes.songId, songId)))
      .orderBy(desc(userTakes.createdAt));

    return NextResponse.json({
      takes: rows.map(r => ({
        ...r,
        audioUrl: urlDeAudio(r.id),
        ext: extensaoDaUrl(r.audioUrl),
        // Normaliza aqui para o cliente nunca receber null nem valor estranho
        // de uma linha antiga — a UI trabalha sempre com o objeto completo.
        fx: sanitizeFx(r.fx),
      })),
    });
  } catch (err) {
    console.error("[GET /api/takes]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const guard = await exigirStudio();
  if (guard instanceof NextResponse) return guard;
  const userId = guard;

  try {
    const body = (await req.json()) as {
      step?: string;
      songId?: number;
      contentType?: string;
      publicUrl?: string;
      name?: string;
      durationSec?: number;
      offsetMs?: number;
    };

    const songId = Number(body.songId);
    if (!songId) {
      return NextResponse.json({ error: "songId obrigatório" }, { status: 400 });
    }

    const [song] = await db
      .select({ id: songs.id })
      .from(songs)
      .where(eq(songs.id, songId))
      .limit(1);
    if (!song) {
      return NextResponse.json({ error: "Música não encontrada" }, { status: 404 });
    }

    // O teto vale nos DOIS passos. Só no commit deixaria o usuário gravar,
    // esperar o upload terminar e só então ouvir "não cabe" — o trabalho já
    // teria sido feito e o objeto já estaria no bucket.
    const [contagem] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(userTakes)
      .where(and(eq(userTakes.userId, userId), eq(userTakes.songId, songId)));

    if ((contagem?.n ?? 0) >= MAX_TAKES_POR_MUSICA) {
      return NextResponse.json(
        { error: `Máximo de ${MAX_TAKES_POR_MUSICA} gravações por música` },
        { status: 409 },
      );
    }

    // ── Passo 1: assinar o upload ───────────────────────────────────────────
    if (body.step === "presign") {
      const contentType = body.contentType ?? "";
      if (!ALLOWED_AUDIO.has(contentType)) {
        return NextResponse.json(
          { error: "Formato de áudio não suportado" },
          { status: 400 },
        );
      }

      // O sufixo aleatório NÃO é enfeite. O bucket do R2 é público (é assim que
      // o player carrega stem sem assinar cada requisição), então quem souber a
      // URL ouve o arquivo. Com `userId/songId/timestamp` a chave seria
      // adivinhável por força bruta — e aqui estamos falando da gravação de voz
      // de uma pessoa, não de um stem instrumental.
      //
      // Isto reduz o risco, não o elimina: quem receber a URL continua tendo
      // acesso. A proteção de verdade é servir take por URL assinada de curta
      // duração. Ver a pendência anotada no EVT-004.
      const sufixo = crypto.randomUUID().slice(0, 12);
      const key = sanitizeKey(
        `audio/takes/${userId}/${songId}/${Date.now()}-${sufixo}.${extensaoDe(contentType)}`,
      );
      if (!key) {
        return NextResponse.json({ error: "Key inválida" }, { status: 400 });
      }

      const { uploadUrl, publicUrl } = await presignPut(key, contentType);
      return NextResponse.json({ uploadUrl, publicUrl });
    }

    // ── Passo 2: registrar o take já enviado ────────────────────────────────
    if (body.step === "commit") {
      const publicUrl = body.publicUrl ?? "";

      // O cliente diz onde o arquivo está, então o servidor confere que a URL
      // é do NOSSO bucket e que está dentro da pasta deste usuário. Sem isso,
      // um cliente adulterado registraria um take apontando para o arquivo de
      // outra pessoa — ou para um endereço qualquer da internet.
      const base = process.env.R2_PUBLIC_URL ?? "";
      const prefixoEsperado = `${base}/audio/takes/${userId}/${songId}/`;
      if (!base || !publicUrl.startsWith(prefixoEsperado)) {
        return NextResponse.json({ error: "URL de áudio inválida" }, { status: 400 });
      }

      const nome = (body.name ?? "").trim().slice(0, 120) || "Minha gravação";
      const offsetMs = Math.max(
        -MAX_OFFSET_MS,
        Math.min(MAX_OFFSET_MS, Math.round(Number(body.offsetMs) || 0)),
      );
      const dur = Number(body.durationSec);

      const [criado] = await db
        .insert(userTakes)
        .values({
          songId,
          userId,
          name: nome,
          audioUrl: publicUrl,
          durationSec: Number.isFinite(dur) && dur > 0 ? dur.toFixed(2) : null,
          offsetMs,
        })
        .returning();

      return NextResponse.json(
        {
          take: {
            ...criado,
            audioUrl: urlDeAudio(criado.id),
            ext: extensaoDaUrl(criado.audioUrl),
            fx: sanitizeFx(criado.fx),
          },
        },
        { status: 201 },
      );
    }

    return NextResponse.json({ error: "step inválido" }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/takes]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
