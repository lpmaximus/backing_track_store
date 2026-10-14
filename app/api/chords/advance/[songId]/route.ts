/**
 * GET /api/chords/advance/:songId  (Fase 1.5, Frente C)
 *
 * Avança o job de detecção de cifra (por polling no provider). Chamado pelo poll
 * do client na página da música OU por cron. Idempotente: se o job já terminou,
 * só devolve o estado atual.
 *
 * Toda a lógica de submit / poll / retry vive em src/lib/jobs/queue.ts (a mesma
 * usada pelo webhook, pelo cron finalize e pelo backfill): um erro transitório
 * do provider devolve o job à fila em vez de matá-lo.
 *
 * Auth: sessão logada OU header x-cron-secret === CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs, processingJobs } from "@/src/db";
import { and, eq, desc } from "drizzle-orm";
import { pollJob, submitJob } from "@/src/lib/jobs/queue";
import { getChordProvider } from "@/src/lib/chords";

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

    // Já tem cifra pronta? Nada a fazer.
    if (song.chords && song.chords.length > 0 && song.chordsStatus !== "draft") {
      return NextResponse.json({ chordsStatus: song.chordsStatus, chords: song.chords, jobStatus: "done" });
    }

    let [job] = await db
      .select()
      .from(processingJobs)
      .where(and(eq(processingJobs.songId, songId), eq(processingJobs.stage, "chord_detection")))
      .orderBy(desc(processingJobs.id))
      .limit(1);

    // Job na fila (nasceu pending ou voltou de um retry): este poll submete.
    if (job && job.status === "pending" && !job.providerJobId && getChordProvider().isConfigured()) {
      await submitJob(job);
      [job] = await db.select().from(processingJobs).where(eq(processingJobs.id, job.id)).limit(1);
    }

    if (job && job.status === "pending") {
      // Ainda na fila (429 do Replicate ou retry agendado).
      return NextResponse.json({ chordsStatus: "generating", chords: null, jobStatus: "running" });
    }

    if (!job || !job.providerJobId || job.status === "done" || job.status === "failed") {
      return NextResponse.json({
        chordsStatus: song.chordsStatus,
        chords: song.chords ?? null,
        jobStatus: job?.status ?? "none",
      });
    }

    const outcome = await pollJob(job, song);
    if (outcome === "running" || outcome === "retry") {
      return NextResponse.json({ chordsStatus: "generating", chords: null, jobStatus: "running" });
    }
    if (outcome === "failed") {
      return NextResponse.json({ chordsStatus: song.chordsStatus, chords: song.chords ?? null, jobStatus: "failed" });
    }

    // done: devolve o que ficou salvo.
    const [fresh] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
    return NextResponse.json({ chordsStatus: fresh?.chordsStatus ?? "draft", chords: fresh?.chords ?? null, jobStatus: "done" });
  } catch (err) {
    console.error("[GET /api/chords/advance]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
