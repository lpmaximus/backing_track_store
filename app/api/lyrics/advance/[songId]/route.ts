/**
 * GET /api/lyrics/advance/:songId  (caminho 3)
 *
 * Avança o job de transcrição de letra (Whisper no Replicate, por polling).
 * Espelha /api/chords/advance. Chamado pelo poll do client na página da música
 * ou por cron. Idempotente.
 *
 * Auth: sessão logada OU header x-cron-secret === CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs, stems, processingJobs } from "@/src/db";
import { and, eq, desc } from "drizzle-orm";
import { getLyricsProvider } from "@/src/lib/lyrics";
import { isThrottled } from "@/src/lib/replicateSubmit";

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

    const [job] = await db
      .select()
      .from(processingJobs)
      .where(and(eq(processingJobs.songId, songId), eq(processingJobs.stage, "lyrics_detection")))
      .orderBy(desc(processingJobs.id))
      .limit(1);

    // FILA DE SUBMISSÃO. Com saldo < US$5 o Replicate deixa criar 6 predições/min
    // (burst 1). O webhook só registra o job 'pending'; quem submete é este poll,
    // que roda a cada ~5s enquanto a página está aberta. Num 429 o job continua
    // 'pending' e a próxima rodada tenta de novo (sem segurar a função). Também
    // reaproveita job 'failed' que nunca chegou ao provider, se ainda sem letra.
    const noLyrics = !(song.lyrics && song.lyrics.length > 0);
    const neverSubmitted = job && !job.providerJobId && (job.status === "pending" || job.status === "failed");
    if (job && neverSubmitted && noLyrics) {
      const provider = getLyricsProvider();
      const [vocal] = await db.select().from(stems)
        .where(and(eq(stems.songId, songId), eq(stems.instrument, "vocal"))).limit(1);
      if (provider.isConfigured() && vocal) {
        try {
          const { providerJobId } = await provider.submit(vocal.audioUrl, { fast: true });
          await db.update(processingJobs)
            .set({ providerJobId, status: "running", errorMessage: null, completedAt: null })
            .where(eq(processingJobs.id, job.id));
          return NextResponse.json({ lyricsStatus: "generating", lyrics: null, jobStatus: "running" });
        } catch (submitErr) {
          if (isThrottled(submitErr)) {
            // Na fila: espera o Replicate liberar. Renova o createdAt p/ a faxina
            // de órfãos do cron não derrubar quem está legitimamente esperando.
            await db.update(processingJobs)
              .set({ status: "pending", errorMessage: null, completedAt: null, createdAt: new Date() })
              .where(eq(processingJobs.id, job.id));
            return NextResponse.json({ lyricsStatus: "generating", lyrics: null, jobStatus: "running" });
          }
          console.error("[GET /api/lyrics/advance] submit falhou", submitErr);
          await db.update(processingJobs)
            .set({ status: "failed", errorMessage: String(submitErr).slice(0, 500), completedAt: new Date() })
            .where(eq(processingJobs.id, job.id));
        }
      }
    }

    if (!job || !job.providerJobId || job.status === "done" || job.status === "failed") {
      return NextResponse.json({
        lyricsStatus: song.lyricsStatus,
        lyrics: song.lyrics ?? null,
        jobStatus: job?.status ?? "none",
      });
    }

    const provider = getLyricsProvider();
    const result = await provider.poll(job.providerJobId);

    if (result.status === "running") {
      return NextResponse.json({ lyricsStatus: "generating", lyrics: null, jobStatus: "running" });
    }

    if (result.status === "failed") {
      await db
        .update(processingJobs)
        .set({ status: "failed", errorMessage: result.error.slice(0, 500), completedAt: new Date() })
        .where(eq(processingJobs.id, job.id));
      return NextResponse.json({ lyricsStatus: song.lyricsStatus, lyrics: song.lyrics ?? null, jobStatus: "failed" });
    }

    // Sucesso: salva a letra automática (draft), a menos que já exista letra da comunidade.
    if (!(song.lyrics && song.lyrics.length > 0)) {
      await db
        .update(songs)
        .set({ lyrics: result.lines, lyricsSource: "auto", lyricsStatus: "draft" })
        .where(eq(songs.id, songId));
    }
    await db
      .update(processingJobs)
      .set({ status: "done", completedAt: new Date() })
      .where(eq(processingJobs.id, job.id));

    return NextResponse.json({ lyricsStatus: "draft", lyrics: result.lines, jobStatus: "done" });
  } catch (err) {
    console.error("[GET /api/lyrics/advance]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
