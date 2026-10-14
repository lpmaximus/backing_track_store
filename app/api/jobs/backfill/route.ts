/**
 * POST /api/jobs/backfill   (admin / cron)
 *
 * ENFILEIRA os jobs de CIFRA e LETRA para músicas que ainda precisam deles
 * (separadas antes do pipeline automático, ou cujo job falhou) e submete até
 * `max` por chamada; o resto é submetido pelo worker /api/jobs/finalize. O webhook de separação só dispara cifra/letra em
 * separações novas; as músicas antigas ficaram sem job nenhum e, por isso, nunca
 * preenchem sozinhas. Este endpoint varre as músicas já prontas (`ready`) que
 * ainda não têm cifra/letra nem job criado e submete os jobs sobre os stems já
 * persistidos (harmonia p/ cifra, vocal p/ letra) — mesma lógica do webhook.
 *
 * Depois de rodar isto, o cron /api/jobs/finalize (ou o poll da página) fecha os
 * jobs e a cifra/letra aparecem.
 *
 * Idempotente: pula qualquer música que já tenha cifra/letra ou job existente.
 *
 * Auth: header x-admin-password === ADMIN_PASSWORD  OU  Authorization: Bearer <CRON_SECRET>.
 * Query opcional: ?limit=50 (padrão 50, máx 200).
 */
import { NextRequest, NextResponse } from "next/server";
import { db, songs, stems, processingJobs } from "@/src/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { enqueueJob, submitJob, type JobStage } from "@/src/lib/jobs/queue";
import { isPermanent, PERM_PREFIX } from "@/src/lib/jobs/retry";
import { isAdminRequest } from "@/src/lib/adminAuth";
import { getChordProvider } from "@/src/lib/chords";
import { pickChordAudio } from "@/src/lib/chords/source";
import { getLyricsProvider } from "@/src/lib/lyrics";

// Até 20 submits com pausa de 1,2 s — folga além do limite padrão do Hobby.
export const maxDuration = 60;

function isCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`;
}

async function runBackfill(req: NextRequest) {
  if (!isAdminRequest(req) && !isCron(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 200);
  // refreshMeta: reanalisa músicas que já têm cifra mas ainda não têm batidas
  // (p/ preencher bpm/tom/beats). Não sobrescreve a cifra existente.
  const refreshMeta = url.searchParams.get("refreshMeta") === "true";

  const chordProvider = getChordProvider();
  const lyricsProvider = getLyricsProvider();
  const chordsOn = chordProvider.isConfigured();
  const lyricsOn = lyricsProvider.isConfigured();

  const summary = {
    scanned: 0,
    chordJobsCreated: 0,
    lyricsJobsCreated: 0,
    skipped: 0,
    chordsConfigured: chordsOn,
    lyricsConfigured: lyricsOn,
  };

  if (!chordsOn && !lyricsOn) {
    return NextResponse.json(
      { error: "Nenhum provider configurado (MUSICAI_* / REPLICATE_*)", ...summary },
      { status: 400 },
    );
  }

  try {
    // Músicas já separadas que AINDA precisam de algo — e que ALGUÉM PODE ATENDER.
    //
    // O filtro é feito no SQL, não depois do limit. Antes a janela (`limit`
    // primeiras por id) enchia de músicas que nunca serão atendidas — faixas
    // instrumentais (sem vocal, nunca terão letra), cifra que falhou de forma
    // definitiva, jobs já em andamento — e as músicas novas ficavam fora da
    // janela: "scanned 20, skipped 20" com a #227 esperando. Agora só entra quem:
    //   • falta cifra e não há job ativo/concluído nem falha DEFINITIVA de cifra;
    //   • falta letra, TEM stem de vocal e não há job ativo/concluído nem falha
    //     DEFINITIVA de letra.
    // Falha transitória esgotada (sem marca [perm]) volta a entrar: é o retry
    // de longo prazo. Ver src/lib/jobs/retry.ts.
    const permLike = `${PERM_PREFIX}%`;
    const noBlockingJob = (stage: JobStage) => sql`NOT EXISTS (
      SELECT 1 FROM ${processingJobs} j
      WHERE j.song_id = ${songs.id} AND j.stage = ${stage}
        AND (j.status IN ('pending','running','done')
             OR (j.status = 'failed' AND j.error_message LIKE ${permLike}))
    )`;
    const hasVocal = sql`EXISTS (SELECT 1 FROM ${stems} sv WHERE sv.song_id = ${songs.id} AND sv.instrument = 'vocal')`;
    const missingChords = sql`(${songs.chords} IS NULL OR jsonb_array_length(${songs.chords}) = 0)`;
    const missingLyrics = sql`(${songs.lyrics} IS NULL OR jsonb_array_length(${songs.lyrics}) = 0)`;
    const missingBpm = sql`(${songs.bpm} IS NULL OR ${songs.bpm} <= 0)`;
    const needsChords = sql`(${missingChords} AND ${noBlockingJob("chord_detection")})`;
    const needsLyrics = sql`(${missingLyrics} AND ${hasVocal} AND ${noBlockingJob("lyrics_detection")})`;
    // refreshMeta: reanalisa quem já tem cifra mas não tem BPM (não sobrescreve a cifra).
    const needsAnything = refreshMeta ? sql`(${needsChords} OR ${needsLyrics} OR ${missingBpm})` : sql`(${needsChords} OR ${needsLyrics})`;

    const ready = await db
      .select()
      .from(songs)
      .where(and(eq(songs.processingStatus, "ready"), needsAnything))
      .orderBy(asc(songs.id))
      .limit(limit);
    if (ready.length === 0) return NextResponse.json({ ok: true, ...summary });

    const ids = ready.map((s) => s.id);

    // Stems e jobs existentes dessas músicas, em lote (evita N+1).
    const allStems = await db.select().from(stems).where(inArray(stems.songId, ids));
    const existingJobs = await db
      .select()
      .from(processingJobs)
      .where(and(inArray(processingJobs.songId, ids), inArray(processingJobs.stage, ["chord_detection", "lyrics_detection"])));

    // Bloqueia quem já tem job ativo/concluído OU falha definitiva. Falha
    // transitória esgotada é reprocessada (retry de longo prazo).
    const blocked = (stage: JobStage) =>
      new Set(
        existingJobs
          .filter((j) => j.stage === stage && (j.status !== "failed" || isPermanent(j.errorMessage)))
          .map((j) => j.songId),
      );
    const chordBlocked = blocked("chord_detection");
    const lyricsBlocked = blocked("lyrics_detection");

    // ENFILEIRA tudo que a janela trouxe (inserir `pending` é barato) e submete
    // só até MAX_SUBMITS por chamada, respeitando o burst do Replicate. O resto
    // fica `pending` e é submetido pelo worker (/api/jobs/finalize, a cada 5 min).
    // ?max= sobe o teto (até 20) para o cron diário, com pausa entre submits.
    const MAX_SUBMITS = Math.min(Math.max(Number(url.searchParams.get("max")) || 5, 1), 20);
    let submitted = 0;
    let throttled = false;
    const pause = () => new Promise((r) => setTimeout(r, MAX_SUBMITS > 5 ? 1200 : 0));

    // Quem nunca teve job vai na frente de quem já falhou.
    const failedChord = new Set(existingJobs.filter((j) => j.stage === "chord_detection" && j.status === "failed").map((j) => j.songId));
    ready.sort((a, b) => Number(failedChord.has(a.id)) - Number(failedChord.has(b.id)));

    async function enqueueAndTry(songId: number, stage: JobStage, providerName: string) {
      const job = await enqueueJob(songId, stage, providerName);
      if (!throttled && submitted < MAX_SUBMITS) {
        await pause();
        const r = await submitJob(job);
        if (r === "submitted") submitted++;
        if (r === "throttled") throttled = true;
      }
    }

    for (const song of ready) {
      summary.scanned++;
      const songStems = allStems.filter((s) => s.songId === song.id);
      let touched = false;

      // ── Cifra (e/ou meta: bpm/tom/batidas) ──
      const alreadyHasChords = Boolean(song.chords && song.chords.length > 0);
      const needsMeta = refreshMeta && !(song.bpm && song.bpm > 0);
      if (chordsOn && (needsMeta || (!alreadyHasChords && !chordBlocked.has(song.id)))) {
        // Há de onde detectar? (mix, senão guitar/harmony/melody — ver source.ts).
        // Sem fonte o submitJob marcaria falha definitiva; poupa o job.
        if (pickChordAudio(song.audioUrl, songStems)) {
          await enqueueAndTry(song.id, "chord_detection", chordProvider.name);
          summary.chordJobsCreated++; touched = true;
        } else if (!needsMeta) {
          // Sem fonte de áudio: registra falha DEFINITIVA para a música sair da
          // janela da próxima varredura (senão ela volta aqui para sempre).
          await db.insert(processingJobs).values({
            songId: song.id, provider: chordProvider.name, stage: "chord_detection", status: "failed",
            errorMessage: `${PERM_PREFIX} Sem áudio elegível para detectar a cifra`, completedAt: new Date(),
          });
        }
      }

      // ── Letra ──
      const alreadyHasLyrics = Boolean(song.lyrics && song.lyrics.length > 0);
      const vocal = songStems.find((s) => s.instrument === "vocal");
      if (lyricsOn && !alreadyHasLyrics && !lyricsBlocked.has(song.id) && vocal) {
        await enqueueAndTry(song.id, "lyrics_detection", lyricsProvider.name);
        summary.lyricsJobsCreated++; touched = true;
      }

      if (!touched) summary.skipped++;
    }

    return NextResponse.json({ ok: true, ...summary, submitted, throttled, capped: submitted >= MAX_SUBMITS });
  } catch (err) {
    console.error("[POST /api/jobs/backfill]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return runBackfill(req);
}

// GET permite o mesmo disparo (cron da Vercel usa GET). Mesma auth.
export async function GET(req: NextRequest) {
  return runBackfill(req);
}
