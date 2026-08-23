/**
 * GET /api/jobs/finalize   (cron)
 *
 * Finaliza jobs assíncronos de CIFRA e LETRA que ficaram em `running`. Diferente
 * do poll do client (que só roda enquanto a página da música está aberta, ~3,5
 * min, e só para usuário logado), este endpoint é chamado por um cron da Vercel
 * e "fecha" os jobs mesmo com ninguém na página — era o buraco que fazia
 * cifra/letra nunca aparecerem se o provider demorasse ou a aba fechasse.
 *
 * Também faz duas faxinas que antes não tinham dono:
 *   • jobs ÓRFÃOS em `pending` — o job nasce pending e vira running depois do
 *     submit; se a função serverless morresse no meio, ele ficava pending pra
 *     sempre (o finalize varria só `running` e o backfill só reprocessa `failed`).
 *   • MIX de upload esperando a retenção — a exclusão do mix passou a ser
 *     adiada até a cifra terminar (ver src/lib/retention.ts).
 *
 * Espelha a lógica de /api/chords/advance e /api/lyrics/advance, mas em lote.
 * Idempotente: só toca jobs `running` com providerJobId; se já terminaram, ignora.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>  (mesmo padrão do purge).
 */
import { NextRequest, NextResponse } from "next/server";
import { db, songs, processingJobs } from "@/src/db";
import { and, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { getChordProvider } from "@/src/lib/chords";
import { getLyricsProvider } from "@/src/lib/lyrics";
import { purgeSourceMix } from "@/src/lib/retention";
import type { ChordMeta } from "@/src/lib/chords/types";

// Quantos jobs processar por execução (evita estourar o tempo da função).
const BATCH = 25;
// Quanto tempo um job pode ficar em `pending` antes de ser considerado órfão.
const PENDING_TIMEOUT_MS = 15 * 60 * 1000;
// Quantas músicas varrer por execução na faxina do mix.
const PURGE_SCAN = 50;

function isCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const bearer = req.headers.get("authorization") === `Bearer ${secret}`;
  const legacy = req.headers.get("x-cron-secret") === secret;
  return bearer || legacy;
}

/** Campos de bpm/tom/batidas a gravar, quando o detector devolveu algum. */
function metaPatch(m: ChordMeta | undefined) {
  return {
    ...(m?.bpm ? { bpm: m.bpm } : {}),
    ...(m?.key ? { key: m.key } : {}),
    ...(m?.beats?.length ? { beats: m.beats } : {}),
  };
}

export async function GET(req: NextRequest) {
  if (!isCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const summary = {
    checked: 0,
    chordsDone: 0,
    lyricsDone: 0,
    failed: 0,
    stillRunning: 0,
    metaSaved: 0,
    orphansReleased: 0,
    mixesPurged: 0,
  };

  try {
    // ── Faxina 1: jobs órfãos em `pending` sem providerJobId ────────────────
    // Marcar como `failed` é o que devolve a música para o backfill, que só
    // reprocessa jobs falhos. Antes eles ficavam invisíveis para os dois lados.
    const orphanCutoff = new Date(Date.now() - PENDING_TIMEOUT_MS);
    const orphans = await db
      .update(processingJobs)
      .set({
        status: "failed",
        errorMessage: "Job órfão: submissão não completou (liberado p/ retry)",
        completedAt: new Date(),
      })
      .where(
        and(
          eq(processingJobs.status, "pending"),
          isNull(processingJobs.providerJobId),
          inArray(processingJobs.stage, ["chord_detection", "lyrics_detection"]),
          lt(processingJobs.createdAt, orphanCutoff),
        ),
      )
      .returning({ id: processingJobs.id });
    summary.orphansReleased = orphans.length;

    // ── Fecha os jobs em andamento ──────────────────────────────────────────
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
    const touchedSongs = new Set<number>();

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

          touchedSongs.add(song.id);

          if (result.status === "failed") {
            // BPM, tom e batidas saem da MESMA execução do detector e não
            // dependem de a cifra ter saído. Antes eram descartados junto com a
            // cifra — é a origem de "Tom ?" e "BPM 0" nas músicas que falharam.
            const patch = metaPatch(result.meta);
            if (Object.keys(patch).length > 0) {
              await db.update(songs).set(patch).where(eq(songs.id, song.id));
              summary.metaSaved++;
            }
            await db
              .update(processingJobs)
              .set({ status: "failed", errorMessage: result.error.slice(0, 500), completedAt: new Date() })
              .where(eq(processingJobs.id, job.id));
            summary.failed++;
            continue;
          }

          // done — salva cifra automática (draft) + bpm/tom/batidas.
          const setChords = !(song.chords && song.chords.length > 0);
          const patch = metaPatch(result.meta);
          if (setChords || Object.keys(patch).length > 0) {
            await db.update(songs).set({
              ...(setChords ? { chords: result.sections, chordsSource: "auto" as const, chordsStatus: "draft" as const } : {}),
              ...patch,
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

    // ── Faxina 2: retenção adiada do mix ───────────────────────────────────
    // Toda música cujo job de cifra acabou de fechar, mais uma varredura das que
    // ficaram para trás (webhook que não criou job, deploy no meio do caminho…).
    // purgeSourceMix é idempotente e se recusa a apagar enquanto a cifra roda.
    const pendingPurge = await db
      .select({ id: songs.id })
      .from(songs)
      .where(
        and(
          eq(songs.sourceType, "user_upload"),
          eq(songs.processingStatus, "ready"),
          isNotNull(songs.audioUrl),
        ),
      )
      .limit(PURGE_SCAN);
    for (const id of new Set([...touchedSongs, ...pendingPurge.map((s) => s.id)])) {
      if (await purgeSourceMix(id)) summary.mixesPurged++;
    }

    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[GET /api/jobs/finalize]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
