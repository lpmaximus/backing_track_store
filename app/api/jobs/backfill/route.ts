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
import { and, eq, inArray } from "drizzle-orm";
import { isAdminRequest } from "@/src/lib/adminAuth";
import { getChordProvider } from "@/src/lib/chords";
import { getLyricsProvider } from "@/src/lib/lyrics";

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
    // Músicas já separadas.
    const ready = await db
      .select()
      .from(songs)
      .where(eq(songs.processingStatus, "ready"))
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
    const MAX_SUBMITS = 5;
    let submitted = 0;

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

      // ── Cifra ──
      const alreadyHasChords = Boolean(song.chords && song.chords.length > 0);
      if (chordsOn && !alreadyHasChords && !hasChordJob.has(song.id) && submitted < MAX_SUBMITS) {
        const harmony = songStems.find((s) => s.instrument === "harmony") ?? songStems[0];
        if (harmony) {
          submitted++;
          if (await createJob(song.id, "chord_detection", chordProvider.name, () => chordProvider.submit(harmony.audioUrl))) {
            summary.chordJobsCreated++; touched = true;
          }
        }
      }

      // ── Letra ──
      const alreadyHasLyrics = Boolean(song.lyrics && song.lyrics.length > 0);
      const vocal = songStems.find((s) => s.instrument === "vocal");
      if (lyricsOn && !alreadyHasLyrics && !hasLyricsJob.has(song.id) && vocal && submitted < MAX_SUBMITS) {
        submitted++;
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
