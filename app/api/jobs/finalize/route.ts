/**
 * GET /api/jobs/finalize   (cron)
 *
 * Finaliza jobs assíncronos de CIFRA (Music.ai) e LETRA (Whisper/Replicate)
 * que ficaram em `running`. Diferente do poll do client (que só roda enquanto a
 * página da música está aberta ~3,5 min), este endpoint é chamado por um cron da
 * Vercel e "fecha" os jobs mesmo com ninguém na página — que era o buraco que
 * fazia cifra/letra nunca aparecerem se o provider demorasse ou a aba fechasse.
 *
 * Espelha a lógica de /api/chords/advance e /api/lyrics/advance, mas em lote.
 * Idempotente: só toca jobs `running` com providerJobId; se já terminaram, ignora.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>  (mesmo padrão do purge).
 */
import { NextRequest, NextResponse } from "next/server";
import { db, songs, processingJobs } from "@/src/db";
import { and, eq, inArray } from "drizzle-orm";
import { getChordProvider } from "@/src/lib/chords";
import { getLyricsProvider } from "@/src/lib/lyrics";

// Quantos jobs processar por execução (evita estourar o tempo da função).
const BATCH = 25;

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

  const summary = { checked: 0, chordsDone: 0, lyricsDone: 0, failed: 0, stillRunning: 0 };

  try {
    const jobs = await db
      .select()
      .from(processingJobs)
      .where(
        and(
          eq(processingJobs.status, "running"),
          inArray(processingJobs.stage, ["chord_detection", "lyrics_detection"]),
        ),
      )
      .limit(BATCH);

    const chordProvider = getChordProvider();
    const lyricsProvider = getLyricsProvider();

    for (const job of jobs) {
      if (!job.providerJobId) continue;
      summary.checked++;

      const [song] = await db.select().from(songs).where(eq(songs.id, job.songId)).limit(1);
      if (!song) {
        await db
          .update(processingJobs)
          .set({ status: "failed", errorMessage: "Música não encontrada", completedAt: new Date() })
          .where(eq(processingJobs.id, job.id));
        summary.failed++;
        continue;
      }

      try {
        if (job.stage === "chord_detection") {
          const result = await chordProvider.poll(job.providerJobId);
          if (result.status === "running") { summary.stillRunning++; continue; }
          if (result.status === "failed") {
            await db
              .update(processingJobs)
              .set({ status: "failed", errorMessage: result.error.slice(0, 500), completedAt: new Date() })
              .where(eq(processingJobs.id, job.id));
            summary.failed++;
            continue;
          }
          // done — salva cifra automática (draft) + bpm/tom/batidas (quando vierem).
          const setChords = !(song.chords && song.chords.length > 0);
          const m = result.meta;
          if (setChords || m?.bpm || m?.key || m?.beats) {
            await db.update(songs).set({
              ...(setChords ? { chords: result.sections, chordsSource: "auto" as const, chordsStatus: "draft" as const } : {}),
              ...(m?.bpm ? { bpm: m.bpm } : {}),
              ...(m?.key ? { key: m.key } : {}),
              ...(m?.beats ? { beats: m.beats } : {}),
            }).where(eq(songs.id, song.id));
          }
          await db
            .update(processingJobs)
            .set({ status: "done", completedAt: new Date() })
            .where(eq(processingJobs.id, job.id));
          summary.chordsDone++;
        } else {
          // lyrics_detection
          const result = await lyricsProvider.poll(job.providerJobId);
          if (result.status === "running") { summary.stillRunning++; continue; }
          if (result.status === "failed") {
            await db
              .update(processingJobs)
              .set({ status: "failed", errorMessage: result.error.slice(0, 500), completedAt: new Date() })
              .where(eq(processingJobs.id, job.id));
            summary.failed++;
            continue;
          }
          // done — salva letra automática (draft) a menos que já exista letra da comunidade.
          if (!(song.lyrics && song.lyrics.length > 0)) {
            await db
              .update(songs)
              .set({ lyrics: result.lines, lyricsSource: "auto", lyricsStatus: "draft" })
              .where(eq(songs.id, song.id));
          }
          await db
            .update(processingJobs)
            .set({ status: "done", completedAt: new Date() })
            .where(eq(processingJobs.id, job.id));
          summary.lyricsDone++;
        }
      } catch (pollErr) {
        // Erro transitório de rede/provider: deixa em running para a próxima passada.
        console.error(`[jobs/finalize] poll job#${job.id} (${job.stage})`, pollErr);
        summary.stillRunning++;
      }
    }

    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[GET /api/jobs/finalize]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
