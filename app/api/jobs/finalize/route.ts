/**
 * GET /api/jobs/finalize   (cron / gatilho externo)
 *
 * WORKER da fila de jobs de CIFRA e LETRA. Cada chamada faz uma passada
 * completa (src/lib/jobs/queue.ts → runQueue):
 *   1. devolve à fila reservas abandonadas (função que morreu no meio do submit);
 *   2. trata predições que nunca responderam como falha transitória;
 *   3. fecha os jobs `running` (poll no Replicate) — com retry automático de
 *      erro transitório (ex.: "Prediction interrupted; please retry");
 *   4. submete os jobs `pending` até acabar o orçamento ou o Replicate pedir
 *      calma (429).
 * Depois faz a faxina de retenção do mix (EVT 5.1, ver src/lib/retention.ts).
 *
 * Por que isto escala: o poll da página só roda com a aba aberta; aqui ninguém
 * precisa estar olhando. Chame a cada poucos minutos (o cron da Vercel Hobby só
 * permite 1x/dia — por isso existe também .github/workflows/jobs-queue.yml, que
 * chama este endpoint a cada 5 min).
 *
 * Idempotente e seguro para rodar em paralelo (reserva atômica no submit).
 *
 * Auth: Authorization: Bearer <CRON_SECRET>  (mesmo padrão do purge).
 */
import { NextRequest, NextResponse } from "next/server";
import { db, songs } from "@/src/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { runQueue } from "@/src/lib/jobs/queue";
import { purgeSourceMix } from "@/src/lib/retention";

export const maxDuration = 60;

// Quantas músicas varrer por execução na faxina do mix.
const PURGE_SCAN = 50;

function isCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization") === `Bearer ${secret}`;
  const legacy = req.headers.get("x-cron-secret") === secret;
  return bearer || legacy;
}

export async function GET(req: NextRequest) {
  if (!isCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const queue = await runQueue({ budgetMs: 45_000 });

    // Retenção adiada do mix: varre uploads prontos que ainda guardam o mix.
    // purgeSourceMix é idempotente e se recusa a apagar enquanto a cifra roda.
    let mixesPurged = 0;
    const pendingPurge = await db
      .select({ id: songs.id })
      .from(songs)
      .where(and(eq(songs.sourceType, "user_upload"), eq(songs.processingStatus, "ready"), isNotNull(songs.audioUrl)))
      .limit(PURGE_SCAN);
    for (const { id } of pendingPurge) {
      if (await purgeSourceMix(id)) mixesPurged++;
    }

    return NextResponse.json({ ok: true, ...queue, mixesPurged });
  } catch (err) {
    console.error("[GET /api/jobs/finalize]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
