/**
 * GET /api/lyrics/advance/:songId  (caminho 3)
 *
 * Avança o job de transcrição de letra (Whisper no Replicate, por polling).
 * Espelha /api/chords/advance. Chamado pelo poll do client na página da música
 * ou por cron. Idempotente.
 *
 * Submissão, poll e retry de erro transitório vivem em src/lib/jobs/queue.ts.
 * O caso que motivou isso: "Prediction interrupted; please retry (code: PA)" —
 * falha de infra do Replicate — marcava o job `failed` para sempre.
 *
 * Auth: sessão logada OU header x-cron-secret === CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs, processingJobs } from "@/src/db";
import { and, eq, desc } from "drizzle-orm";
import { getLyricsProvider } from "@/src/lib/lyrics";
import { pollJob, submitJob } from "@/src/lib/jobs/queue";

export async function GET(req: NextRequest, { params }: { params: Promise<{ songId: string }> }) {
  const session = await auth();
  const cronOk = req.headers.get("x-cron-secret") && req.headers.get("x-cron-secret") === process.env.CRON_SECRET;
  if (!session?.user && !cronOk) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { songId: songIdParam } = await params;
  const songId = Number(songIdParam);
  if (!songId) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    if (!song) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

    // Já tem letra validada? Nada a fazer.
    if (song.lyrics && song.lyrics.length > 0 && song.lyricsStatus !== "draft") {
      return NextResponse.json({ lyricsStatus: song.lyricsStatus, lyrics: song.lyrics, jobStatus: "done" });
    }

    let [job] = await db
      .select()
      .from(processingJobs)
      .where(and(eq(processingJobs.songId, songId), eq(processingJobs.stage, "lyrics_detection")))
      .orderBy(desc(processingJobs.id))
      .limit(1);

    // FILA DE SUBMISSÃO. O job nasce `pending` (webhook/backfill) ou volta p/
    // `pending` num retry; este poll (a cada ~5s com a página aberta) submete.
    // Num 429 o job continua na fila e a próxima rodada tenta de novo.
    if (job && job.status === "pending" && !job.providerJobId && getLyricsProvider().isConfigured()) {
      await submitJob(job);
      [job] = await db.select().from(processingJobs).where(eq(processingJobs.id, job.id)).limit(1);
    }

    if (job && (job.status === "pending" || (job.status === "running" && !job.providerJobId))) {
      return NextResponse.json({ lyricsStatus: "generating", lyrics: null, jobStatus: "running" });
    }

    if (!job || !job.providerJobId || job.status === "done" || job.status === "failed") {
      return NextResponse.json({
        lyricsStatus: song.lyricsStatus,
        lyrics: song.lyrics ?? null,
        jobStatus: job?.status ?? "none",
      });
    }

    const outcome = await pollJob(job, song);
    if (outcome === "running" || outcome === "retry") {
      return NextResponse.json({ lyricsStatus: "generating", lyrics: null, jobStatus: "running" });
    }
    if (outcome === "failed") {
      return NextResponse.json({ lyricsStatus: song.lyricsStatus, lyrics: song.lyrics ?? null, jobStatus: "failed" });
    }

    const [fresh] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    return NextResponse.json({ lyricsStatus: fresh?.lyricsStatus ?? "draft", lyrics: fresh?.lyrics ?? null, jobStatus: "done" });
  } catch (err) {
    console.error("[GET /api/lyrics/advance]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
