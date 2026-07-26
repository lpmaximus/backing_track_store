/**
 * POST /api/webhooks/separation  (Fase 1.5)
 *
 * Endpoint PÚBLICO que o Replicate chama quando a separação termina.
 * Segurança (v1.1 do plano):
 *   1. Valida a assinatura do webhook — sem isso, qualquer um injeta stems falsos.
 *   2. É idempotente por providerJobId — o Replicate reenvia em timeout.
 *   3. Só grava no banco e responde rápido; nada pesado roda aqui.
 *
 * Ao concluir: popula `stems`, marca o job `done`, apaga o mix original do R2
 * (política de retenção — EVT 5.1) e deixa o gancho para a detecção de cifra
 * (Frente C).
 */
import { NextRequest, NextResponse } from "next/server";
import { db, songs, stems, processingJobs } from "@/src/db";
import { eq } from "drizzle-orm";
import { getSeparationProvider } from "@/src/lib/separation";
import { deleteObject, keyFromPublicUrl, putObjectFromUrl } from "@/src/lib/r2";
import { getChordProvider } from "@/src/lib/chords";
import { getLyricsProvider } from "@/src/lib/lyrics";
import { createNotification } from "@/src/lib/notifications";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const provider = getSeparationProvider();

  // 1. Assinatura
  const ok = await provider.verifyWebhook(req.headers, rawBody);
  if (!ok) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  let parsed;
  try {
    parsed = provider.parseWebhook(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const songIdParam = Number(new URL(req.url).searchParams.get("songId"));

  try {
    // Localiza o job: por providerJobId (preferido) ou pelo songId da query.
    let job: typeof processingJobs.$inferSelect | undefined;
    if (parsed.providerJobId) {
      [job] = await db
        .select()
        .from(processingJobs)
        .where(eq(processingJobs.providerJobId, parsed.providerJobId))
        .limit(1);
    }
    if (!job && songIdParam) {
      [job] = await db
        .select()
        .from(processingJobs)
        .where(eq(processingJobs.songId, songIdParam))
        .limit(1);
    }
    if (!job) {
      // Não achou o job — responde 200 mesmo assim para o provider não reentregar infinito.
      console.warn("[webhook/separation] job não encontrado", parsed.providerJobId, songIdParam);
      return NextResponse.json({ ok: true, ignored: true });
    }

    // 2. Idempotência — job já finalizado, ignora reentrega.
    if (job.status === "done" || job.status === "failed") {
      return NextResponse.json({ ok: true, alreadyProcessed: true });
    }

    if (parsed.status === "failed") {
      await db
        .update(processingJobs)
        .set({ status: "failed", errorMessage: parsed.errorMessage ?? "provider falhou", completedAt: new Date() })
        .where(eq(processingJobs.id, job.id));
      await db.update(songs).set({ processingStatus: "failed" }).where(eq(songs.id, job.songId));
      return NextResponse.json({ ok: true });
    }

    if (parsed.status !== "done") {
      // Evento intermediário — nada a fazer.
      return NextResponse.json({ ok: true, pending: true });
    }

    // 3. Persiste os stems no nosso R2 antes de gravar no banco. A URL que o
    //    provider devolve (ex.: replicate.delivery) é temporária/de terceiro —
    //    depender dela direto faz o player quebrar quando o link expira ou o
    //    CORS bloqueia o fetch do WaveSurfer. Best-effort: se a cópia falhar
    //    pra algum stem, cai de volta pra URL do provider em vez de travar
    //    o pipeline inteiro.
    const persistedStems = await Promise.all(
      parsed.stems.map(async (s) => {
        try {
          const ext = (new URL(s.audioUrl).pathname.match(/\.(\w+)$/)?.[1] || "mp3").toLowerCase();
          const key = `audio/stems/${job.songId}/${s.instrument}.${ext}`;
          const publicUrl = await putObjectFromUrl(key, s.audioUrl);
          return { ...s, audioUrl: publicUrl };
        } catch (persistErr) {
          console.error("[webhook/separation] falha ao persistir stem no R2, usando URL do provider", s.instrument, persistErr);
          return s;
        }
      }),
    );

    // Popula stems (replace idempotente: limpa antes de inserir).
    await db.delete(stems).where(eq(stems.songId, job.songId));
    if (persistedStems.length > 0) {
      await db.insert(stems).values(
        persistedStems.map((s) => ({
          songId: job.songId,
          instrument: s.instrument,
          label: s.label,
          audioUrl: s.audioUrl,
        })),
      );
    }

    await db
      .update(processingJobs)
      .set({ status: "done", completedAt: new Date() })
      .where(eq(processingJobs.id, job.id));

    // 4. Retenção: apaga o mix original do R2 e zera audioUrl (EVT 5.1).
    //    O player reconstrói o "mix completo" tocando os stems juntos.
    const [song] = await db.select().from(songs).where(eq(songs.id, job.songId)).limit(1);
    if (song?.sourceType === "user_upload" && song.audioUrl) {
      const key = keyFromPublicUrl(song.audioUrl);
      if (key) {
        try {
          await deleteObject(key);
        } catch (delErr) {
          console.error("[webhook/separation] falha ao apagar mix original", delErr);
        }
      }
      await db
        .update(songs)
        .set({ audioUrl: null, processingStatus: "ready" })
        .where(eq(songs.id, job.songId));
    } else {
      await db.update(songs).set({ processingStatus: "ready" }).where(eq(songs.id, job.songId));
    }

    // 4b. Área do Usuário: avisa quem enviou que a música já pode ser tocada.
    //     Best-effort — não trava o pipeline se falhar (ver createNotification).
    if (song?.sourceType === "user_upload" && song.uploadedByUserId) {
      await createNotification({
        userId: song.uploadedByUserId,
        type: "system",
        title: "Sua música está pronta",
        body: `"${song.title}" já foi separada em stems e pode ser tocada.`,
        link: `/song/${song.slug}`,
      });
    }

    // 5. Frente C: dispara detecção de cifra sobre o stem de HARMONIA (permanente).
    //    Detectamos no stem, não no mix — assim a retenção acima (apagar o mix)
    //    fica desacoplada da cifra. Só na 1ª vez por música (sem cifra ainda).
    //    Music.ai é por polling: aqui só criamos o job e submetemos; quem finaliza
    //    é /api/chords/advance/[songId] (chamado pelo poll do client ou por cron).
    try {
      const chordProvider = getChordProvider();
      const alreadyHasChords = Boolean(song?.chords && song.chords.length > 0);
      if (chordProvider.isConfigured() && song && !alreadyHasChords) {
        const harmony = persistedStems.find((s) => s.instrument === "harmony") ?? persistedStems[0];
        if (harmony) {
          const [chordJob] = await db
            .insert(processingJobs)
            .values({ songId: job.songId, provider: chordProvider.name, stage: "chord_detection", status: "pending" })
            .returning();
          try {
            const { providerJobId } = await chordProvider.submit(harmony.audioUrl);
            await db
              .update(processingJobs)
              .set({ providerJobId, status: "running" })
              .where(eq(processingJobs.id, chordJob.id));
          } catch (submitErr) {
            console.error("[webhook/separation] chord submit", submitErr);
            await db
              .update(processingJobs)
              .set({ status: "failed", errorMessage: String(submitErr).slice(0, 500) })
              .where(eq(processingJobs.id, chordJob.id));
          }
        }
      }
    } catch (chordErr) {
      console.error("[webhook/separation] chord detection setup", chordErr);
    }

    // 6. Caminho 3: dispara transcrição de LETRA sobre o stem de VOCAL (barato,
    //    voz isolada). Também por polling — finalizada em /api/lyrics/advance.
    //    Só na 1ª vez (sem letra ainda) e se o provider estiver configurado.
    try {
      const lyricsProvider = getLyricsProvider();
      const alreadyHasLyrics = Boolean(song?.lyrics && song.lyrics.length > 0);
      const vocal = persistedStems.find((s) => s.instrument === "vocal");
      if (lyricsProvider.isConfigured() && song && !alreadyHasLyrics && vocal) {
        const [lyricsJob] = await db
          .insert(processingJobs)
          .values({ songId: job.songId, provider: lyricsProvider.name, stage: "lyrics_detection", status: "pending" })
          .returning();
        try {
          const { providerJobId } = await lyricsProvider.submit(vocal.audioUrl);
          await db
            .update(processingJobs)
            .set({ providerJobId, status: "running" })
            .where(eq(processingJobs.id, lyricsJob.id));
        } catch (submitErr) {
          console.error("[webhook/separation] lyrics submit", submitErr);
          await db
            .update(processingJobs)
            .set({ status: "failed", errorMessage: String(submitErr).slice(0, 500) })
            .where(eq(processingJobs.id, lyricsJob.id));
        }
      }
    } catch (lyricsErr) {
      console.error("[webhook/separation] lyrics detection setup", lyricsErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/webhooks/separation]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
