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
import { putObjectFromUrl } from "@/src/lib/r2";
import { getChordProvider } from "@/src/lib/chords";
import { pickChordAudio } from "@/src/lib/chords/source";
import { purgeSourceMix } from "@/src/lib/retention";
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

    // 4. Estado da música: separada e pronta pra tocar.
    //    A EXCLUSÃO DO MIX (retenção, EVT 5.1) mudou de lugar — ver passo 7.
    //    Antes ela acontecia AQUI, milissegundos antes de a cifra ser submetida:
    //    por isso a detecção nunca pôde usar o mix e era obrigada a rodar sobre
    //    um stem residual, que é o que fazia a cifra sair vazia ou com 1 acorde.
    const [song] = await db.select().from(songs).where(eq(songs.id, job.songId)).limit(1);
    await db.update(songs).set({ processingStatus: "ready" }).where(eq(songs.id, job.songId));

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

    // 5. Frente C: detecção de cifra sobre o MIX (ver src/lib/chords/source.ts
    //    para a ordem de preferência e o porquê). Só na 1ª vez por música.
    //    O provider é por polling: aqui só criamos e submetemos o job; quem
    //    finaliza é /api/chords/advance/[songId] ou o cron /api/jobs/finalize.
    try {
      const chordProvider = getChordProvider();
      const alreadyHasChords = Boolean(song?.chords && song.chords.length > 0);
      if (chordProvider.isConfigured() && song && !alreadyHasChords) {
        const source = pickChordAudio(song.audioUrl, persistedStems);
        if (source) {
          const [chordJob] = await db
            .insert(processingJobs)
            .values({ songId: job.songId, provider: chordProvider.name, stage: "chord_detection", status: "pending" })
            .returning();
          try {
            const { providerJobId } = await chordProvider.submit(source.url);
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
        } else {
          console.warn("[webhook/separation] nenhum áudio elegível p/ cifra", job.songId);
        }
      }
    } catch (chordErr) {
      console.error("[webhook/separation] chord detection setup", chordErr);
    }

    // 6. Caminho 3: transcrição de LETRA sobre o stem de VOCAL (voz isolada
    //    transcreve muito melhor e é barata). Também por polling.
    //    Faixa sem stem de vocal (backing track instrumental, ex. importada do
    //    Suno) simplesmente não gera letra — é o correto, não é falha.
    try {
      const lyricsProvider = getLyricsProvider();
      const alreadyHasLyrics = Boolean(song?.lyrics && song.lyrics.length > 0);
      const vocal = persistedStems.find((s) => s.instrument === "vocal");
      if (lyricsProvider.isConfigured() && song && !alreadyHasLyrics && vocal) {
        // FILA: só registra o job (pending, sem providerJobId). Quem submete é o
        // /api/lyrics/advance (poll da página) ou o backfill, respeitando o rate
        // limit do Replicate (6/min, burst 1 com saldo < US$5). Submeter aqui,
        // 350 ms depois da cifra, era o que tomava 429 e deixava a música sem letra.
        await db
          .insert(processingJobs)
          .values({ songId: job.songId, provider: lyricsProvider.name, stage: "lyrics_detection", status: "pending" });
      }
    } catch (lyricsErr) {
      console.error("[webhook/separation] lyrics detection setup", lyricsErr);
    }

    // 7. Retenção (EVT 5.1): agora que a cifra já foi submetida, o mix pode ir.
    //    Se o job de cifra ainda estiver de pé, purgeSourceMix não faz nada e
    //    quem apaga é o /api/chords/advance ou o cron finalize ao fechar o job.
    await purgeSourceMix(job.songId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/webhooks/separation]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
