/**
 * POST /api/jobs/backfill   (admin / cron)
 *
 * Cria os jobs de CIFRA e LETRA para músicas que foram separadas ANTES do
 * pipeline automático existir. O webhook de separação só dispara cifra/letra em
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
    // Músicas já separadas que AINDA precisam de algo. Antes a query trazia as
    // `limit` primeiras músicas prontas sem filtro nem ordem — com o acervo
    // crescendo, as que já tinham cifra ocupavam a janela e as do catálogo
    // (importadas pelo scripts/import-batch.mjs, que não cria job) nunca eram
    // alcançadas. Diagnóstico de 09/10/2026: 55 de 55 bases sem cifra e sem job.
    const missingChords = sql`(${songs.chords} IS NULL OR jsonb_array_length(${songs.chords}) = 0)`;
    const missingLyrics = sql`(${songs.lyrics} IS NULL OR jsonb_array_length(${songs.lyrics}) = 0)`;
    const missingBpm = sql`(${songs.bpm} IS NULL OR ${songs.bpm} <= 0)`;
    const ready = await db
      .select()
      .from(songs)
      .where(
        and(
          eq(songs.processingStatus, "ready"),
          refreshMeta ? sql`(${missingChords} OR ${missingLyrics} OR ${missingBpm})` : sql`(${missingChords} OR ${missingLyrics})`,
        ),
      )
      .orderBy(asc(songs.id))
      .limit(limit);
    if (ready.length === 0) return NextResponse.json({ ok: true, ...summary });

    const ids = ready.map((s) => s.id);

    // Stems e jobs existentes dessas músicas, em lote (evita N+1).
    const allStems = await db.select().from(stems).where(inArray(stems.songId, ids));
    const existingJobs = await db
      .select()
      .from(processingJobs)
      .where(
        and(
          inArray(processingJobs.songId, ids),
          inArray(processingJobs.stage, ["chord_detection", "lyrics_detection"]),
        ),
      );

    // Só bloqueia quem já tem job NÃO-falho (pending/running/done). Jobs 'failed'
    // (ex.: 429 do Replicate) são reprocessados — é o retry automático.
    const hasChordJob = new Set(existingJobs.filter((j) => j.stage === "chord_detection" && j.status !== "failed").map((j) => j.songId));
    const hasLyricsJob = new Set(existingJobs.filter((j) => j.stage === "lyrics_detection" && j.status !== "failed").map((j) => j.songId));

    // Teto de submissões por chamada: respeita o "burst" do Replicate e evita
    // timeout da função serverless. Se sobrar, é só chamar o backfill de novo.
    // ?max= sobe o teto (até 20) para o cron diário, com pausa entre submits.
    const MAX_SUBMITS = Math.min(Math.max(Number(url.searchParams.get("max")) || 5, 1), 20);
    let submitted = 0;
    const pause = () => new Promise((r) => setTimeout(r, MAX_SUBMITS > 5 ? 1200 : 0));

    // Quem nunca teve job vai na frente de quem já falhou: uma música que
    // falha sempre (ex.: "Nenhum acorde detectado") não pode tomar a vaga das
    // que nunca foram tentadas a cada chamada.
    const failedChord = new Set(existingJobs.filter((j) => j.stage === "chord_detection" && j.status === "failed").map((j) => j.songId));
    ready.sort((a, b) => Number(failedChord.has(a.id)) - Number(failedChord.has(b.id)));

    // Cria o job e submete; apaga jobs 'failed' antigos do mesmo estágio (não acumula).
    async function createJob(
      songId: number,
      stage: "chord_detection" | "lyrics_detection",
      providerName: string,
      submit: () => Promise<{ providerJobId: string }>,
    ): Promise<boolean> {
      await db.delete(processingJobs).where(and(
        eq(processingJobs.songId, songId),
        eq(processingJobs.stage, stage),
        eq(processingJobs.status, "failed"),
      ));
      const [job] = await db
        .insert(processingJobs)
        .values({ songId, provider: providerName, stage, status: "pending" })
        .returning();
      try {
        const { providerJobId } = await submit();
        await db.update(processingJobs).set({ providerJobId, status: "running" }).where(eq(processingJobs.id, job.id));
        return true;
      } catch (submitErr) {
        console.error(`[jobs/backfill] ${stage} submit song#${songId}`, submitErr);
        await db.update(processingJobs).set({ status: "failed", errorMessage: String(submitErr).slice(0, 500) }).where(eq(processingJobs.id, job.id));
        return false;
      }
    }

    for (const song of ready) {
      summary.scanned++;
      if (submitted >= MAX_SUBMITS) { summary.skipped++; continue; }
      const songStems = allStems.filter((s) => s.songId === song.id);
      let touched = false;

      // ── Cifra (e/ou meta: bpm/tom/batidas) ──
      const alreadyHasChords = Boolean(song.chords && song.chords.length > 0);
      // Critério = falta BPM (o que a detecção preenche de forma confiável). As
      // batidas o app deriva do BPM (o stem de harmonia não dá beats por si só).
      const needsMeta = refreshMeta && !(song.bpm && song.bpm > 0);
      // Roda se: falta cifra (fluxo normal) OU falta o meta (reanálise) — nesse
      // caso mesmo com cifra/job existente, pois só o meta será atualizado.
      if (chordsOn && submitted < MAX_SUBMITS && (needsMeta || (!alreadyHasChords && !hasChordJob.has(song.id)))) {
        // Fonte da cifra: o MIX quando ainda existe, senão guitar/harmony/melody.
        // NUNCA songStems[0] (podia ser a bateria) e nunca o resíduo "harmony"
        // por padrão — ver src/lib/chords/source.ts.
        const source = pickChordAudio(song.audioUrl, songStems);
        if (source) {
          submitted++;
          await pause();
          if (await createJob(song.id, "chord_detection", chordProvider.name, () => chordProvider.submit(source.url))) {
            summary.chordJobsCreated++; touched = true;
          }
        }
      }

      // ── Letra ──
      const alreadyHasLyrics = Boolean(song.lyrics && song.lyrics.length > 0);
      const vocal = songStems.find((s) => s.instrument === "vocal");
      if (lyricsOn && !alreadyHasLyrics && !hasLyricsJob.has(song.id) && vocal && submitted < MAX_SUBMITS) {
        submitted++;
        await pause();
        if (await createJob(song.id, "lyrics_detection", lyricsProvider.name, () => lyricsProvider.submit(vocal.audioUrl))) {
          summary.lyricsJobsCreated++; touched = true;
        }
      }

      if (!touched) summary.skipped++;
    }

    return NextResponse.json({ ok: true, ...summary, submitted, capped: submitted >= MAX_SUBMITS });
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
