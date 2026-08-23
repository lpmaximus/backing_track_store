/**
 * GET /api/chords/advance/:songId  (Fase 1.5, Frente C)
 *
 * Avança o job de detecção de cifra (Music.ai é por polling). Pode ser chamado
 * pelo poll do client na página da música OU por um cron (Vercel) que varre jobs
 * pendentes. Idempotente: se o job já terminou, só devolve o estado atual.
 *
 * Auth: sessão logada OU header x-cron-secret === CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, songs, processingJobs } from "@/src/db";
import { and, eq, desc } from "drizzle-orm";
import { getChordProvider } from "@/src/lib/chords";
import { purgeSourceMix } from "@/src/lib/retention";
import type { ChordMeta } from "@/src/lib/chords/types";

/** Campos de bpm/tom/batidas a gravar, quando o detector devolveu algum. */
function metaPatch(m: ChordMeta | undefined) {
  return {
    ...(m?.bpm ? { bpm: m.bpm } : {}),
    ...(m?.key ? { key: m.key } : {}),
    ...(m?.beats?.length ? { beats: m.beats } : {}),
  };
}

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

    const [job] = await db
      .select()
      .from(processingJobs)
      .where(and(eq(processingJobs.songId, songId), eq(processingJobs.stage, "chord_detection")))
      .orderBy(desc(processingJobs.id))
      .limit(1);

    if (!job || !job.providerJobId || job.status === "done" || job.status === "failed") {
      return NextResponse.json({
        chordsStatus: song.chordsStatus,
        chords: song.chords ?? null,
        jobStatus: job?.status ?? "none",
      });
    }

    // Job em andamento → consulta o provider.
    const provider = getChordProvider();
    const result = await provider.poll(job.providerJobId);

    if (result.status === "running") {
      return NextResponse.json({ chordsStatus: "generating", chords: null, jobStatus: "running" });
    }

    if (result.status === "failed") {
      // BPM, tom e batidas vêm da MESMA execução do detector e não dependem de a
      // cifra ter saído. Descartá-los junto com a cifra era o motivo de "Tom ?" e
      // "BPM 0" justamente nas músicas em que a detecção falhava.
      const patch = metaPatch(result.meta);
      if (Object.keys(patch).length > 0) {
        await db.update(songs).set(patch).where(eq(songs.id, songId));
      }
      await db
        .update(processingJobs)
        .set({ status: "failed", errorMessage: result.error.slice(0, 500), completedAt: new Date() })
        .where(eq(processingJobs.id, job.id));
      // O mix só era guardado por causa deste job — pode ir embora (EVT 5.1).
      await purgeSourceMix(songId);
      return NextResponse.json({ chordsStatus: song.chordsStatus, chords: song.chords ?? null, jobStatus: "failed" });
    }

    // Sucesso: salva a cifra automática (draft), a menos que já exista cifra da comunidade.
    const setChords = !(song.chords && song.chords.length > 0);
    const patch = metaPatch(result.meta);
    if (setChords || Object.keys(patch).length > 0) {
      await db.update(songs).set({
        ...(setChords ? { chords: result.sections, chordsSource: "auto" as const, chordsStatus: "draft" as const } : {}),
        ...patch,
      }).where(eq(songs.id, songId));
    }
    await db
      .update(processingJobs)
      .set({ status: "done", completedAt: new Date() })
      .where(eq(processingJobs.id, job.id));
    // Retenção adiada (EVT 5.1): a cifra já leu o mix, ele pode ser apagado.
    await purgeSourceMix(songId);

    return NextResponse.json({ chordsStatus: "draft", chords: result.sections, jobStatus: "done" });
  } catch (err) {
    console.error("[GET /api/chords/advance]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
